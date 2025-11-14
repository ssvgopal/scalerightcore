const { PrismaClient } = require('@prisma/client');

class DoctorService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Get all clinic branches
   */
  async getAllBranches(organizationId) {
    const branches = await this.prisma.clinicBranch.findMany({
      where: { organizationId },
      include: {
        doctors: {
          where: { isActive: true },
          include: {
            schedules: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return branches;
  }

  /**
   * Get branch by ID
   */
  async getBranchById(branchId) {
    const branch = await this.prisma.clinicBranch.findUnique({
      where: { id: branchId },
      include: {
        doctors: {
          where: { isActive: true },
          include: {
            schedules: true,
          },
        },
      },
    });

    return branch;
  }

  /**
   * Get doctors by branch
   */
  async getDoctorsByBranch(branchId, includeInactive = false) {
    const doctors = await this.prisma.doctor.findMany({
      where: {
        branchId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        branch: true,
        schedules: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return doctors;
  }

  /**
   * Get doctor by ID with full details
   */
  async getDoctorById(doctorId) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        branch: true,
        schedules: true,
        appointments: {
          where: {
            status: {
              in: ['BOOKED', 'CONFIRMED'],
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    return doctor;
  }

  /**
   * Search doctors by specialty and branch
   */
  async searchDoctors(organizationId, filters = {}) {
    const { branchId, specialty, isAvailable } = filters;

    const doctors = await this.prisma.doctor.findMany({
      where: {
        organizationId,
        ...(branchId ? { branchId } : {}),
        ...(specialty ? { specialty } : {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
        isActive: true,
      },
      include: {
        branch: true,
        schedules: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return doctors;
  }

  /**
   * Get doctor availability for a specific date
   */
  async getDoctorAvailability(doctorId, date, slotDurationMinutes = 30) {
    const doctor = await this.getDoctorById(doctorId);

    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // Get schedule for this day
    const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek);

    if (!schedule || !schedule.isActive) {
      return {
        doctorId,
        date,
        available: false,
        slots: [],
      };
    }

    // Parse time slots from schedule
    const timeSlots = schedule.timeSlots || [];
    const slots = this.generateSlots(date, timeSlots, slotDurationMinutes);

    // Filter out already booked slots
    const bookedSlots = doctor.appointments
      .filter(apt => {
        const aptDate = new Date(apt.startTime).toISOString().split('T')[0];
        return aptDate === date;
      })
      .map(apt => ({
        start: new Date(apt.startTime),
        end: new Date(apt.endTime),
      }));

    const availableSlots = slots.filter(slot => {
      return !bookedSlots.some(booked => this.slotsOverlap(slot, booked));
    });

    return {
      doctorId,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      specialty: doctor.specialty,
      date,
      availableSlots,
      totalSlots: slots.length,
      bookedSlots: bookedSlots.length,
    };
  }

  /**
   * Get availability for multiple doctors
   */
  async getMultipleDoctorsAvailability(doctorIds, date, slotDurationMinutes = 30) {
    const availabilities = await Promise.all(
      doctorIds.map(doctorId =>
        this.getDoctorAvailability(doctorId, date, slotDurationMinutes).catch(err => ({
          doctorId,
          error: err.message,
        }))
      )
    );

    return availabilities;
  }

  /**
   * Generate time slots for a given day
   */
  generateSlots(date, timeSlots, slotDurationMinutes) {
    const slots = [];
    const dateObj = new Date(date);

    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return slots;
    }

    for (const slot of timeSlots) {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);

      let currentTime = new Date(dateObj);
      currentTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(dateObj);
      endTime.setHours(endHour, endMin, 0, 0);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDurationMinutes);

        if (slotEnd <= endTime) {
          slots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
            available: true,
          });
        }

        currentTime = slotEnd;
      }
    }

    return slots;
  }

  /**
   * Check if two time slots overlap
   */
  slotsOverlap(slot1, slot2) {
    const start1 = new Date(slot1.start);
    const end1 = new Date(slot1.end);
    const start2 = new Date(slot2.start);
    const end2 = new Date(slot2.end);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Get provider metadata
   */
  async getProviderMetadata(doctorId) {
    const doctor = await this.getDoctorById(doctorId);

    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    return {
      id: doctor.id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      email: doctor.email,
      phone: doctor.phone,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      qualifications: doctor.qualifications,
      languages: doctor.languages,
      branch: doctor.branch,
      isAvailable: doctor.isAvailable,
      isActive: doctor.isActive,
      metadata: doctor.metadata,
    };
  }
}

module.exports = DoctorService;
