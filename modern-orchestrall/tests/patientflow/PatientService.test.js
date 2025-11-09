// tests/patientflow/PatientService.test.js - PatientService Unit Tests
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const PatientService = require('../../src/patientflow/PatientService');
const { createMockPrisma, createMockDatabase, createMockLogger, mockDate, resetAllMocks } = require('./mocks');
const { organization, patient, patientPreferences } = require('./fixtures');

describe('PatientService', () => {
  let patientService;
  let mockPrisma;
  let mockDatabase;
  let mockLogger;
  let restoreDate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPrisma = createMockPrisma();
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();
    
    // Mock the database module
    jest.doMock('../../src/database', () => mockDatabase);
    jest.doMock('../../src/utils/logger', () => mockLogger);
    
    patientService = new PatientService();
    patientService.prisma = mockPrisma;
    
    // Mock date
    restoreDate = mockDate('2024-12-15T10:00:00.000Z');
  });

  afterEach(() => {
    resetAllMocks();
    restoreDate();
    jest.resetModules();
  });

  describe('lookupByPhone', () => {
    test('should return patient when found', async () => {
      const organizationId = organization.id;
      const phone = '+12345678900';
      
      mockPrisma.patient.findFirst.mockResolvedValue({
        ...patient,
        preferences: patientPreferences,
        notes: [],
        appointments: []
      });

      const result = await patientService.lookupByPhone(organizationId, phone);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
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

      expect(result).toEqual({
        ...patient,
        preferences: patientPreferences,
        notes: [],
        appointments: []
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Patient lookup by phone', {
        organizationId,
        phone: '+1****9000',
        found: true
      });
    });

    test('should return null when patient not found', async () => {
      const organizationId = organization.id;
      const phone = '+12345678999';
      
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      const result = await patientService.lookupByPhone(organizationId, phone);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('Patient lookup by phone', {
        organizationId,
        phone: '+1****9999',
        found: false
      });
    });

    test('should handle database errors', async () => {
      const organizationId = organization.id;
      const phone = '+12345678900';
      
      mockPrisma.patient.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(patientService.lookupByPhone(organizationId, phone))
        .rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to lookup patient by phone', {
        organizationId,
        phone: '+1****9000',
        error: 'Database error'
      });
    });
  });

  describe('createPatient', () => {
    test('should create new patient with preferences', async () => {
      const patientData = {
        organizationId: organization.id,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+12345678900',
        email: 'john.doe@example.com',
        dateOfBirth: '1990-05-15',
        preferences: {
          preferredLanguage: 'english',
          preferredCommunicationChannel: 'whatsapp',
          appointmentReminders: true
        }
      };

      // Mock lookup to return null (patient doesn't exist)
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      
      // Mock transaction
      const mockTransaction = {
        patient: {
          create: jest.fn().mockResolvedValue(patient)
        },
        patientPreference: {
          create: jest.fn().mockResolvedValue(patientPreferences)
        }
      };
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTransaction);
      });

      const result = await patientService.createPatient(patientData);

      expect(mockTransaction.patient.create).toHaveBeenCalledWith({
        data: {
          organizationId: patientData.organizationId,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          phone: patientData.phone,
          email: patientData.email,
          dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
          address: undefined,
          emergencyContact: undefined
        }
      });

      expect(mockTransaction.patientPreference.create).toHaveBeenCalledWith({
        data: {
          patientId: patient.id,
          organizationId: patientData.organizationId,
          preferredLanguage: 'english',
          preferredCommunicationChannel: 'whatsapp',
          appointmentReminders: true,
          workingHours: {},
          metadata: patientData.preferences
        }
      });

      expect(result).toEqual(patient);
    });

    test('should throw error when patient already exists', async () => {
      const patientData = {
        organizationId: organization.id,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+12345678900'
      };

      // Mock lookup to return existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);

      await expect(patientService.createPatient(patientData))
        .rejects.toThrow('Patient with this phone number already exists');

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: organization.id,
          phone: '+12345678900'
        }
      });
    });

    test('should handle validation errors', async () => {
      const invalidPatientData = {
        organizationId: organization.id,
        firstName: '', // Invalid - empty string
        phone: '123' // Invalid - too short
      };

      await expect(patientService.createPatient(invalidPatientData))
        .rejects.toThrow();
    });
  });

  describe('getOrCreateByPhone', () => {
    test('should return existing patient when found', async () => {
      const organizationId = organization.id;
      const phone = '+12345678900';
      
      mockPrisma.patient.findFirst.mockResolvedValue(patient);

      const result = await patientService.getOrCreateByPhone(organizationId, phone);

      expect(result).toEqual({
        patient,
        isNew: false
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Existing patient found', {
        patientId: patient.id
      });
    });

    test('should create new patient when not found', async () => {
      const organizationId = organization.id;
      const phone = '+12345678900';
      const basicInfo = {
        firstName: 'New',
        lastName: 'Patient',
        email: 'new@example.com'
      };

      // Mock lookup to return null
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      
      // Mock createPatient
      const createPatientSpy = jest.spyOn(patientService, 'createPatient')
        .mockResolvedValue(patient);

      const result = await patientService.getOrCreateByPhone(organizationId, phone, basicInfo);

      expect(createPatientSpy).toHaveBeenCalledWith({
        organizationId,
        phone,
        firstName: 'New',
        lastName: 'Patient',
        email: 'new@example.com',
        preferences: {
          preferredLanguage: 'english',
          preferredCommunicationChannel: 'voice',
          appointmentReminders: true
        }
      });

      expect(result).toEqual({
        patient,
        isNew: true
      });

      expect(mockLogger.info).toHaveBeenCalledWith('New patient signup completed', {
        patientId: patient.id,
        organizationId,
        phone: '+1****9000'
      });
    });
  });

  describe('updatePatient', () => {
    test('should update patient information', async () => {
      const patientId = patient.id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      };

      const updatedPatient = {
        ...patient,
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      };

      mockPrisma.patient.update.mockResolvedValue(updatedPatient);

      const result = await patientService.updatePatient(patientId, updateData);

      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: patientId },
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          email: 'updated@example.com'
        }
      });

      expect(result).toEqual(updatedPatient);
      expect(mockLogger.info).toHaveBeenCalledWith('Patient updated', {
        patientId,
        fields: ['firstName', 'lastName', 'email']
      });
    });

    test('should handle partial updates', async () => {
      const patientId = patient.id;
      const updateData = {
        email: 'newemail@example.com'
      };

      mockPrisma.patient.update.mockResolvedValue({
        ...patient,
        email: 'newemail@example.com'
      });

      const result = await patientService.updatePatient(patientId, updateData);

      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: patientId },
        data: {
          email: 'newemail@example.com'
        }
      });

      expect(result.email).toBe('newemail@example.com');
    });
  });

  describe('getPatientPreferences', () => {
    test('should return patient preferences', async () => {
      const patientId = patient.id;
      
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);

      const result = await patientService.getPatientPreferences(patientId);

      expect(mockPrisma.patientPreference.findUnique).toHaveBeenCalledWith({
        where: { patientId }
      });

      expect(result).toEqual(patientPreferences);
    });

    test('should return null when preferences not found', async () => {
      const patientId = 'nonexistent-patient';
      
      mockPrisma.patientPreference.findUnique.mockResolvedValue(null);

      const result = await patientService.getPatientPreferences(patientId);

      expect(result).toBeNull();
    });
  });

  describe('updatePatientPreferences', () => {
    test('should update existing preferences', async () => {
      const patientId = patient.id;
      const preferences = {
        organizationId: organization.id,
        preferredLanguage: 'spanish',
        preferredCommunicationChannel: 'voice',
        appointmentReminders: false
      };

      const updatedPreferences = {
        ...patientPreferences,
        preferredLanguage: 'spanish',
        preferredCommunicationChannel: 'voice',
        appointmentReminders: false
      };

      mockPrisma.patientPreference.upsert.mockResolvedValue(updatedPreferences);

      const result = await patientService.updatePatientPreferences(patientId, preferences);

      expect(mockPrisma.patientPreference.upsert).toHaveBeenCalledWith({
        where: { patientId },
        update: {
          preferredLanguage: 'spanish',
          preferredCommunicationChannel: 'voice',
          appointmentReminders: false,
          workingHours: {},
          metadata: preferences
        },
        create: {
          patientId,
          organizationId: organization.id,
          preferredLanguage: 'spanish',
          preferredCommunicationChannel: 'voice',
          appointmentReminders: false,
          workingHours: {},
          metadata: preferences
        }
      });

      expect(result).toEqual(updatedPreferences);
    });

    test('should create new preferences when none exist', async () => {
      const patientId = 'new-patient-id';
      const preferences = {
        organizationId: organization.id,
        preferredLanguage: 'english',
        preferredCommunicationChannel: 'whatsapp',
        appointmentReminders: true
      };

      mockPrisma.patientPreference.upsert.mockResolvedValue({
        id: 'new-preferences-id',
        patientId,
        ...preferences
      });

      const result = await patientService.updatePatientPreferences(patientId, preferences);

      expect(mockPrisma.patientPreference.upsert).toHaveBeenCalledWith({
        where: { patientId },
        update: expect.any(Object),
        create: {
          patientId,
          organizationId: organization.id,
          preferredLanguage: 'english',
          preferredCommunicationChannel: 'whatsapp',
          appointmentReminders: true,
          workingHours: {},
          metadata: preferences
        }
      });

      expect(result.patientId).toBe(patientId);
    });
  });

  describe('addPatientNote', () => {
    test('should add note to patient record', async () => {
      const patientId = patient.id;
      const noteData = {
        noteType: 'clinical',
        content: 'Patient reports feeling better',
        createdBy: 'user-123',
        isPrivate: false
      };

      const expectedNote = {
        id: 'note-123',
        patientId,
        noteType: 'clinical',
        content: 'Patient reports feeling better',
        createdBy: 'user-123',
        isPrivate: false,
        createdAt: new Date()
      };

      mockPrisma.patientNote.create.mockResolvedValue(expectedNote);

      const result = await patientService.addPatientNote(patientId, noteData);

      expect(mockPrisma.patientNote.create).toHaveBeenCalledWith({
        data: {
          patientId,
          noteType: 'clinical',
          content: 'Patient reports feeling better',
          createdBy: 'user-123',
          isPrivate: false
        }
      });

      expect(result).toEqual(expectedNote);
      expect(mockLogger.info).toHaveBeenCalledWith('Patient note added', {
        patientId,
        noteId: 'note-123',
        noteType: 'clinical'
      });
    });

    test('should use default values for optional fields', async () => {
      const patientId = patient.id;
      const noteData = {
        content: 'Simple note'
      };

      mockPrisma.patientNote.create.mockResolvedValue({
        id: 'note-456',
        patientId,
        noteType: 'clinical', // default
        content: 'Simple note',
        createdBy: undefined,
        isPrivate: false // default
      });

      const result = await patientService.addPatientNote(patientId, noteData);

      expect(mockPrisma.patientNote.create).toHaveBeenCalledWith({
        data: {
          patientId,
          noteType: 'clinical',
          content: 'Simple note',
          createdBy: undefined,
          isPrivate: false
        }
      });
    });
  });

  describe('getPatientHistory', () => {
    test('should return comprehensive patient history', async () => {
      const patientId = patient.id;
      const options = { limit: 20, offset: 0 };

      const mockAppointments = [
        { id: 'apt-1', startTime: new Date(), doctor: { firstName: 'John', lastName: 'Doe' } }
      ];
      const mockNotes = [
        { id: 'note-1', content: 'Test note', createdAt: new Date() }
      ];
      const mockMessageLogs = [
        { id: 'msg-1', content: 'Test message', createdAt: new Date() }
      ];
      const mockCallLogs = [
        { id: 'call-1', status: 'completed', createdAt: new Date() }
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);
      mockPrisma.patientNote.findMany.mockResolvedValue(mockNotes);
      mockPrisma.patientMessageLog.findMany.mockResolvedValue(mockMessageLogs);
      mockPrisma.patientCallLog.findMany.mockResolvedValue(mockCallLogs);

      const result = await patientService.getPatientHistory(patientId, options);

      expect(result).toEqual({
        appointments: mockAppointments,
        notes: mockNotes,
        messageLogs: mockMessageLogs,
        callLogs: mockCallLogs
      });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { patientId },
        orderBy: { startTime: 'desc' },
        take: 20,
        skip: 0,
        include: {
          doctor: true
        }
      });
    });

    test('should use default options when none provided', async () => {
      const patientId = patient.id;

      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.patientNote.findMany.mockResolvedValue([]);
      mockPrisma.patientMessageLog.findMany.mockResolvedValue([]);
      mockPrisma.patientCallLog.findMany.mockResolvedValue([]);

      await patientService.getPatientHistory(patientId);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { patientId },
        orderBy: { startTime: 'desc' },
        take: 50, // default limit
        skip: 0,  // default offset
        include: {
          doctor: true
        }
      });
    });
  });
});