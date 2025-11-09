const schemas = require('../../src/patientflow/validation/schemas');

describe('PatientFlow Validation Schemas', () => {
  describe('Phone Schema', () => {
    test('should validate valid phone numbers', () => {
      const validPhones = [
        '+1-503-555-0100',
        '+11234567890',
        '(503) 555-0100',
        '503-555-0100',
        '+1 503 555 0100',
      ];

      for (const phone of validPhones) {
        const result = schemas.phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
      }
    });

    test('should reject invalid phone numbers', () => {
      const invalidPhones = [
        'not-a-phone',
        '123', // too short
        '',
      ];

      for (const phone of invalidPhones) {
        const result = schemas.phoneSchema.safeParse(phone);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Patient Schema', () => {
    test('should validate complete patient data', () => {
      const patientData = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-503-555-0100',
        email: 'john@example.com',
        gender: 'M',
        allergies: ['Penicillin'],
        chronicConditions: ['Diabetes'],
      };

      const result = schemas.patientSchema.safeParse(patientData);
      expect(result.success).toBe(true);
    });

    test('should require firstName and lastName', () => {
      const patientData = {
        phone: '+1-503-555-0100',
      };

      const result = schemas.patientSchema.safeParse(patientData);
      expect(result.success).toBe(false);
      expect(result.error.errors.length).toBeGreaterThan(0);
    });

    test('should validate optional email field', () => {
      const patientData = {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-503-555-0101',
      };

      const result = schemas.patientSchema.safeParse(patientData);
      expect(result.success).toBe(true);
    });

    test('should reject invalid email', () => {
      const patientData = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-503-555-0100',
        email: 'not-an-email',
      };

      const result = schemas.patientSchema.safeParse(patientData);
      expect(result.success).toBe(false);
    });
  });

  describe('Appointment Booking Schema', () => {
    test('should validate complete appointment booking', () => {
      const appointmentData = {
        patientId: 'cuid-patient-123',
        doctorId: 'cuid-doctor-456',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T10:30:00Z',
        source: 'VOICE',
        channel: 'VOICE',
        reason: 'Regular checkup',
      };

      const result = schemas.appointmentBookingSchema.safeParse(appointmentData);
      expect(result.success).toBe(true);
    });

    test('should require patientId and doctorId', () => {
      const appointmentData = {
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T10:30:00Z',
      };

      const result = schemas.appointmentBookingSchema.safeParse(appointmentData);
      expect(result.success).toBe(false);
    });

    test('should validate source and channel enums', () => {
      const validData = {
        patientId: 'cuid-patient-123',
        doctorId: 'cuid-doctor-456',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T10:30:00Z',
        source: 'WHATSAPP',
        channel: 'WHATSAPP',
      };

      const result = schemas.appointmentBookingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    test('should reject invalid enum values', () => {
      const invalidData = {
        patientId: 'cuid-patient-123',
        doctorId: 'cuid-doctor-456',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T10:30:00Z',
        source: 'INVALID',
        channel: 'INVALID',
      };

      const result = schemas.appointmentBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Appointment Reschedule Schema', () => {
    test('should validate reschedule data', () => {
      const rescheduleData = {
        appointmentId: 'cuid-apt-789',
        startTime: '2024-12-21T11:00:00Z',
        endTime: '2024-12-21T11:30:00Z',
        reason: 'Patient requested',
      };

      const result = schemas.appointmentRescheduleSchema.safeParse(rescheduleData);
      expect(result.success).toBe(true);
    });
  });

  describe('Message Log Schema', () => {
    test('should validate message log', () => {
      const messageData = {
        patientId: 'cuid-patient-123',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        payload: {
          messageId: 'wa-msg-001',
          text: 'Hello',
        },
        externalMessageId: 'ext-msg-001',
      };

      const result = schemas.messageLogSchema.safeParse(messageData);
      expect(result.success).toBe(true);
    });

    test('should require channel and direction', () => {
      const messageData = {
        patientId: 'cuid-patient-123',
        payload: {},
      };

      const result = schemas.messageLogSchema.safeParse(messageData);
      expect(result.success).toBe(false);
    });
  });

  describe('Call Log Schema', () => {
    test('should validate call log', () => {
      const callData = {
        patientId: 'cuid-patient-123',
        callSid: 'twilio-call-123',
        status: 'COMPLETED',
        startTime: '2024-12-20T10:00:00Z',
        endTime: '2024-12-20T10:05:00Z',
        durationSeconds: 300,
        transcription: 'Call transcript...',
        summary: 'Call summary',
      };

      const result = schemas.callLogSchema.safeParse(callData);
      expect(result.success).toBe(true);
    });

    test('should validate call statuses', () => {
      const validStatuses = ['INITIATED', 'RINGING', 'ANSWERED', 'COMPLETED', 'FAILED', 'MISSED'];

      for (const status of validStatuses) {
        const callData = {
          patientId: 'cuid-patient-123',
          callSid: 'twilio-call-123',
          status,
          startTime: '2024-12-20T10:00:00Z',
        };

        const result = schemas.callLogSchema.safeParse(callData);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Availability Query Schema', () => {
    test('should validate availability query', () => {
      const queryData = {
        doctorId: 'cuid-doctor-123',
        date: '2024-12-20',
        durationMinutes: 30,
      };

      const result = schemas.availabilityQuerySchema.safeParse(queryData);
      expect(result.success).toBe(true);
    });

    test('should validate date format', () => {
      const validData = {
        doctorId: 'cuid-doctor-123',
        date: '2024-12-20',
      };

      const invalidData = {
        doctorId: 'cuid-doctor-123',
        date: '20/12/2024',
      };

      expect(schemas.availabilityQuerySchema.safeParse(validData).success).toBe(true);
      expect(schemas.availabilityQuerySchema.safeParse(invalidData).success).toBe(false);
    });
  });

  describe('Doctor Search Schema', () => {
    test('should validate doctor search filters', () => {
      const searchData = {
        branchId: 'cuid-branch-123',
        specialty: 'Cardiology',
        isAvailable: true,
      };

      const result = schemas.doctorSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });

    test('should allow partial filters', () => {
      const searchData = {
        specialty: 'Cardiology',
      };

      const result = schemas.doctorSearchSchema.safeParse(searchData);
      expect(result.success).toBe(true);
    });
  });

  describe('Patient Preference Schema', () => {
    test('should validate preference data', () => {
      const preferenceData = {
        preferredLanguage: 'en',
        preferredTimeSlots: ['morning', 'afternoon'],
        reminderPreference: '24h',
        preferredChannels: ['phone', 'sms'],
      };

      const result = schemas.patientPreferenceSchema.safeParse(preferenceData);
      expect(result.success).toBe(true);
    });

    test('should validate reminder preference values', () => {
      const validValues = ['24h', '48h', '1week', 'none'];

      for (const value of validValues) {
        const result = schemas.patientPreferenceSchema.safeParse({
          reminderPreference: value,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Conversation Session Schema', () => {
    test('should validate session data', () => {
      const sessionData = {
        patientPhone: '+1-503-555-0100',
        sessionKey: 'org-123:5035550100',
        stateJson: {
          stage: 'booking',
          doctorId: 'doctor-123',
        },
      };

      const result = schemas.conversationSessionSchema.safeParse(sessionData);
      expect(result.success).toBe(true);
    });
  });
});
