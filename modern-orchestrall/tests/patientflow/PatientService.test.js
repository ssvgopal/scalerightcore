const PatientService = require('../../src/patientflow/PatientService');
const { createMockPrisma } = require('./utils/mockPrisma');

describe('PatientService', () => {
  let patientService;
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    patientService = new PatientService(mockPrisma);
  });

  describe('lookupByPhone', () => {
    it('should find a patient by phone and organizationId', async () => {
      const mockPatient = {
        id: 'patient-1',
        organizationId: 'org-1',
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        preferences: {},
        appointments: [],
      };

      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await patientService.lookupByPhone('org-1', '+1-555-1000');

      expect(result).toEqual(mockPatient);
      expect(mockPrisma.patient.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_phone: {
            organizationId: 'org-1',
            phone: '+1-555-1000',
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
    });

    it('should throw error if organizationId is missing', async () => {
      await expect(patientService.lookupByPhone(null, '+1-555-1000')).rejects.toThrow(
        'organizationId and phone are required'
      );
    });

    it('should throw error if phone is missing', async () => {
      await expect(patientService.lookupByPhone('org-1', null)).rejects.toThrow(
        'organizationId and phone are required'
      );
    });

    it('should return null if patient not found', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      const result = await patientService.lookupByPhone('org-1', '+1-555-9999');

      expect(result).toBeNull();
    });
  });

  describe('createPatient', () => {
    it('should create a new patient successfully', async () => {
      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        dateOfBirth: '1985-05-15',
        gender: 'F',
      };

      const mockCreatedPatient = {
        id: 'patient-1',
        organizationId: 'org-1',
        ...patientData,
        preferences: null,
      };

      mockPrisma.patient.create.mockResolvedValue(mockCreatedPatient);

      const result = await patientService.createPatient('org-1', patientData);

      expect(result).toEqual(mockCreatedPatient);
      expect(mockPrisma.patient.create).toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      const incompleteData = {
        firstName: 'Alice',
        lastName: 'Johnson',
      };

      await expect(
        patientService.createPatient('org-1', incompleteData)
      ).rejects.toThrow('phone, firstName, and lastName are required');
    });

    it('should throw error if organizationId is missing', async () => {
      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
      };

      await expect(
        patientService.createPatient(null, patientData)
      ).rejects.toThrow('organizationId is required');
    });
  });

  describe('getOrCreatePatient', () => {
    it('should return existing patient if found', async () => {
      const existingPatient = {
        id: 'patient-1',
        organizationId: 'org-1',
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
        preferences: {},
        appointments: [],
      };

      mockPrisma.patient.findUnique.mockResolvedValue(existingPatient);

      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
      };

      const result = await patientService.getOrCreatePatient('org-1', patientData);

      expect(result).toEqual(existingPatient);
      expect(mockPrisma.patient.findUnique).toHaveBeenCalled();
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });

    it('should create new patient if not found', async () => {
      const newPatient = {
        id: 'patient-1',
        organizationId: 'org-1',
        phone: '+1-555-1000',
        firstName: 'Bob',
        lastName: 'Smith',
        preferences: null,
      };

      mockPrisma.patient.findUnique.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue(newPatient);

      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Bob',
        lastName: 'Smith',
      };

      const result = await patientService.getOrCreatePatient('org-1', patientData);

      expect(result).toEqual(newPatient);
      expect(mockPrisma.patient.findUnique).toHaveBeenCalled();
      expect(mockPrisma.patient.create).toHaveBeenCalled();
    });
  });

  describe('resolvePatientPreferences', () => {
    it('should return patient preferences', async () => {
      const mockPreferences = {
        id: 'pref-1',
        patientId: 'patient-1',
        preferredLanguage: 'en',
        preferredTimeSlots: ['morning'],
        reminderPreference: '24h',
        preferredChannels: ['phone', 'whatsapp'],
      };

      const mockPatient = {
        id: 'patient-1',
        firstName: 'Alice',
        preferences: mockPreferences,
      };

      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await patientService.resolvePatientPreferences('patient-1');

      expect(result).toEqual(mockPreferences);
    });

    it('should return default preferences if patient has none', async () => {
      const mockPatient = {
        id: 'patient-1',
        firstName: 'Alice',
        preferences: null,
      };

      mockPrisma.patient.findUnique.mockResolvedValue(mockPatient);

      const result = await patientService.resolvePatientPreferences('patient-1');

      expect(result).toEqual({
        preferredLanguage: 'en',
        preferredTimeSlots: ['morning', 'afternoon'],
        reminderPreference: '24h',
        preferredChannels: ['phone'],
      });
    });

    it('should throw error if patient not found', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(patientService.resolvePatientPreferences('patient-999')).rejects.toThrow(
        'Patient not found: patient-999'
      );
    });
  });

  describe('createOrUpdatePreferences', () => {
    it('should create new preferences if not exist', async () => {
      const newPreferences = {
        id: 'pref-1',
        patientId: 'patient-1',
        preferredLanguage: 'es',
        preferredTimeSlots: ['afternoon'],
        reminderPreference: '48h',
      };

      mockPrisma.patientPreference.findUnique.mockResolvedValue(null);
      mockPrisma.patientPreference.create.mockResolvedValue(newPreferences);

      const result = await patientService.createOrUpdatePreferences('patient-1', {
        preferredLanguage: 'es',
        preferredTimeSlots: ['afternoon'],
        reminderPreference: '48h',
      });

      expect(result).toEqual(newPreferences);
      expect(mockPrisma.patientPreference.create).toHaveBeenCalled();
    });

    it('should update existing preferences', async () => {
      const existingPrefs = {
        id: 'pref-1',
        patientId: 'patient-1',
        preferredLanguage: 'en',
      };

      const updatedPrefs = {
        ...existingPrefs,
        preferredLanguage: 'es',
      };

      mockPrisma.patientPreference.findUnique.mockResolvedValue(existingPrefs);
      mockPrisma.patientPreference.update.mockResolvedValue(updatedPrefs);

      const result = await patientService.createOrUpdatePreferences('patient-1', {
        preferredLanguage: 'es',
      });

      expect(result).toEqual(updatedPrefs);
      expect(mockPrisma.patientPreference.update).toHaveBeenCalled();
    });

    it('should throw error if patientId is missing', async () => {
      await expect(
        patientService.createOrUpdatePreferences(null, { preferredLanguage: 'es' })
      ).rejects.toThrow('patientId is required');
    });
  });

  describe('addPatientNote', () => {
    it('should add a note to patient', async () => {
      const mockNote = {
        id: 'note-1',
        patientId: 'patient-1',
        noteType: 'clinical',
        content: 'Patient report symptoms',
        createdBy: 'user-1',
        isPrivate: false,
      };

      mockPrisma.patientNote.create.mockResolvedValue(mockNote);

      const result = await patientService.addPatientNote('patient-1', {
        noteType: 'clinical',
        content: 'Patient report symptoms',
        createdBy: 'user-1',
      });

      expect(result).toEqual(mockNote);
      expect(mockPrisma.patientNote.create).toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      await expect(
        patientService.addPatientNote('patient-1', { noteType: 'clinical' })
      ).rejects.toThrow('noteType and content are required');
    });
  });

  describe('signupNewPatient', () => {
    it('should create a new patient with preferences', async () => {
      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@example.com',
        preferredLanguage: 'es',
        preferredTimeSlots: ['evening'],
        preferredChannels: ['whatsapp'],
      };

      const mockPatient = {
        id: 'patient-1',
        ...patientData,
        organizationId: 'org-1',
        status: 'active',
      };

      const mockPreferences = {
        id: 'pref-1',
        patientId: 'patient-1',
        preferredLanguage: 'es',
        preferredTimeSlots: ['evening'],
        preferredChannels: ['whatsapp'],
      };

      mockPrisma.patient.create.mockResolvedValue(mockPatient);
      mockPrisma.patientPreference.findUnique.mockResolvedValue(null);
      mockPrisma.patientPreference.create.mockResolvedValue(mockPreferences);

      const result = await patientService.signupNewPatient('org-1', patientData);

      expect(result.patient).toEqual(mockPatient);
      expect(result.preferences).toEqual(mockPreferences);
      expect(mockPrisma.patient.create).toHaveBeenCalled();
      expect(mockPrisma.patientPreference.create).toHaveBeenCalled();
    });
  });

  describe('updatePatientOptIns', () => {
    it('should update patient communication opt-ins', async () => {
      const updatedPatient = {
        id: 'patient-1',
        phoneOptIn: true,
        emailOptIn: false,
        smsOptIn: true,
        whatsappOptIn: true,
      };

      mockPrisma.patient.update.mockResolvedValue(updatedPatient);

      const result = await patientService.updatePatientOptIns('patient-1', {
        emailOptIn: false,
        whatsappOptIn: true,
      });

      expect(result).toEqual(updatedPatient);
      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'patient-1' },
        data: {
          emailOptIn: false,
          whatsappOptIn: true,
        },
      });
    });

    it('should only allow specific fields to be updated', async () => {
      mockPrisma.patient.update.mockResolvedValue({});

      await patientService.updatePatientOptIns('patient-1', {
        emailOptIn: false,
        firstName: 'Hacked', // This should be ignored
      });

      const callData = mockPrisma.patient.update.mock.calls[0][0].data;
      expect(callData.firstName).toBeUndefined();
      expect(callData.emailOptIn).toBe(false);
    });
  });

  describe('getPatientHistory', () => {
    it('should return complete patient history', async () => {
      const mockHistory = {
        id: 'patient-1',
        firstName: 'Alice',
        notes: [{ id: 'note-1', content: 'Test note' }],
        appointments: [{ id: 'apt-1', status: 'BOOKED' }],
        messageLogs: [{ id: 'msg-1', channel: 'WHATSAPP' }],
      };

      mockPrisma.patient.findUnique.mockResolvedValue(mockHistory);

      const result = await patientService.getPatientHistory('patient-1');

      expect(result.patient).toEqual(mockHistory);
      expect(result.notes).toEqual(mockHistory.notes);
      expect(result.appointments).toEqual(mockHistory.appointments);
      expect(result.messageLogs).toEqual(mockHistory.messageLogs);
    });

    it('should throw error if patient not found', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);

      await expect(patientService.getPatientHistory('patient-999')).rejects.toThrow(
        'Patient not found: patient-999'
      );
    });
  });
});
