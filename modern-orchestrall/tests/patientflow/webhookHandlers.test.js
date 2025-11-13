const WebhookHandler = require('../../src/patientflow/webhookHandlers');
const { createMockPrisma, createMockLlmService } = require('./utils/mockPrisma');
const crypto = require('crypto');

describe('WebhookHandler', () => {
  let webhookHandler;
  let mockPrisma;
  let mockOrchestrator;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockOrchestrator = {
      getOrCreateSession: jest.fn(),
      processConversationMessage: jest.fn(),
      decideTool: jest.fn(),
      closeSession: jest.fn(),
    };
    webhookHandler = new WebhookHandler(mockPrisma, mockOrchestrator);
  });

  describe('validateSignature', () => {
    it('should validate a correct signature', () => {
      const secret = 'test-secret';
      const payload = { message: 'test' };
      const hash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = webhookHandler.validateSignature(payload, hash, secret);

      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const payload = { message: 'test' };
      const invalidHash = 'invalid-hash';

      const isValid = webhookHandler.validateSignature(payload, invalidHash, 'test-secret');

      expect(isValid).toBe(false);
    });

    it('should throw error if parameters are missing', () => {
      expect(() => webhookHandler.validateSignature(null, 'hash', 'secret')).toThrow(
        'payload, signature, and secret are required'
      );
    });
  });

  describe('isDuplicateWebhook', () => {
    it('should detect duplicate webhooks', () => {
      const webhookId = 'webhook-123';

      const firstCall = webhookHandler.isDuplicateWebhook(webhookId);
      const secondCall = webhookHandler.isDuplicateWebhook(webhookId);

      expect(firstCall).toBe(false);
      expect(secondCall).toBe(true);
    });

    it('should process unique webhooks as non-duplicates', () => {
      const id1 = webhookHandler.isDuplicateWebhook('webhook-1');
      const id2 = webhookHandler.isDuplicateWebhook('webhook-2');

      expect(id1).toBe(false);
      expect(id2).toBe(false);
    });
  });

  describe('handleWhatsAppWebhook', () => {
    it('should process a WhatsApp message webhook', async () => {
      const payload = {
        id: 'wh-123',
        from: '+1-555-1000',
        text: 'I want to book an appointment',
        messageId: 'msg-456',
      };

      const mockSession = { id: 'session-1' };
      const mockMessageLog = { id: 'msglog-1' };
      const mockProcessResult = {
        session: mockSession,
        response: 'I can help',
        toolInvocations: ['BOOK_APPOINTMENT'],
      };

      mockOrchestrator.getOrCreateSession.mockResolvedValue(mockSession);
      mockOrchestrator.processConversationMessage.mockResolvedValue(mockProcessResult);
      mockOrchestrator.decideTool.mockResolvedValue({
        detectedTools: ['BOOK_APPOINTMENT'],
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue(mockMessageLog);

      const result = await webhookHandler.handleWhatsAppWebhook(payload, 'org-1');

      expect(result.status).toBe('processed');
      expect(result.webhookId).toBe('wh-123');
      expect(result.sessionId).toBe('session-1');
      expect(mockOrchestrator.getOrCreateSession).toHaveBeenCalledWith('org-1', '+1-555-1000');
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalled();
    });

    it('should handle duplicate WhatsApp webhooks', async () => {
      const payload = {
        id: 'wh-123',
        from: '+1-555-1000',
        text: 'I want to book an appointment',
      };

      const mockSession = { id: 'session-1' };
      const mockProcessResult = {
        session: mockSession,
        response: 'I can help',
        toolInvocations: [],
      };

      mockOrchestrator.getOrCreateSession.mockResolvedValue(mockSession);
      mockOrchestrator.processConversationMessage.mockResolvedValue(mockProcessResult);
      mockOrchestrator.decideTool.mockResolvedValue({
        detectedTools: [],
      });
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'msglog-1' });

      await webhookHandler.handleWhatsAppWebhook(payload, 'org-1');

      const result = await webhookHandler.handleWhatsAppWebhook(payload, 'org-1');

      expect(result.status).toBe('duplicate');
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error if phone number is missing', async () => {
      const payload = {
        id: 'wh-123',
        text: 'I want to book an appointment',
      };

      await expect(
        webhookHandler.handleWhatsAppWebhook(payload, 'org-1')
      ).rejects.toThrow('Phone number not found in WhatsApp payload');
    });
  });

  describe('handleVoiceWebhook', () => {
    it('should process a voice call webhook', async () => {
      const payload = {
        id: 'call-123',
        CallSid: 'CA-123456',
        from: '+1-555-1000',
        CallStatus: 'ANSWERED',
      };

      const mockSession = { id: 'session-1' };
      mockOrchestrator.getOrCreateSession.mockResolvedValue(mockSession);
      mockOrchestrator.decideTool.mockResolvedValue({
        detectedTools: ['BOOK_APPOINTMENT'],
      });
      mockPrisma.patientCallLog.findFirst.mockResolvedValue(null);
      mockPrisma.patientCallLog.create.mockResolvedValue({ id: 'calllog-1' });

      const result = await webhookHandler.handleVoiceWebhook(payload, 'org-1');

      expect(result.webhookId).toBe('call-123');
      expect(result.status).toBe('answered');
      expect(mockPrisma.patientCallLog.create).toHaveBeenCalled();
    });

    it('should update existing call log', async () => {
      const payload = {
        id: 'call-123',
        CallSid: 'CA-123456',
        from: '+1-555-1000',
        CallStatus: 'COMPLETED',
      };

      const mockCallLog = {
        id: 'calllog-1',
        status: 'ANSWERED',
      };

      const mockSession = { id: 'session-1' };
      mockOrchestrator.getOrCreateSession.mockResolvedValue(mockSession);
      mockPrisma.patientCallLog.findFirst.mockResolvedValue(mockCallLog);
      mockPrisma.patientCallLog.update.mockResolvedValue({
        ...mockCallLog,
        status: 'COMPLETED',
      });

      const result = await webhookHandler.handleVoiceWebhook(payload, 'org-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.patientCallLog.update).toHaveBeenCalled();
      expect(mockOrchestrator.closeSession).toHaveBeenCalled();
    });

    it('should handle duplicate voice webhooks', async () => {
      const payload = {
        CallSid: 'CA-123456',
        from: '+1-555-1000',
        CallStatus: 'INITIATED',
      };

      const mockSession = { id: 'session-1' };
      mockOrchestrator.getOrCreateSession.mockResolvedValue(mockSession);
      mockPrisma.patientCallLog.findFirst.mockResolvedValue(null);
      mockPrisma.patientCallLog.create.mockResolvedValue({ id: 'calllog-1' });

      await webhookHandler.handleVoiceWebhook(payload, 'org-1');

      const result = await webhookHandler.handleVoiceWebhook(payload, 'org-1');

      expect(result.status).toBe('duplicate');
      expect(mockPrisma.patientCallLog.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error if phone number is missing', async () => {
      const payload = {
        CallSid: 'CA-123456',
        CallStatus: 'INITIATED',
      };

      await expect(
        webhookHandler.handleVoiceWebhook(payload, 'org-1')
      ).rejects.toThrow('Phone number not found in voice payload');
    });
  });

  describe('triggerAction', () => {
    it('should trigger SEND_MESSAGE action', async () => {
      const result = await webhookHandler.triggerAction('org-1', 'SEND_MESSAGE', {
        phoneNumber: '+1-555-1000',
        message: 'Your appointment is confirmed',
      });

      expect(result.actionType).toBe('SEND_MESSAGE');
      expect(result.status).toBe('triggered');
      expect(result.result.status).toBe('queued');
    });

    it('should trigger PLACE_CALL action', async () => {
      const result = await webhookHandler.triggerAction('org-1', 'PLACE_CALL', {
        phoneNumber: '+1-555-1000',
      });

      expect(result.actionType).toBe('PLACE_CALL');
      expect(result.status).toBe('triggered');
      expect(result.result.status).toBe('initiating');
    });

    it('should trigger BOOK_APPOINTMENT action', async () => {
      const result = await webhookHandler.triggerAction('org-1', 'BOOK_APPOINTMENT', {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: new Date(),
        endTime: new Date(),
      });

      expect(result.actionType).toBe('BOOK_APPOINTMENT');
      expect(result.status).toBe('triggered');
    });

    it('should trigger SEND_REMINDER action', async () => {
      const result = await webhookHandler.triggerAction('org-1', 'SEND_REMINDER', {
        appointmentId: 'apt-1',
        phoneNumber: '+1-555-1000',
      });

      expect(result.actionType).toBe('SEND_REMINDER');
      expect(result.status).toBe('triggered');
    });

    it('should handle unknown actions', async () => {
      const result = await webhookHandler.triggerAction('org-1', 'UNKNOWN_ACTION', {});

      expect(result.status).toBe('unknown_action');
    });

    it('should throw error if organizationId is missing', async () => {
      await expect(
        webhookHandler.triggerAction(null, 'SEND_MESSAGE', {})
      ).rejects.toThrow('organizationId and actionType are required');
    });
  });
});
