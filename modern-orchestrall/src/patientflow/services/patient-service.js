const { PrismaClient } = require('@prisma/client');

class PatientService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Lookup patient by phone number
   */
  async lookupByPhone(organizationId, phone) {
    const patient = await this.prisma.patient.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone,
        },
      },
      include: {
        preferences: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
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

    return patient;
  }

  /**
   * Create a new patient
   */
  async createPatient(organizationId, patientData) {
    const { phone, preferences, ...rest } = patientData;

    const patient = await this.prisma.patient.create({
      data: {
        organizationId,
        phone,
        ...rest,
        preferences: preferences ? {
          create: preferences,
        } : undefined,
      },
      include: {
        preferences: true,
      },
    });

    return patient;
  }

  /**
   * Update patient information
   */
  async updatePatient(patientId, updateData) {
    const { preferences, ...patientUpdate } = updateData;

    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...patientUpdate,
        preferences: preferences ? {
          update: preferences,
        } : undefined,
      },
      include: {
        preferences: true,
      },
    });

    return patient;
  }

  /**
   * Get patient profile with complete history
   */
  async getPatientProfile(patientId) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        preferences: true,
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        appointments: {
          orderBy: { startTime: 'desc' },
        },
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    return patient;
  }

  /**
   * Get or create patient preference
   */
  async getOrCreatePreference(patientId) {
    let preference = await this.prisma.patientPreference.findUnique({
      where: { patientId },
    });

    if (!preference) {
      preference = await this.prisma.patientPreference.create({
        data: {
          patientId,
          preferredLanguage: 'en',
          preferredTimeSlots: ['morning', 'afternoon'],
          reminderPreference: '24h',
          preferredChannels: ['phone'],
        },
      });
    }

    return preference;
  }

  /**
   * Update patient preference
   */
  async updatePreference(patientId, preferenceData) {
    const preference = await this.prisma.patientPreference.upsert({
      where: { patientId },
      update: preferenceData,
      create: {
        patientId,
        ...preferenceData,
      },
    });

    return preference;
  }

  /**
   * Add note to patient
   */
  async addNote(patientId, noteData) {
    const note = await this.prisma.patientNote.create({
      data: {
        patientId,
        ...noteData,
      },
    });

    return note;
  }

  /**
   * Get patient history
   */
  async getPatientHistory(patientId, limit = 50, offset = 0) {
    const [notes, appointments, messageLogs, callLogs] = await Promise.all([
      this.prisma.patientNote.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.appointment.findMany({
        where: { patientId },
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
        include: { doctor: { include: { branch: true } } },
      }),
      this.prisma.patientMessageLog.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.patientCallLog.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      notes,
      appointments,
      messageLogs,
      callLogs,
    };
  }

  /**
   * Search patients
   */
  async searchPatients(organizationId, query, limit = 20) {
    const patients = await this.prisma.patient.findMany({
      where: {
        organizationId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    return patients;
  }
}

module.exports = PatientService;
