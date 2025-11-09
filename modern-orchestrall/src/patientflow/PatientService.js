// src/patientflow/PatientService.js - Patient Management Service
const { z } = require('zod');
const logger = require('../utils/logger');
const database = require('../database');

// Validation schemas
const createPatientSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email format').optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional()
  }).optional(),
  preferences: z.object({
    preferredLanguage: z.string().default('english'),
    preferredCommunicationChannel: z.enum(['whatsapp', 'voice', 'email']).default('voice'),
    appointmentReminders: z.boolean().default(true),
    workingHours: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional()
  }).optional()
});

const updatePatientSchema = createPatientSchema.partial();

class PatientService {
  constructor() {
    this.prisma = null;
  }

  async initialize() {
    this.prisma = database.client;
  }

  /**
   * Lookup patient by phone number within an organization
   */
  async lookupByPhone(organizationId, phone) {
    try {
      const patient = await this.prisma.patient.findFirst({
        where: {
          organizationId,
          phone
        },
        include: {
          preferences: true,
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          appointments: {
            orderBy: { startTime: 'desc' },
            take: 3
          }
        }
      });

      logger.info('Patient lookup by phone', {
        organizationId,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // Mask phone
        found: !!patient
      });

      return patient;
    } catch (error) {
      logger.error('Failed to lookup patient by phone', { organizationId, phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), error: error.message });
      throw error;
    }
  }

  /**
   * Create a new patient with preferences
   */
  async createPatient(patientData) {
    try {
      const validatedData = createPatientSchema.parse(patientData);
      
      // Check if patient already exists
      const existingPatient = await this.lookupByPhone(validatedData.organizationId, validatedData.phone);
      if (existingPatient) {
        throw new Error('Patient with this phone number already exists');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Create patient
        const patient = await tx.patient.create({
          data: {
            organizationId: validatedData.organizationId,
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            phone: validatedData.phone,
            email: validatedData.email,
            dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
            address: validatedData.address,
            emergencyContact: validatedData.emergencyContact || {}
          }
        });

        // Create patient preferences if provided
        if (validatedData.preferences) {
          await tx.patientPreference.create({
            data: {
              patientId: patient.id,
              organizationId: validatedData.organizationId,
              preferredLanguage: validatedData.preferences.preferredLanguage,
              preferredCommunicationChannel: validatedData.preferences.preferredCommunicationChannel,
              appointmentReminders: validatedData.preferences.appointmentReminders,
              workingHours: validatedData.preferences.workingHours || {},
              metadata: validatedData.preferences
            }
          });
        }

        return patient;
      });

      logger.info('New patient created', {
        patientId: result.id,
        organizationId: validatedData.organizationId,
        phone: validatedData.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      });

      return result;
    } catch (error) {
      logger.error('Failed to create patient', { patientData, error: error.message });
      throw error;
    }
  }

  /**
   * Get or create patient by phone (for new patient signup flow)
   */
  async getOrCreateByPhone(organizationId, phone, basicInfo = {}) {
    try {
      // First try to find existing patient
      let patient = await this.lookupByPhone(organizationId, phone);
      
      if (patient) {
        logger.info('Existing patient found', { patientId: patient.id });
        return { patient, isNew: false };
      }

      // Create new patient with minimal info
      const newPatientData = {
        organizationId,
        phone,
        firstName: basicInfo.firstName || 'New',
        lastName: basicInfo.lastName || 'Patient',
        email: basicInfo.email,
        preferences: {
          preferredLanguage: basicInfo.preferredLanguage || 'english',
          preferredCommunicationChannel: basicInfo.preferredCommunicationChannel || 'voice',
          appointmentReminders: true
        }
      };

      patient = await this.createPatient(newPatientData);
      
      logger.info('New patient signup completed', {
        patientId: patient.id,
        organizationId,
        phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      });

      return { patient, isNew: true };
    } catch (error) {
      logger.error('Failed to get or create patient', { organizationId, phone: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), error: error.message });
      throw error;
    }
  }

  /**
   * Update patient information
   */
  async updatePatient(patientId, updateData) {
    try {
      const validatedData = updatePatientSchema.parse(updateData);
      
      const patient = await this.prisma.patient.update({
        where: { id: patientId },
        data: {
          ...(validatedData.firstName && { firstName: validatedData.firstName }),
          ...(validatedData.lastName && { lastName: validatedData.lastName }),
          ...(validatedData.email && { email: validatedData.email }),
          ...(validatedData.dateOfBirth && { dateOfBirth: new Date(validatedData.dateOfBirth) }),
          ...(validatedData.address && { address: validatedData.address }),
          ...(validatedData.emergencyContact && { emergencyContact: validatedData.emergencyContact })
        }
      });

      logger.info('Patient updated', { patientId, fields: Object.keys(validatedData) });
      return patient;
    } catch (error) {
      logger.error('Failed to update patient', { patientId, updateData, error: error.message });
      throw error;
    }
  }

  /**
   * Get patient preferences
   */
  async getPatientPreferences(patientId) {
    try {
      const preferences = await this.prisma.patientPreference.findUnique({
        where: { patientId }
      });

      return preferences;
    } catch (error) {
      logger.error('Failed to get patient preferences', { patientId, error: error.message });
      throw error;
    }
  }

  /**
   * Update patient preferences
   */
  async updatePatientPreferences(patientId, preferences) {
    try {
      const result = await this.prisma.patientPreference.upsert({
        where: { patientId },
        update: {
          preferredLanguage: preferences.preferredLanguage,
          preferredCommunicationChannel: preferences.preferredCommunicationChannel,
          appointmentReminders: preferences.appointmentReminders,
          workingHours: preferences.workingHours || {},
          metadata: preferences
        },
        create: {
          patientId,
          organizationId: preferences.organizationId,
          preferredLanguage: preferences.preferredLanguage || 'english',
          preferredCommunicationChannel: preferences.preferredCommunicationChannel || 'voice',
          appointmentReminders: preferences.appointmentReminders ?? true,
          workingHours: preferences.workingHours || {},
          metadata: preferences
        }
      });

      logger.info('Patient preferences updated', { patientId });
      return result;
    } catch (error) {
      logger.error('Failed to update patient preferences', { patientId, preferences, error: error.message });
      throw error;
    }
  }

  /**
   * Add a note to patient record
   */
  async addPatientNote(patientId, noteData) {
    try {
      const note = await this.prisma.patientNote.create({
        data: {
          patientId,
          noteType: noteData.noteType || 'clinical',
          content: noteData.content,
          createdBy: noteData.createdBy,
          isPrivate: noteData.isPrivate || false
        }
      });

      logger.info('Patient note added', { patientId, noteId: note.id, noteType: note.noteType });
      return note;
    } catch (error) {
      logger.error('Failed to add patient note', { patientId, noteData, error: error.message });
      throw error;
    }
  }

  /**
   * Get patient history
   */
  async getPatientHistory(patientId, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const [appointments, notes, messageLogs, callLogs] = await Promise.all([
        this.prisma.appointment.findMany({
          where: { patientId },
          orderBy: { startTime: 'desc' },
          take: limit,
          skip: offset,
          include: {
            doctor: true
          }
        }),
        this.prisma.patientNote.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.patientMessageLog.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.patientCallLog.findMany({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        })
      ]);

      return {
        appointments,
        notes,
        messageLogs,
        callLogs
      };
    } catch (error) {
      logger.error('Failed to get patient history', { patientId, error: error.message });
      throw error;
    }
  }
}

module.exports = PatientService;