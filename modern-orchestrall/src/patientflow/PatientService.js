const { PrismaClient } = require('@prisma/client');

class PatientService {
  constructor(prisma = null) {
    this.prisma = prisma || new PrismaClient();
  }

  async lookupByPhone(organizationId, phone) {
    if (!organizationId || !phone) {
      throw new Error('organizationId and phone are required');
    }

    return this.prisma.patient.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone,
        },
      },
      include: {
        preferences: true,
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 5,
        },
      },
    });
  }

  async createPatient(organizationId, patientData) {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const { phone, firstName, lastName, email, dateOfBirth, gender, ...rest } = patientData;

    if (!phone || !firstName || !lastName) {
      throw new Error('phone, firstName, and lastName are required');
    }

    const patient = await this.prisma.patient.create({
      data: {
        organizationId,
        phone,
        firstName,
        lastName,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        ...rest,
      },
      include: {
        preferences: true,
      },
    });

    return patient;
  }

  async getOrCreatePatient(organizationId, patientData) {
    const existingPatient = await this.lookupByPhone(organizationId, patientData.phone);

    if (existingPatient) {
      return existingPatient;
    }

    return this.createPatient(organizationId, patientData);
  }

  async resolvePatientPreferences(patientId) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        preferences: true,
      },
    });

    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }

    return patient.preferences || {
      preferredLanguage: 'en',
      preferredTimeSlots: ['morning', 'afternoon'],
      reminderPreference: '24h',
      preferredChannels: ['phone'],
    };
  }

  async createOrUpdatePreferences(patientId, preferences) {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const existingPreference = await this.prisma.patientPreference.findUnique({
      where: { patientId },
    });

    if (existingPreference) {
      return this.prisma.patientPreference.update({
        where: { patientId },
        data: preferences,
      });
    }

    return this.prisma.patientPreference.create({
      data: {
        patientId,
        ...preferences,
      },
    });
  }

  async addPatientNote(patientId, noteData) {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const { noteType, content, createdBy, isPrivate } = noteData;

    if (!noteType || !content) {
      throw new Error('noteType and content are required');
    }

    return this.prisma.patientNote.create({
      data: {
        patientId,
        noteType,
        content,
        createdBy,
        isPrivate: isPrivate || false,
      },
    });
  }

  async getPatientHistory(patientId, limit = 10) {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          take: limit,
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: limit,
        },
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          take: limit,
        },
      },
    });

    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`);
    }

    return {
      patient,
      notes: patient.notes,
      appointments: patient.appointments,
      messageLogs: patient.messageLogs,
    };
  }

  async updatePatientOptIns(patientId, optIns) {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const allowedFields = ['phoneOptIn', 'emailOptIn', 'smsOptIn', 'whatsappOptIn'];
    const sanitizedOptIns = {};

    for (const field of allowedFields) {
      if (field in optIns) {
        sanitizedOptIns[field] = optIns[field];
      }
    }

    return this.prisma.patient.update({
      where: { id: patientId },
      data: sanitizedOptIns,
    });
  }

  async signupNewPatient(organizationId, patientData) {
    const patient = await this.createPatient(organizationId, {
      ...patientData,
      status: 'active',
    });

    const preferences = await this.createOrUpdatePreferences(patient.id, {
      preferredLanguage: patientData.preferredLanguage || 'en',
      preferredTimeSlots: patientData.preferredTimeSlots || ['morning', 'afternoon'],
      preferredChannels: patientData.preferredChannels || ['phone'],
    });

    return { patient, preferences };
  }
}

module.exports = PatientService;
