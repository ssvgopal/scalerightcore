// tests/patientflow/ConversationOrchestrator.test.js - ConversationOrchestrator Unit Tests
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const ConversationOrchestrator = require('../../src/patientflow/ConversationOrchestrator');
const { createMockLogger, mockDate, resetAllMocks } = require('./mocks');
const { organization, patient, patientPreferences, appointment, doctor } = require('./fixtures');

describe('ConversationOrchestrator', () => {
  let orchestrator;
  let mockLogger;
  let mockPatientService;
  let mockAppointmentService;
  let restoreDate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = createMockLogger();
    
    // Mock PatientService
    mockPatientService = {
      initialize: jest.fn().mockResolvedValue(true),
      getOrCreateByPhone: jest.fn(),
      getPatientPreferences: jest.fn(),
      addPatientNote: jest.fn()
    };

    // Mock AppointmentService
    mockAppointmentService = {
      initialize: jest.fn().mockResolvedValue(true),
      generateAvailableSlots: jest.fn(),
      createAppointment: jest.fn(),
      rescheduleAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
      getPatientAppointments: jest.fn()
    };

    // Mock logger
    jest.doMock('../../src/utils/logger', () => mockLogger);
    
    orchestrator = new ConversationOrchestrator();
    orchestrator.patientService = mockPatientService;
    orchestrator.appointmentService = mockAppointmentService;
    
    // Mock date
    restoreDate = mockDate('2024-12-15T10:00:00.000Z');
  });

  afterEach(() => {
    resetAllMocks();
    restoreDate();
    jest.resetModules();
  });

  describe('initialize', () => {
    test('should initialize services on first call', async () => {
      await orchestrator.initialize();

      expect(mockPatientService.initialize).toHaveBeenCalled();
      expect(mockAppointmentService.initialize).toHaveBeenCalled();
      expect(orchestrator.initialized).toBe(true);
    });

    test('should not initialize twice', async () => {
      await orchestrator.initialize();
      await orchestrator.initialize(); // Second call

      expect(mockPatientService.initialize).toHaveBeenCalledTimes(1);
      expect(mockAppointmentService.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('processMessage', () => {
    test('should process booking intent for new patient', async () => {
      const organizationId = organization.id;
      const message = {
        phone: '+12345678900',
        channel: 'whatsapp',
        content: 'I want to book an appointment for tomorrow',
        messageId: 'msg-123'
      };

      const mockPatient = { ...patient, isNew: true };
      const mockPreferences = patientPreferences;
      
      mockPatientService.getOrCreateByPhone.mockResolvedValue({
        patient: mockPatient,
        isNew: true
      });
      mockPatientService.getPatientPreferences.mockResolvedValue(mockPreferences);
      mockAppointmentService.generateAvailableSlots.mockResolvedValue({
        slots: [
          {
            startTime: new Date('2024-12-16T10:00:00.000Z'),
            endTime: new Date('2024-12-16T10:30:00.000Z')
          }
        ]
      });
      mockAppointmentService.createAppointment.mockResolvedValue(appointment);

      const result = await orchestrator.processMessage(organizationId, message);

      expect(mockPatientService.getOrCreateByPhone).toHaveBeenCalledWith(
        organizationId,
        '+12345678900',
        undefined
      );

      expect(result.intent.type).toBe('book_appointment');
      expect(result.isNewPatient).toBe(true);
      expect(result.result.type).toBe('appointment_booked');
    });

    test('should process reschedule intent for existing patient', async () => {
      const organizationId = organization.id;
      const message = {
        phone: '+12345678900',
        channel: 'whatsapp',
        content: 'I need to reschedule my appointment',
        messageId: 'msg-456'
      };

      const mockPatient = { ...patient, isNew: false };
      const mockPreferences = patientPreferences;
      const existingAppointment = { ...appointment };
      
      mockPatientService.getOrCreateByPhone.mockResolvedValue({
        patient: mockPatient,
        isNew: false
      });
      mockPatientService.getPatientPreferences.mockResolvedValue(mockPreferences);
      mockAppointmentService.getPatientAppointments.mockResolvedValue([existingAppointment]);
      mockAppointmentService.generateAvailableSlots.mockResolvedValue({
        slots: [
          {
            startTime: new Date('2024-12-17T14:00:00.000Z'),
            endTime: new Date('2024-12-17T14:30:00.000Z')
          }
        ]
      });
      mockAppointmentService.rescheduleAppointment.mockResolvedValue({
        ...existingAppointment,
        startTime: new Date('2024-12-17T14:00:00.000Z')
      });

      const result = await orchestrator.processMessage(organizationId, message);

      expect(result.intent.type).toBe('reschedule_appointment');
      expect(result.isNewPatient).toBe(false);
      expect(result.result.type).toBe('appointment_rescheduled');
    });

    test('should process cancel intent', async () => {
      const organizationId = organization.id;
      const message = {
        phone: '+12345678900',
        channel: 'whatsapp',
        content: 'Cancel my appointment',
        messageId: 'msg-789'
      };

      const mockPatient = { ...patient };
      const existingAppointment = { ...appointment };
      
      mockPatientService.getOrCreateByPhone.mockResolvedValue({
        patient: mockPatient,
        isNew: false
      });
      mockAppointmentService.getPatientAppointments.mockResolvedValue([existingAppointment]);
      mockAppointmentService.cancelAppointment.mockResolvedValue({
        ...existingAppointment,
        status: 'CANCELLED'
      });

      const result = await orchestrator.processMessage(organizationId, message);

      expect(result.intent.type).toBe('cancel_appointment');
      expect(result.result.type).toBe('appointment_cancelled');
    });

    test('should process check appointments intent', async () => {
      const organizationId = organization.id;
      const message = {
        phone: '+12345678900',
        channel: 'whatsapp',
        content: 'When are my appointments?',
        messageId: 'msg-101'
      };

      const mockPatient = { ...patient };
      const appointments = [appointment];
      
      mockPatientService.getOrCreateByPhone.mockResolvedValue({
        patient: mockPatient,
        isNew: false
      });
      mockAppointmentService.getPatientAppointments.mockResolvedValue(appointments);

      const result = await orchestrator.processMessage(organizationId, message);

      expect(result.intent.type).toBe('check_appointments');
      expect(result.result.type).toBe('appointments_list');
      expect(result.result.appointments).toEqual(appointments);
    });
  });

  describe('analyzeIntent', () => {
    test('should detect booking intent correctly', async () => {
      const content = 'I want to book an appointment for tomorrow';
      const context = {
        patient,
        session: { stateJson: {} },
        preferences: patientPreferences,
        organizationId: organization.id
      };

      const intent = await orchestrator.analyzeIntent(content, context);

      expect(intent.type).toBe('book_appointment');
      expect(intent.confidence).toBeGreaterThan(0.8);
    });

    test('should detect reschedule intent correctly', async () => {
      const content = 'I need to change my appointment time';
      const context = {
        patient,
        session: { stateJson: {} },
        preferences: patientPreferences,
        organizationId: organization.id
      };

      const intent = await orchestrator.analyzeIntent(content, context);

      expect(intent.type).toBe('reschedule_appointment');
      expect(intent.confidence).toBeGreaterThan(0.8);
    });

    test('should detect cancel intent correctly', async () => {
      const content = 'Please cancel my appointment';
      const context = {
        patient,
        session: { stateJson: {} },
        preferences: patientPreferences,
        organizationId: organization.id
      };

      const intent = await orchestrator.analyzeIntent(content, context);

      expect(intent.type).toBe('cancel_appointment');
      expect(intent.confidence).toBeGreaterThan(0.8);
    });

    test('should detect check appointments intent correctly', async () => {
      const content = 'Show me my appointments';
      const context = {
        patient,
        session: { stateJson: {} },
        preferences: patientPreferences,
        organizationId: organization.id
      };

      const intent = await orchestrator.analyzeIntent(content, context);

      expect(intent.type).toBe('check_appointments');
      expect(intent.confidence).toBeGreaterThan(0.7);
    });

    test('should default to general inquiry for unknown intent', async () => {
      const content = 'Hello, how are you?';
      const context = {
        patient,
        session: { stateJson: {} },
        preferences: patientPreferences,
        organizationId: organization.id
      };

      const intent = await orchestrator.analyzeIntent(content, context);

      expect(intent.type).toBe('general_inquiry');
      expect(intent.confidence).toBe(0.7);
    });
  });

  describe('executeAction', () => {
    test('should handle booking intent successfully', async () => {
      const intent = {
        type: 'book_appointment',
        parameters: {
          doctorId: doctor.id,
          preferredDate: '2024-12-16',
          preferredTime: '10:00'
        }
      };

      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      mockAppointmentService.generateAvailableSlots.mockResolvedValue({
        slots: [
          {
            startTime: new Date('2024-12-16T10:00:00.000Z'),
            endTime: new Date('2024-12-16T10:30:00.000Z')
          }
        ]
      });

      mockAppointmentService.createAppointment.mockResolvedValue(appointment);

      const result = await orchestrator.executeAction(intent, context);

      expect(result.type).toBe('appointment_booked');
      expect(result.appointment).toEqual(appointment);
      expect(result.message).toContain('Appointment confirmed');
    });

    test('should handle no slots available for booking', async () => {
      const intent = {
        type: 'book_appointment',
        parameters: {
          doctorId: doctor.id,
          preferredDate: '2024-12-16'
        }
      };

      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      mockAppointmentService.generateAvailableSlots.mockResolvedValue({
        slots: []
      });

      const result = await orchestrator.executeAction(intent, context);

      expect(result.type).toBe('no_slots_available');
      expect(result.message).toContain('No available slots');
      expect(result.suggestedDates).toBeDefined();
    });

    test('should handle reschedule intent successfully', async () => {
      const intent = {
        type: 'reschedule_appointment',
        parameters: {
          appointmentId: appointment.id,
          newDate: '2024-12-17',
          newTime: '14:00'
        }
      };

      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      const existingAppointment = { ...appointment, doctor };
      
      mockAppointmentService.getPatientAppointments.mockResolvedValue([existingAppointment]);
      mockAppointmentService.generateAvailableSlots.mockResolvedValue({
        slots: [
          {
            startTime: new Date('2024-12-17T14:00:00.000Z'),
            endTime: new Date('2024-12-17T14:30:00.000Z')
          }
        ]
      });

      mockAppointmentService.rescheduleAppointment.mockResolvedValue({
        ...existingAppointment,
        startTime: new Date('2024-12-17T14:00:00.000Z')
      });

      const result = await orchestrator.executeAction(intent, context);

      expect(result.type).toBe('appointment_rescheduled');
      expect(result.appointment).toBeDefined();
      expect(result.message).toContain('Appointment rescheduled');
    });

    test('should handle cancel intent successfully', async () => {
      const intent = {
        type: 'cancel_appointment',
        parameters: {}
      };

      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      const existingAppointment = { ...appointment };
      
      mockAppointmentService.getPatientAppointments.mockResolvedValue([existingAppointment]);
      mockAppointmentService.cancelAppointment.mockResolvedValue({
        ...existingAppointment,
        status: 'CANCELLED'
      });

      const result = await orchestrator.executeAction(intent, context);

      expect(result.type).toBe('appointment_cancelled');
      expect(result.message).toContain('Appointment has been cancelled');
    });

    test('should handle no appointments found for cancel', async () => {
      const intent = {
        type: 'cancel_appointment',
        parameters: {}
      };

      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      mockAppointmentService.getPatientAppointments.mockResolvedValue([]);

      const result = await orchestrator.executeAction(intent, context);

      expect(result.type).toBe('no_appointment_found');
      expect(result.message).toContain('No upcoming appointments');
    });
  });

  describe('stubLLMResponse', () => {
    test('should extract booking parameters correctly', () => {
      const content = 'I want to book an appointment for tomorrow at 10am';
      const context = { patient, session: {}, preferences: {}, organizationId: organization.id };

      const intent = orchestrator.stubLLMResponse(content, context);

      expect(intent.type).toBe('book_appointment');
      expect(intent.parameters.preferredDate).toBe('tomorrow');
      expect(intent.parameters.preferredTime).toBe('10am');
    });

    test('should extract reschedule parameters correctly', () => {
      const content = 'I need to reschedule appointment 123 to next week at 2pm';
      const context = { patient, session: {}, preferences: {}, organizationId: organization.id };

      const intent = orchestrator.stubLLMResponse(content, context);

      expect(intent.type).toBe('reschedule_appointment');
      expect(intent.parameters.appointmentId).toBe('123');
      expect(intent.parameters.newDate).toBe('next week');
      expect(intent.parameters.newTime).toBe('2pm');
    });

    test('should extract cancel parameters correctly', () => {
      const content = 'Cancel my appointment apt-456';
      const context = { patient, session: {}, preferences: {}, organizationId: organization.id };

      const intent = orchestrator.stubLLMResponse(content, context);

      expect(intent.type).toBe('cancel_appointment');
      expect(intent.parameters.appointmentId).toBe('456');
    });
  });

  describe('getSuggestedDates', () => {
    test('should return suggested dates', async () => {
      const doctorId = doctor.id;
      const currentDate = '2024-12-15';

      const suggestions = await orchestrator.getSuggestedDates(doctorId, currentDate);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('2024-12-16');
      expect(suggestions[1]).toBe('2024-12-17');
      expect(suggestions[2]).toBe('2024-12-18');
    });
  });

  describe('error handling', () => {
    test('should handle processMessage errors gracefully', async () => {
      const organizationId = organization.id;
      const message = {
        phone: '+12345678900',
        channel: 'whatsapp',
        content: 'test message',
        messageId: 'msg-error'
      };

      mockPatientService.getOrCreateByPhone.mockRejectedValue(new Error('Database error'));

      await expect(orchestrator.processMessage(organizationId, message))
        .rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process message',
        expect.objectContaining({
          error: 'Database error'
        })
      );
    });

    test('should handle executeAction errors gracefully', async () => {
      const intent = { type: 'book_appointment', parameters: {} };
      const context = {
        patient,
        session: { id: 'session-123' },
        message: { channel: 'whatsapp' },
        organizationId: organization.id
      };

      mockAppointmentService.generateAvailableSlots.mockRejectedValue(new Error('Service error'));

      await expect(orchestrator.executeAction(intent, context))
        .rejects.toThrow('Service error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to execute action',
        expect.objectContaining({
          error: 'Service error'
        })
      );
    });
  });
});