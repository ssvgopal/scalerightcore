const ConversationOrchestrator = require('../../src/patientflow/ConversationOrchestrator');
const { createMockPrisma, createMockLlmService } = require('./utils/mockPrisma');

describe('ConversationOrchestrator', () => {
  let orchestrator;
  let mockPrisma;
  let mockLlmService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockLlmService = createMockLlmService();
    orchestrator = new ConversationOrchestrator(mockPrisma, mockLlmService);
  });

  describe('initializeSession', () => {
    it('should create a new conversation session', async () => {
      const mockSession = {
        id: 'session-1',
        organizationId: 'org-1',
        patientPhone: '+1-555-1000',
        sessionKey: 'org-1:+1-555-1000',
        isActive: true,
        stateJson: {
          messages: [],
          context: 'initialized',
          toolsCalled: [],
        },
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);
      mockPrisma.conversationSession.create.mockResolvedValue(mockSession);

      const result = await orchestrator.initializeSession('org-1', '+1-555-1000');

      expect(result).toEqual(mockSession);
      expect(result.isActive).toBe(true);
      expect(mockPrisma.conversationSession.create).toHaveBeenCalled();
    });

    it('should return existing active session', async () => {
      const existingSession = {
        id: 'session-1',
        organizationId: 'org-1',
        patientPhone: '+1-555-1000',
        sessionKey: 'org-1:+1-555-1000',
        isActive: true,
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(existingSession);

      const result = await orchestrator.initializeSession('org-1', '+1-555-1000');

      expect(result).toEqual(existingSession);
      expect(mockPrisma.conversationSession.create).not.toHaveBeenCalled();
    });

    it('should throw error if organizationId is missing', async () => {
      await expect(
        orchestrator.initializeSession(null, '+1-555-1000')
      ).rejects.toThrow('organizationId and patientPhone are required');
    });
  });

  describe('getOrCreateSession', () => {
    it('should get or create a session', async () => {
      const mockSession = {
        id: 'session-1',
        organizationId: 'org-1',
        patientPhone: '+1-555-1000',
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);
      mockPrisma.conversationSession.create.mockResolvedValue(mockSession);

      const result = await orchestrator.getOrCreateSession('org-1', '+1-555-1000');

      expect(result).toEqual(mockSession);
    });
  });

  describe('processConversationMessage', () => {
    it('should process a user message', async () => {
      const existingSession = {
        id: 'session-1',
        organizationId: 'org-1',
        isActive: true,
        stateJson: JSON.stringify({
          messages: [],
          context: 'initialized',
        }),
      };

      const updatedSession = {
        ...existingSession,
        stateJson: {
          messages: expect.any(Array),
          intent: 'booking',
        },
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(existingSession);
      mockPrisma.conversationSession.update.mockResolvedValue(updatedSession);
      mockLlmService.getIntentAndTools.mockResolvedValue({
        intent: 'booking',
        response: 'I can help you book an appointment',
        toolInvocations: ['BOOK_APPOINTMENT'],
      });

      const result = await orchestrator.processConversationMessage(
        'session-1',
        'I want to book an appointment'
      );

      expect(result.session).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.toolInvocations).toBeDefined();
      expect(mockPrisma.conversationSession.update).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);

      await expect(
        orchestrator.processConversationMessage('session-999', 'Test message')
      ).rejects.toThrow('Session not found: session-999');
    });

    it('should throw error if session is inactive', async () => {
      const inactiveSession = {
        id: 'session-1',
        isActive: false,
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(inactiveSession);

      await expect(
        orchestrator.processConversationMessage('session-1', 'Test message')
      ).rejects.toThrow('Session is no longer active');
    });

    it('should handle LLM service errors gracefully', async () => {
      const existingSession = {
        id: 'session-1',
        isActive: true,
        stateJson: JSON.stringify({ messages: [] }),
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(existingSession);
      mockPrisma.conversationSession.update.mockResolvedValue({
        ...existingSession,
        stateJson: { messages: [] },
      });
      mockLlmService.getIntentAndTools.mockRejectedValue(new Error('LLM error'));

      const result = await orchestrator.processConversationMessage(
        'session-1',
        'Test message'
      );

      expect(result).toBeDefined();
      expect(mockPrisma.conversationSession.update).toHaveBeenCalled();
    });
  });

  describe('decideTool', () => {
    it('should detect booking intent', async () => {
      const mockSession = { id: 'session-1' };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);

      const result = await orchestrator.decideTool('session-1', 'I want to book an appointment');

      expect(result.detectedTools).toContain('BOOK_APPOINTMENT');
    });

    it('should detect reschedule intent', async () => {
      const mockSession = { id: 'session-1' };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);

      const result = await orchestrator.decideTool('session-1', 'Can I reschedule my appointment?');

      expect(result.detectedTools).toContain('RESCHEDULE_APPOINTMENT');
    });

    it('should detect cancellation intent', async () => {
      const mockSession = { id: 'session-1' };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);

      const result = await orchestrator.decideTool('session-1', 'I need to cancel my appointment');

      expect(result.detectedTools).toContain('CANCEL_APPOINTMENT');
    });

    it('should detect available slots query', async () => {
      const mockSession = { id: 'session-1' };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);

      const result = await orchestrator.decideTool('session-1', 'What slots are available?');

      expect(result.detectedTools).toContain('GET_AVAILABLE_SLOTS');
    });

    it('should detect confirmation intent', async () => {
      const mockSession = { id: 'session-1' };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);

      const result = await orchestrator.decideTool('session-1', 'Yes, confirm that appointment');

      expect(result.detectedTools).toContain('CONFIRM_APPOINTMENT');
    });
  });

  describe('invokeTool', () => {
    it('should invoke BOOK_APPOINTMENT tool', async () => {
      const mockSession = { id: 'session-1', stateJson: JSON.stringify({}) };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const result = await orchestrator.invokeTool('session-1', 'BOOK_APPOINTMENT', {
        doctorId: 'doctor-1',
        patientId: 'patient-1',
      });

      expect(result.tool).toBe('BOOK_APPOINTMENT');
      expect(result.status).toBe('executed');
      expect(result.result).toBeDefined();
    });

    it('should invoke RESCHEDULE_APPOINTMENT tool', async () => {
      const mockSession = { id: 'session-1', stateJson: JSON.stringify({}) };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const result = await orchestrator.invokeTool('session-1', 'RESCHEDULE_APPOINTMENT', {
        appointmentId: 'apt-1',
      });

      expect(result.tool).toBe('RESCHEDULE_APPOINTMENT');
      expect(result.status).toBe('executed');
    });

    it('should invoke CANCEL_APPOINTMENT tool', async () => {
      const mockSession = { id: 'session-1', stateJson: JSON.stringify({}) };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const result = await orchestrator.invokeTool('session-1', 'CANCEL_APPOINTMENT', {
        appointmentId: 'apt-1',
      });

      expect(result.tool).toBe('CANCEL_APPOINTMENT');
      expect(result.status).toBe('executed');
    });

    it('should invoke GET_AVAILABLE_SLOTS tool', async () => {
      const mockSession = { id: 'session-1', stateJson: JSON.stringify({}) };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const result = await orchestrator.invokeTool('session-1', 'GET_AVAILABLE_SLOTS', {
        doctorId: 'doctor-1',
      });

      expect(result.tool).toBe('GET_AVAILABLE_SLOTS');
      expect(result.result.slots).toBeDefined();
    });

    it('should handle unknown tools', async () => {
      const mockSession = { id: 'session-1', stateJson: JSON.stringify({}) };
      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const result = await orchestrator.invokeTool('session-1', 'UNKNOWN_TOOL', {});

      expect(result.status).toBe('unknown_tool');
    });
  });

  describe('closeSession', () => {
    it('should close a conversation session', async () => {
      const closedSession = {
        id: 'session-1',
        isActive: false,
        endedAt: new Date(),
      };

      mockPrisma.conversationSession.update.mockResolvedValue(closedSession);

      const result = await orchestrator.closeSession('session-1');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.conversationSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          isActive: false,
          endedAt: expect.any(Date),
        }),
      });
    });
  });
});
