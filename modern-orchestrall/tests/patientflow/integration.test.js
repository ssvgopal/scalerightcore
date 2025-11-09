// tests/patientflow/integration.test.js - PatientFlow Integration Tests
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const supertest = require('supertest');
const Fastify = require('fastify');
const { PatientService, AppointmentService, ConversationOrchestrator, WebhookHandlers } = require('../../src/patientflow');
const { createMockPrisma, createMockDatabase, createMockLogger, mockDate, resetAllMocks } = require('./mocks');
const { 
  organization, 
  doctor, 
  doctorSchedule, 
  patient, 
  patientPreferences, 
  appointment,
  whatsappWebhookPayload,
  voiceWebhookPayload,
  testScenarios
} = require('./fixtures');

describe('PatientFlow Integration Tests', () => {
  let fastify;
  let mockPrisma;
  let mockDatabase;
  let patientService;
  let appointmentService;
  let orchestrator;
  let webhookHandlers;
  let restoreDate;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockPrisma = createMockPrisma();
    mockDatabase = createMockDatabase();
    
    // Mock dependencies
    jest.doMock('../../src/database', () => mockDatabase);
    jest.doMock('../../src/utils/logger', () => createMockLogger());
    
    // Initialize services
    patientService = new PatientService();
    appointmentService = new AppointmentService();
    orchestrator = new ConversationOrchestrator();
    webhookHandlers = new WebhookHandlers();
    
    // Manually set prisma clients
    patientService.prisma = mockPrisma;
    appointmentService.prisma = mockPrisma;
    orchestrator.patientService = patientService;
    orchestrator.appointmentService = appointmentService;
    webhookHandlers.orchestrator = orchestrator;
    
    // Initialize services
    await patientService.initialize();
    await appointmentService.initialize();
    await orchestrator.initialize();
    await webhookHandlers.initialize();
    
    // Mock date
    restoreDate = mockDate('2024-12-15T10:00:00.000Z');
    
    // Create Fastify instance
    fastify = Fastify({ logger: false });
    
    // Setup routes with auth middleware mock
    fastify.addHook('preHandler', async (req, reply) => {
      req.organizationId = organization.id; // Mock organization context
    });
    
    // PatientFlow routes
    fastify.post('/api/patientflow/webhooks/whatsapp', async (req, reply) => {
      return await webhookHandlers.handleWhatsAppWebhook(req, reply);
    });
    
    fastify.post('/api/patientflow/webhooks/voice', async (req, reply) => {
      return await webhookHandlers.handleVoiceWebhook(req, reply);
    });
    
    fastify.post('/api/patientflow/webhooks/voice/speech', async (req, reply) => {
      return await webhookHandlers.handleVoiceSpeechWebhook(req, reply);
    });
    
    // Direct service endpoints for testing
    fastify.post('/api/patientflow/patients', async (req, reply) => {
      const result = await patientService.createPatient(req.body);
      return reply.send(result);
    });
    
    fastify.get('/api/patientflow/patients/:phone', async (req, reply) => {
      const result = await patientService.lookupByPhone(organization.id, req.params.phone);
      return reply.send(result);
    });
    
    fastify.post('/api/patientflow/appointments', async (req, reply) => {
      const result = await appointmentService.createAppointment(req.body);
      return reply.send(result);
    });
    
    fastify.get('/api/patientflow/appointments/doctor/:doctorId/slots', async (req, reply) => {
      const { doctorId } = req.params;
      const { date, duration } = req.query;
      const result = await appointmentService.generateAvailableSlots(doctorId, date, parseInt(duration) || 30);
      return reply.send(result);
    });
    
    await fastify.ready();
  });

  afterEach(async () => {
    resetAllMocks();
    restoreDate();
    jest.resetModules();
    if (fastify) {
      await fastify.close();
    }
  });

  describe('New Patient Booking Flow', () => {
    test('should complete new patient booking via WhatsApp', async () => {
      // Mock patient lookup returns null (new patient)
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      
      // Mock patient creation
      const newPatient = { ...patient, id: 'new-patient-123' };
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          patient: { create: jest.fn().mockResolvedValue(newPatient) },
          patientPreference: { create: jest.fn().mockResolvedValue(patientPreferences) }
        };
        return await callback(tx);
      });
      
      // Mock preferences creation
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);
      
      // Mock doctor schedule
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      
      // Mock existing appointments (none)
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      
      // Mock appointment creation
      const newAppointment = { ...appointment, id: 'new-apt-123' };
      mockPrisma.appointment.create.mockResolvedValue(newAppointment);
      
      // Mock session creation
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-123',
        patientId: newPatient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      
      // Mock message logging
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-123' });
      
      // Send WhatsApp message
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: 'Hi, I want to book my first appointment'
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe('book_appointment');
      expect(response.body.response).toContain('Appointment confirmed');
      
      // Verify patient was created
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Verify appointment was created
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: organization.id,
          patientId: 'new-patient-123',
          doctorId: expect.any(String),
          status: 'BOOKED',
          source: 'WHATSAPP',
          channel: 'whatsapp'
        }),
        include: {
          patient: true,
          doctor: true
        }
      });
      
      // Verify interaction was logged
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalled();
    });

    test('should handle new patient with existing phone number', async () => {
      // Mock existing patient found
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);
      
      // Mock doctor schedule and slots
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      
      // Mock appointment creation
      mockPrisma.appointment.create.mockResolvedValue(appointment);
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-456',
        patientId: patient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-456' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: 'Book appointment for tomorrow'
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe('book_appointment');
      expect(response.body.response).toContain('Appointment confirmed');
      
      // Should not create new patient
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      
      // Should create appointment for existing patient
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: patient.id
        }),
        include: {
          patient: true,
          doctor: true
        }
      });
    });
  });

  describe('Existing Patient Reschedule Flow', () => {
    test('should complete appointment reschedule via WhatsApp', async () => {
      // Mock existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);
      
      // Mock existing appointment
      const existingAppointment = { ...appointment, status: 'BOOKED' };
      mockPrisma.appointment.findMany.mockResolvedValue([existingAppointment]);
      
      // Mock doctor schedule for new date
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]); // No conflicts for new slot
      
      // Mock reschedule transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...existingAppointment,
              startTime: new Date('2024-12-16T14:00:00.000Z')
            })
          },
          patientNote: { create: jest.fn().mockResolvedValue({ id: 'note-123' }) }
        };
        return await callback(tx);
      });
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-789',
        patientId: patient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-789' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: 'I need to move my appointment to tomorrow at 2pm'
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe('reschedule_appointment');
      expect(response.body.response).toContain('Appointment rescheduled');
      
      // Verify appointment was updated
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Verify note was added
      expect(mockPrisma.patientNote.create).toHaveBeenCalled();
    });
  });

  describe('Appointment Cancellation Flow', () => {
    test('should complete appointment cancellation via WhatsApp', async () => {
      // Mock existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      
      // Mock existing appointment
      const existingAppointment = { ...appointment, status: 'BOOKED' };
      mockPrisma.appointment.findMany.mockResolvedValue([existingAppointment]);
      
      // Mock cancellation transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...existingAppointment,
              status: 'CANCELLED'
            })
          },
          patientNote: { create: jest.fn().mockResolvedValue({ id: 'note-456' }) }
        };
        return await callback(tx);
      });
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-cancel',
        patientId: patient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-cancel' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: 'Cancel my appointment'
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe('cancel_appointment');
      expect(response.body.response).toContain('Appointment has been cancelled');
      
      // Verify appointment was cancelled
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      
      // Verify note was added
      expect(mockPrisma.patientNote.create).toHaveBeenCalled();
    });
  });

  describe('Voice Call Flow', () => {
    test('should handle voice call and return appropriate TwiML', async () => {
      // Mock existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      
      // Mock existing appointments
      mockPrisma.appointment.findMany.mockResolvedValue([appointment]);
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-voice',
        patientId: patient.id,
        channel: 'voice',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-voice' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice')
        .send(voiceWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.headers['content-type']).toMatch(/text\/xml/);
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say voice="alice">');
      expect(response.text).toContain('You have 1 upcoming appointment');
      expect(response.text).toContain('<Gather input="speech"');
      expect(response.text).toContain('</Response>');
    });

    test('should handle speech recognition results from voice call', async () => {
      // Mock existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      
      // Mock existing appointment for cancellation
      const existingAppointment = { ...appointment, status: 'BOOKED' };
      mockPrisma.appointment.findMany.mockResolvedValue([existingAppointment]);
      
      // Mock cancellation transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...existingAppointment,
              status: 'CANCELLED'
            })
          },
          patientNote: { create: jest.fn().mockResolvedValue({ id: 'note-voice-cancel' }) }
        };
        return await callback(tx);
      });
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-voice-speech',
        patientId: patient.id,
        channel: 'voice',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-voice-speech' });
      
      const speechPayload = {
        ...voiceWebhookPayload,
        SpeechResult: 'I want to cancel my appointment',
        Confidence: 0.92
      };
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice/speech')
        .send(speechPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.text).toContain('Your appointment has been cancelled');
      expect(response.text).toContain('<Gather input="speech"');
    });
  });

  describe('Direct Service API Tests', () => {
    test('should create patient directly via API', async () => {
      // Mock patient lookup returns null
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          patient: { create: jest.fn().mockResolvedValue(patient) },
          patientPreference: { create: jest.fn().mockResolvedValue(patientPreferences) }
        };
        return await callback(tx);
      });
      
      const patientData = {
        organizationId: organization.id,
        firstName: 'John',
        lastName: 'Doe',
        phone: '+12345678900',
        email: 'john.doe@example.com'
      };
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/patients')
        .send(patientData)
        .expect(200);
      
      expect(response.body).toEqual(patient);
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: organization.id,
          phone: '+12345678900'
        }
      });
    });

    test('should lookup patient by phone directly via API', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        ...patient,
        preferences: patientPreferences,
        notes: [],
        appointments: []
      });
      
      const response = await supertest(fastify.server)
        .get('/api/patientflow/patients/+12345678900')
        .expect(200);
      
      expect(response.body).toEqual({
        ...patient,
        preferences: patientPreferences,
        notes: [],
        appointments: []
      });
    });

    test('should generate available slots directly via API', async () => {
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      
      const response = await supertest(fastify.server)
        .get('/api/patientflow/appointments/doctor/doctor_123/slots?date=2024-12-16&duration=30')
        .expect(200);
      
      expect(response.body.slots).toBeDefined();
      expect(response.body.slots.length).toBeGreaterThan(0);
      expect(response.body.slots[0]).toHaveProperty('startTime');
      expect(response.body.slots[0]).toHaveProperty('endTime');
      expect(response.body.slots[0].available).toBe(true);
    });

    test('should create appointment directly via API', async () => {
      // Mock slot availability check
      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      
      // Mock appointment creation
      mockPrisma.appointment.create.mockResolvedValue(appointment);
      
      const appointmentData = {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: '2024-12-16T10:00:00.000Z',
        endTime: '2024-12-16T10:30:00.000Z',
        source: 'MANUAL',
        channel: 'voice'
      };
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/appointments')
        .send(appointmentData)
        .expect(200);
      
      expect(response.body).toEqual(appointment);
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: {
          ...appointmentData,
          startTime: new Date('2024-12-16T10:00:00.000Z'),
          endTime: new Date('2024-12-16T10:30:00.000Z'),
          status: 'BOOKED',
          metadata: {}
        },
        include: {
          patient: true,
          doctor: true
        }
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database errors gracefully in webhook', async () => {
      // Mock database error
      mockPrisma.patient.findFirst.mockRejectedValue(new Error('Database connection failed'));
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(500);
      
      expect(response.body).toEqual({
        error: 'Internal server error'
      });
    });

    test('should handle invalid signature in webhook', async () => {
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'invalid-signature')
        .expect(401);
      
      expect(response.body).toEqual({
        error: 'Invalid signature'
      });
    });

    test('should handle appointment conflicts gracefully', async () => {
      // Mock existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      mockPrisma.patientPreference.findResolvedValue(patientPreferences);
      
      // Mock slot conflict
      mockPrisma.appointment.findFirst.mockResolvedValue(appointment); // Existing appointment found
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: 'Book appointment for tomorrow at 10am'
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe('book_appointment');
      // Should handle conflict and suggest alternatives
    });
  });

  describe('Demo Flow Scenarios', () => {
    test('should complete demo scenario 1: New patient books first appointment', async () => {
      const scenario = testScenarios.newPatientBooking;
      
      // Setup mocks for new patient
      mockPrisma.patient.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          patient: { create: jest.fn().mockResolvedValue(patient) },
          patientPreference: { create: jest.fn().mockResolvedValue(patientPreferences) }
        };
        return await callback(tx);
      });
      
      // Setup mocks for appointment booking
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockResolvedValue(appointment);
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-demo-1',
        patientId: patient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-demo-1' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: scenario.input.message
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe(scenario.expectedIntent);
      expect(response.body.response).toContain('Appointment confirmed');
      
      // Verify all expected actions were performed
      expect(mockPrisma.$transaction).toHaveBeenCalled(); // create_patient
      expect(mockPrisma.appointment.create).toHaveBeenCalled(); // create_appointment
    });

    test('should complete demo scenario 2: Existing patient reschedules appointment', async () => {
      const scenario = testScenarios.existingPatientReschedule;
      
      // Setup mocks for existing patient
      mockPrisma.patient.findFirst.mockResolvedValue(patient);
      mockPrisma.patientPreference.findUnique.mockResolvedValue(patientPreferences);
      
      // Setup mocks for rescheduling
      const existingAppointment = { ...appointment, status: 'BOOKED' };
      mockPrisma.appointment.findMany.mockResolvedValue([existingAppointment]);
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue({
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: { start: '09:00', end: '17:00' }
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]); // No conflicts for new slot
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          appointment: {
            update: jest.fn().mockResolvedValue({
              ...existingAppointment,
              startTime: new Date('2024-12-16T14:00:00.000Z')
            })
          },
          patientNote: { create: jest.fn().mockResolvedValue({ id: 'note-demo-2' }) }
        };
        return await callback(tx);
      });
      
      // Mock session and logging
      mockPrisma.conversationSession.create.mockResolvedValue({
        id: 'session-demo-2',
        patientId: patient.id,
        channel: 'whatsapp',
        status: 'active'
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'log-demo-2' });
      
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send({
          ...whatsappWebhookPayload,
          Body: scenario.input.message
        })
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);
      
      expect(response.body.intent).toBe(scenario.expectedIntent);
      expect(response.body.response).toContain('Appointment rescheduled');
      
      // Verify all expected actions were performed
      expect(mockPrisma.appointment.findMany).toHaveBeenCalled(); // find_appointment
      expect(mockPrisma.$transaction).toHaveBeenCalled(); // reschedule_appointment
    });
  });
});