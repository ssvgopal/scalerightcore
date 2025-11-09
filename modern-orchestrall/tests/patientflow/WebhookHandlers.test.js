// tests/patientflow/WebhookHandlers.test.js - WebhookHandlers Unit Tests
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const WebhookHandlers = require('../../src/patientflow/WebhookHandlers');
const { createMockRequest, createMockReply, mockCrypto, resetAllMocks } = require('./mocks');
const { whatsappWebhookPayload, voiceWebhookPayload, voiceSpeechPayload, organization, patient, appointment } = require('./fixtures');
const supertest = require('supertest');
const Fastify = require('fastify');

describe('WebhookHandlers', () => {
  let webhookHandlers;
  let mockOrchestrator;
  let fastify;
  let restoreCrypto;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock crypto
    restoreCrypto = mockCrypto();
    
    // Mock orchestrator
    mockOrchestrator = {
      initialize: jest.fn().mockResolvedValue(true),
      processMessage: jest.fn()
    };

    webhookHandlers = new WebhookHandlers();
    webhookHandlers.orchestrator = mockOrchestrator;
    await webhookHandlers.initialize();

    // Create Fastify instance for integration testing
    fastify = Fastify({ logger: false });
    
    // Setup routes
    fastify.post('/api/patientflow/webhooks/whatsapp', async (req, reply) => {
      req.organizationId = organization.id; // Mock auth middleware
      return await webhookHandlers.handleWhatsAppWebhook(req, reply);
    });

    fastify.post('/api/patientflow/webhooks/voice', async (req, reply) => {
      req.organizationId = organization.id; // Mock auth middleware
      return await webhookHandlers.handleVoiceWebhook(req, reply);
    });

    fastify.post('/api/patientflow/webhooks/voice/speech', async (req, reply) => {
      req.organizationId = organization.id; // Mock auth middleware
      return await webhookHandlers.handleVoiceSpeechWebhook(req, reply);
    });

    await fastify.ready();
  });

  afterEach(async () => {
    resetAllMocks();
    restoreCrypto();
    if (fastify) {
      await fastify.close();
    }
  });

  describe('handleWhatsAppWebhook', () => {
    test('should process valid WhatsApp webhook successfully', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-123' },
        intent: { type: 'book_appointment', confidence: 0.95 },
        result: { type: 'appointment_booked', appointment },
        isNewPatient: false
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Processed successfully',
        intent: 'book_appointment',
        response: expect.stringContaining('Appointment confirmed')
      });

      expect(mockOrchestrator.processMessage).toHaveBeenCalledWith(
        organization.id,
        {
          phone: '+12345678900',
          channel: 'whatsapp',
          content: 'I want to book an appointment for tomorrow',
          messageId: 'WA_TEST_MESSAGE_SID_12345',
          to: '+12345678999',
          hasMedia: false
        },
        {
          source: 'webhook',
          timestamp: expect.any(Date)
        }
      );
    });

    test('should reject webhook with invalid signature', async () => {
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'invalid-signature')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid signature'
      });

      expect(mockOrchestrator.processMessage).not.toHaveBeenCalled();
    });

    test('should handle duplicate messages', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-123' },
        intent: { type: 'book_appointment' },
        result: { type: 'appointment_booked' }
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

      // First request
      await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      // Second request with same MessageSid (duplicate)
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Duplicate ignored'
      });

      // Should only call processMessage once
      expect(mockOrchestrator.processMessage).toHaveBeenCalledTimes(1);
    });

    test('should handle webhook processing errors', async () => {
      mockOrchestrator.processMessage.mockRejectedValue(new Error('Processing error'));

      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/whatsapp')
        .send(whatsappWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error'
      });
    });
  });

  describe('handleVoiceWebhook', () => {
    test('should process voice webhook and return TwiML', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-456' },
        intent: { type: 'check_appointments', confidence: 0.9 },
        result: { type: 'appointments_list', appointments: [appointment] }
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

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

      expect(mockOrchestrator.processMessage).toHaveBeenCalledWith(
        organization.id,
        {
          phone: '+12345678900',
          channel: 'voice',
          content: 'ringing',
          messageId: 'CA_TEST_CALL_SID_12345',
          to: '+12345678999',
          callStatus: 'ringing'
        },
        {
          source: 'webhook',
          timestamp: expect.any(Date),
          callFlow: true
        }
      );
    });

    test('should reject voice webhook with invalid signature', async () => {
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice')
        .send(voiceWebhookPayload)
        .set('x-twilio-signature', 'invalid-signature')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid signature'
      });
    });

    test('should handle duplicate voice calls', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-456' },
        intent: { type: 'general_inquiry' },
        result: { type: 'general_response' }
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

      // First call
      await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice')
        .send(voiceWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      // Second call with same CallSid (duplicate)
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice')
        .send(voiceWebhookPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Duplicate ignored'
      });

      expect(mockOrchestrator.processMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleVoiceSpeechWebhook', () => {
    test('should process speech recognition results', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-789' },
        intent: { type: 'cancel_appointment', confidence: 0.92 },
        result: { type: 'appointment_cancelled' }
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice/speech')
        .send(voiceSpeechPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/xml/);
      expect(response.text).toContain('Your appointment has been cancelled');

      expect(mockOrchestrator.processMessage).toHaveBeenCalledWith(
        organization.id,
        {
          phone: '+12345678900',
          channel: 'voice',
          content: 'I want to cancel my appointment',
          messageId: 'CA_TEST_CALL_SID_SPEECH_123',
          to: '+12345678999',
          speechResult: true
        },
        {
          source: 'speech',
          timestamp: expect.any(Date)
        }
      );
    });

    test('should handle duplicate speech results', async () => {
      const mockResult = {
        patient,
        session: { id: 'session-789' },
        intent: { type: 'general_inquiry' },
        result: { type: 'general_response' }
      };

      mockOrchestrator.processMessage.mockResolvedValue(mockResult);

      // First speech result
      await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice/speech')
        .send(voiceSpeechPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      // Second speech result with same CallSid (duplicate)
      const response = await supertest(fastify.server)
        .post('/api/patientflow/webhooks/voice/speech')
        .send(voiceSpeechPayload)
        .set('x-twilio-signature', 'valid-signature')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Duplicate ignored'
      });

      expect(mockOrchestrator.processMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('response generation', () => {
    test('should generate WhatsApp response for booking', () => {
      const result = {
        intent: { type: 'book_appointment' },
        result: {
          type: 'appointment_booked',
          appointment: {
            ...appointment,
            doctor: { firstName: 'John', lastName: 'Smith' },
            startTime: new Date('2024-12-15T10:00:00.000Z')
          }
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('✅ Your appointment has been confirmed');
      expect(response).toContain('12/15/2024');
      expect(response).toContain('10:00');
      expect(response).toContain('Dr. John Smith');
    });

    test('should generate WhatsApp response for rescheduling', () => {
      const result = {
        intent: { type: 'reschedule_appointment' },
        result: {
          type: 'appointment_rescheduled',
          appointment: {
            ...appointment,
            doctor: { firstName: 'John', lastName: 'Smith' },
            startTime: new Date('2024-12-16T14:00:00.000Z')
          }
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('🔄 Your appointment has been rescheduled');
      expect(response).toContain('12/16/2024');
      expect(response).toContain('2:00');
    });

    test('should generate WhatsApp response for cancellation', () => {
      const result = {
        intent: { type: 'cancel_appointment' },
        result: {
          type: 'appointment_cancelled'
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('❌ Your appointment has been cancelled');
      expect(response).toContain('Would you like to book a new appointment');
    });

    test('should generate WhatsApp response for appointments list', () => {
      const result = {
        intent: { type: 'check_appointments' },
        result: {
          type: 'appointments_list',
          appointments: [
            {
              ...appointment,
              doctor: { firstName: 'John', lastName: 'Smith' },
              startTime: new Date('2024-12-15T10:00:00.000Z')
            }
          ]
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('📅 You have 1 upcoming appointment');
      expect(response).toContain('1. 12/15/2024 at 10:00');
      expect(response).toContain('with Dr. John Smith');
    });

    test('should generate WhatsApp response for no appointments', () => {
      const result = {
        intent: { type: 'check_appointments' },
        result: {
          type: 'appointments_list',
          appointments: []
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('📅 You have no upcoming appointments');
      expect(response).toContain('Would you like to book one?');
    });

    test('should generate WhatsApp response for no slots available', () => {
      const result = {
        intent: { type: 'book_appointment' },
        result: {
          type: 'no_slots_available',
          suggestedDates: ['2024-12-17', '2024-12-18', '2024-12-19']
        }
      };

      const response = webhookHandlers.generateWhatsAppResponse(result);

      expect(response).toContain('🤔 Sorry, no available slots found');
      expect(response).toContain('Available dates:');
      expect(response).toContain('• 2024-12-17');
    });
  });

  describe('TwiML generation', () => {
    test('should generate TwiML for booking confirmation', () => {
      const result = {
        intent: { type: 'book_appointment' },
        result: {
          type: 'appointment_booked',
          appointment: {
            ...appointment,
            doctor: { firstName: 'John', lastName: 'Smith' },
            startTime: new Date('2024-12-15T10:00:00.000Z')
          }
        }
      };

      const twiml = webhookHandlers.generateVoiceResponse(result);

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say voice="alice">');
      expect(twiml).toContain('Your appointment has been confirmed');
      expect(twiml).toContain('12/15/2024 at 10:00');
      expect(twiml).toContain('Doctor John Smith');
      expect(twiml).toContain('<Gather input="speech"');
      expect(twiml).toContain('</Response>');
    });

    test('should generate TwiML for general inquiry', () => {
      const result = {
        intent: { type: 'general_inquiry' },
        result: {
          type: 'general_response'
        }
      };

      const twiml = webhookHandlers.generateVoiceResponse(result);

      expect(twiml).toContain('Hello! I can help you book, reschedule, or cancel appointments');
      expect(twiml).toContain('<Gather input="speech"');
    });
  });

  describe('signature validation', () => {
    test('should validate signature correctly', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'valid-signature';

      // Mock crypto.timingSafeEqual to return true for valid signature
      global.crypto.timingSafeEqual.mockReturnValue(true);

      const isValid = webhookHandlers.validateSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'invalid-signature';

      // Mock crypto.timingSafeEqual to return false for invalid signature
      global.crypto.timingSafeEqual.mockReturnValue(false);

      const isValid = webhookHandlers.validateSignature(payload, signature);

      expect(isValid).toBe(false);
    });
  });

  describe('cleanupProcessedMessages', () => {
    test('should clean up processed messages when threshold exceeded', () => {
      // Add many messages to exceed threshold
      for (let i = 0; i < 15000; i++) {
        webhookHandlers.processedMessages.add(`message-${i}`);
      }

      webhookHandlers.cleanupProcessedMessages();

      // Should clear the set when it gets too large
      expect(webhookHandlers.processedMessages.size).toBe(0);
    });

    test('should not clean up when under threshold', () => {
      // Add few messages under threshold
      for (let i = 0; i < 100; i++) {
        webhookHandlers.processedMessages.add(`message-${i}`);
      }

      webhookHandlers.cleanupProcessedMessages();

      // Should not clear the set
      expect(webhookHandlers.processedMessages.size).toBe(100);
    });
  });

  describe('sendWhatsAppMessage', () => {
    test('should send WhatsApp message successfully in non-test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = await webhookHandlers.sendWhatsAppMessage('+12345678900', '+12345678999', 'Test message');

      expect(result).toEqual({
        sid: expect.stringContaining('mock-message-'),
        status: 'sent'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should not send message in test environment', async () => {
      const result = await webhookHandlers.sendWhatsAppMessage('+12345678900', '+12345678999', 'Test message');

      // Should still return a mock result but not actually send
      expect(result).toEqual({
        sid: expect.stringContaining('mock-message-'),
        status: 'sent'
      });
    });
  });
});