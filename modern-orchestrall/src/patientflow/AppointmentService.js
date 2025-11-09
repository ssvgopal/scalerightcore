// src/patientflow/AppointmentService.js - Appointment Management Service
const { z } = require('zod');
const logger = require('../utils/logger');
const database = require('../database');

// Validation schemas
const createAppointmentSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  status: z.enum(['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).default('BOOKED'),
  source: z.enum(['WHATSAPP', 'VOICE', 'MANUAL']).default('MANUAL'),
  channel: z.enum(['whatsapp', 'voice', 'email']).default('voice'),
  notes: z.string().optional(),
  metadata: z.object({}).optional()
});

const rescheduleAppointmentSchema = z.object({
  newStartTime: z.string().min(1, 'New start time is required'),
  newEndTime: z.string().min(1, 'New end time is required'),
  reason: z.string().optional(),
  rescheduledBy: z.string().optional() // User ID
});

class AppointmentService {
  constructor() {
    this.prisma = null;
  }

  async initialize() {
    this.prisma = database.client;
  }

  /**
   * Generate available appointment slots for a doctor on a specific date
   */
  async generateAvailableSlots(doctorId, date, duration = 30) {
    try {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Get doctor's schedule for this day
      const doctorSchedule = await this.prisma.doctorSchedule.findUnique({
        where: {
          doctorId_dayOfWeek: {
            doctorId,
            dayOfWeek
          }
        },
        include: {
          doctor: true
        }
      });

      if (!doctorSchedule || !doctorSchedule.isAvailable) {
        return { slots: [], message: 'Doctor not available on this day' };
      }

      // Get existing appointments for this doctor on this date
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointments = await this.prisma.appointment.findMany({
        where: {
          doctorId,
          startTime: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: {
            not: 'CANCELLED'
          }
        },
        select: {
          startTime: true,
          endTime: true
        }
      });

      // Parse operating hours
      const operatingHours = doctorSchedule.operatingHours;
      const workStart = this.parseTime(operatingHours.start);
      const workEnd = this.parseTime(operatingHours.end);

      // Generate slots
      const slots = [];
      let currentTime = new Date(targetDate);
      currentTime.setHours(workStart.hours, workStart.minutes, 0, 0);
      const workEndTime = new Date(targetDate);
      workEndTime.setHours(workEnd.hours, workEnd.minutes, 0, 0);

      while (currentTime < workEndTime) {
        const slotEndTime = new Date(currentTime.getTime() + duration * 60000);
        
        // Check if this slot conflicts with existing appointments
        const hasConflict = existingAppointments.some(appointment => {
          const appointmentStart = new Date(appointment.startTime);
          const appointmentEnd = new Date(appointment.endTime);
          return (currentTime < appointmentEnd && slotEndTime > appointmentStart);
        });

        if (!hasConflict && slotEndTime <= workEndTime) {
          slots.push({
            startTime: new Date(currentTime),
            endTime: new Date(slotEndTime),
            available: true
          });
        }

        currentTime = slotEndTime;
      }

      logger.info('Generated available slots', {
        doctorId,
        date,
        slotsCount: slots.length
      });

      return { slots };
    } catch (error) {
      logger.error('Failed to generate available slots', { doctorId, date, error: error.message });
      throw error;
    }
  }

  /**
   * Check if appointment slot is available
   */
  async checkSlotAvailability(doctorId, startTime, endTime) {
    try {
      const conflictingAppointment = await this.prisma.appointment.findFirst({
        where: {
          doctorId,
          startTime: {
            lt: endTime
          },
          endTime: {
            gt: startTime
          },
          status: {
            not: 'CANCELLED'
          }
        }
      });

      return !conflictingAppointment;
    } catch (error) {
      logger.error('Failed to check slot availability', { doctorId, startTime, endTime, error: error.message });
      throw error;
    }
  }

  /**
   * Create a new appointment
   */
  async createAppointment(appointmentData) {
    try {
      const validatedData = createAppointmentSchema.parse(appointmentData);
      const startTime = new Date(validatedData.startTime);
      const endTime = new Date(validatedData.endTime);

      // Check for conflicts
      const isAvailable = await this.checkSlotAvailability(validatedData.doctorId, startTime, endTime);
      if (!isAvailable) {
        throw new Error('Appointment slot is not available');
      }

      const appointment = await this.prisma.appointment.create({
        data: {
          organizationId: validatedData.organizationId,
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          startTime,
          endTime,
          status: validatedData.status,
          source: validatedData.source,
          channel: validatedData.channel,
          notes: validatedData.notes,
          metadata: validatedData.metadata || {}
        },
        include: {
          patient: true,
          doctor: true
        }
      });

      logger.info('Appointment created', {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        startTime: appointment.startTime
      });

      return appointment;
    } catch (error) {
      logger.error('Failed to create appointment', { appointmentData, error: error.message });
      throw error;
    }
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(appointmentId, rescheduleData) {
    try {
      const validatedData = rescheduleAppointmentSchema.parse(rescheduleData);
      const newStartTime = new Date(validatedData.newStartTime);
      const newEndTime = new Date(validatedData.newEndTime);

      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          doctor: true
        }
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      // Check if appointment can be rescheduled
      if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
        throw new Error(`Cannot reschedule appointment with status: ${appointment.status}`);
      }

      // Check availability for new slot
      const isAvailable = await this.checkSlotAvailability(appointment.doctorId, newStartTime, newEndTime);
      if (!isAvailable) {
        throw new Error('New appointment slot is not available');
      }

      const updatedAppointment = await this.prisma.$transaction(async (tx) => {
        // Update the appointment
        const updated = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            startTime: newStartTime,
            endTime: newEndTime,
            metadata: {
              ...appointment.metadata,
              rescheduleHistory: [
                ...(appointment.metadata.rescheduleHistory || []),
                {
                  originalStartTime: appointment.startTime,
                  originalEndTime: appointment.endTime,
                  newStartTime,
                  newEndTime,
                  reason: validatedData.reason,
                  rescheduledBy: validatedData.rescheduledBy,
                  rescheduledAt: new Date()
                }
              ]
            }
          },
          include: {
            patient: true,
            doctor: true
          }
        });

        // Add a note about the reschedule
        await tx.patientNote.create({
          data: {
            patientId: appointment.patientId,
            noteType: 'administrative',
            content: `Appointment rescheduled from ${appointment.startTime} to ${newStartTime}. Reason: ${validatedData.reason || 'Not specified'}`,
            createdBy: validatedData.rescheduledBy
          }
        });

        return updated;
      });

      logger.info('Appointment rescheduled', {
        appointmentId,
        originalTime: appointment.startTime,
        newTime: newStartTime,
        reason: validatedData.reason
      });

      return updatedAppointment;
    } catch (error) {
      logger.error('Failed to reschedule appointment', { appointmentId, rescheduleData, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId, cancelData = {}) {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: true,
          doctor: true
        }
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status === 'CANCELLED') {
        throw new Error('Appointment is already cancelled');
      }

      if (appointment.status === 'COMPLETED') {
        throw new Error('Cannot cancel completed appointment');
      }

      const updatedAppointment = await this.prisma.$transaction(async (tx) => {
        // Update appointment status
        const updated = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...appointment.metadata,
              cancellationInfo: {
                cancelledAt: new Date(),
                cancelledBy: cancelData.cancelledBy,
                reason: cancelData.reason
              }
            }
          },
          include: {
            patient: true,
            doctor: true
          }
        });

        // Add a note about the cancellation
        await tx.patientNote.create({
          data: {
            patientId: appointment.patientId,
            noteType: 'administrative',
            content: `Appointment cancelled. Reason: ${cancelData.reason || 'Not specified'}`,
            createdBy: cancelData.cancelledBy
          }
        });

        return updated;
      });

      logger.info('Appointment cancelled', {
        appointmentId,
        cancelledBy: cancelData.cancelledBy,
        reason: cancelData.reason
      });

      return updatedAppointment;
    } catch (error) {
      logger.error('Failed to cancel appointment', { appointmentId, cancelData, error: error.message });
      throw error;
    }
  }

  /**
   * Get appointments for a patient
   */
  async getPatientAppointments(patientId, options = {}) {
    try {
      const { status, startDate, endDate, limit = 50, offset = 0 } = options;
      
      const where = { patientId };
      
      if (status) {
        where.status = status;
      }
      
      if (startDate || endDate) {
        where.startTime = {};
        if (startDate) where.startTime.gte = new Date(startDate);
        if (endDate) where.startTime.lte = new Date(endDate);
      }

      const appointments = await this.prisma.appointment.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
        include: {
          doctor: true
        }
      });

      return appointments;
    } catch (error) {
      logger.error('Failed to get patient appointments', { patientId, options, error: error.message });
      throw error;
    }
  }

  /**
   * Get appointments for a doctor
   */
  async getDoctorAppointments(doctorId, date) {
    try {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await this.prisma.appointment.findMany({
        where: {
          doctorId,
          startTime: {
            gte: startOfDay,
            lte: endOfDay
          }
        },
        orderBy: { startTime: 'asc' },
        include: {
          patient: true
        }
      });

      return appointments;
    } catch (error) {
      logger.error('Failed to get doctor appointments', { doctorId, date, error: error.message });
      throw error;
    }
  }

  /**
   * Helper function to parse time string (e.g., "09:00")
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
  }
}

module.exports = AppointmentService;