const { PrismaClient } = require('@prisma/client');

class AppointmentService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Check for scheduling conflicts
   */
  async checkConflicts(doctorId, startTime, endTime, excludeAppointmentId = null) {
    const conflicts = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: {
          in: ['BOOKED', 'CONFIRMED'],
        },
        ...(excludeAppointmentId ? { NOT: { id: excludeAppointmentId } } : {}),
        OR: [
          {
            // Conflict if slot overlaps with existing appointment
            startTime: { lt: new Date(endTime) },
            endTime: { gt: new Date(startTime) },
          },
        ],
      },
    });

    return conflicts.length > 0;
  }

  /**
   * Book an appointment with transaction for data consistency
   */
  async bookAppointment(organizationId, appointmentData) {
    const {
      patientId,
      doctorId,
      startTime,
      endTime,
      source = 'MANUAL',
      channel = 'VOICE',
      reason,
      internalNotes,
    } = appointmentData;

    // Use transaction to ensure atomic operation
    const result = await this.prisma.$transaction(async (tx) => {
      // Check for conflicts within transaction
      const hasConflict = await tx.appointment.findMany({
        where: {
          doctorId,
          status: {
            in: ['BOOKED', 'CONFIRMED'],
          },
          OR: [
            {
              startTime: { lt: new Date(endTime) },
              endTime: { gt: new Date(startTime) },
            },
          ],
        },
      });

      if (hasConflict.length > 0) {
        throw new Error('Appointment slot is already booked');
      }

      // Verify patient and doctor exist
      const [patient, doctor] = await Promise.all([
        tx.patient.findUnique({ where: { id: patientId } }),
        tx.doctor.findUnique({ where: { id: doctorId } }),
      ]);

      if (!patient) {
        throw new Error(`Patient with ID ${patientId} not found`);
      }

      if (!doctor) {
        throw new Error(`Doctor with ID ${doctorId} not found`);
      }

      // Create appointment
      const appointment = await tx.appointment.create({
        data: {
          organizationId,
          patientId,
          doctorId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: 'BOOKED',
          source,
          channel,
          reason,
          internalNotes,
        },
        include: {
          patient: true,
          doctor: { include: { branch: true } },
        },
      });

      return appointment;
    });

    return result;
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(appointmentId, newStartTime, newEndTime, reason) {
    // Get appointment first
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error(`Appointment with ID ${appointmentId} not found`);
    }

    // Use transaction to check conflicts and update
    const result = await this.prisma.$transaction(async (tx) => {
      // Check conflicts for new time (excluding current appointment)
      const hasConflict = await tx.appointment.findMany({
        where: {
          doctorId: appointment.doctorId,
          id: { not: appointmentId },
          status: {
            in: ['BOOKED', 'CONFIRMED'],
          },
          OR: [
            {
              startTime: { lt: new Date(newEndTime) },
              endTime: { gt: new Date(newStartTime) },
            },
          ],
        },
      });

      if (hasConflict.length > 0) {
        throw new Error('New appointment slot is already booked');
      }

      // Update appointment
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          startTime: new Date(newStartTime),
          endTime: new Date(newEndTime),
          internalNotes: reason ? `Rescheduled: ${reason}` : undefined,
        },
        include: {
          patient: true,
          doctor: { include: { branch: true } },
        },
      });

      return updatedAppointment;
    });

    return result;
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(appointmentId, reason) {
    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        internalNotes: reason ? `Cancelled: ${reason}` : undefined,
      },
      include: {
        patient: true,
        doctor: { include: { branch: true } },
      },
    });

    return appointment;
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: { include: { branch: true } },
      },
    });

    if (!appointment) {
      throw new Error(`Appointment with ID ${appointmentId} not found`);
    }

    return appointment;
  }

  /**
   * Get patient appointments
   */
  async getPatientAppointments(patientId, status = null) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        ...(status ? { status } : {}),
      },
      include: {
        doctor: { include: { branch: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return appointments;
  }

  /**
   * Get doctor appointments for a date
   */
  async getDoctorAppointmentsForDate(doctorId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        patient: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments;
  }

  /**
   * Get upcoming appointments
   */
  async getUpcomingAppointments(limit = 20) {
    const now = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        startTime: { gte: now },
        status: {
          in: ['BOOKED', 'CONFIRMED'],
        },
      },
      include: {
        patient: true,
        doctor: { include: { branch: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });

    return appointments;
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId, status) {
    const validStatuses = ['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        patient: true,
        doctor: { include: { branch: true } },
      },
    });

    return appointment;
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(appointmentId) {
    const appointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        reminderSent: true,
        reminderSentAt: new Date(),
      },
    });

    return appointment;
  }

  /**
   * Get appointments requiring reminders
   */
  async getAppointmentsRequiringReminders(hoursUntilAppointment = 24) {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + hoursUntilAppointment * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['BOOKED', 'CONFIRMED'] },
        reminderSent: false,
        startTime: {
          gte: now,
          lte: reminderTime,
        },
      },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return appointments;
  }
}

module.exports = AppointmentService;
