const { PrismaClient } = require('@prisma/client');

class ConversationOrchestrator {
  constructor(prisma = null, llmService = null) {
    this.prisma = prisma || new PrismaClient();
    this.llmService = llmService;
  }

  async initializeSession(organizationId, patientPhone) {
    if (!organizationId || !patientPhone) {
      throw new Error('organizationId and patientPhone are required');
    }

    const sessionKey = `${organizationId}:${patientPhone}`;

    const existingSession = await this.prisma.conversationSession.findUnique({
      where: { sessionKey },
    });

    if (existingSession && existingSession.isActive) {
      return existingSession;
    }

    return this.prisma.conversationSession.create({
      data: {
        organizationId,
        patientPhone,
        sessionKey,
        isActive: true,
        stateJson: {
          messages: [],
          context: 'initialized',
          toolsCalled: [],
        },
      },
    });
  }

  async getOrCreateSession(organizationId, patientPhone) {
    const session = await this.initializeSession(organizationId, patientPhone);
    return session;
  }

  async processConversationMessage(sessionId, message) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.isActive) {
      throw new Error('Session is no longer active');
    }

    const stateJson = JSON.parse(session.stateJson || '{}');
    stateJson.messages = stateJson.messages || [];
    stateJson.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    let toolInvocations = [];
    let llmResponse = message;

    if (this.llmService) {
      try {
        const llmResult = await this.llmService.getIntentAndTools(message, stateJson);
        llmResponse = llmResult.response || message;
        toolInvocations = llmResult.toolInvocations || [];

        stateJson.intent = llmResult.intent;
      } catch (error) {
        console.error('LLM service error:', error);
      }
    }

    stateJson.messages.push({
      role: 'assistant',
      content: llmResponse,
      timestamp: new Date().toISOString(),
    });

    stateJson.toolsCalled = stateJson.toolsCalled || [];
    stateJson.toolsCalled.push(...toolInvocations);

    const updatedSession = await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        stateJson,
        lastActivityAt: new Date(),
      },
    });

    return {
      session: updatedSession,
      toolInvocations,
      response: llmResponse,
    };
  }

  async decideTool(sessionId, message) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const lowerMessage = message.toLowerCase();
    let tools = [];

    if (
      lowerMessage.includes('book') ||
      lowerMessage.includes('appointment') ||
      lowerMessage.includes('schedule')
    ) {
      tools.push('BOOK_APPOINTMENT');
    }

    if (lowerMessage.includes('reschedule') || lowerMessage.includes('change')) {
      tools.push('RESCHEDULE_APPOINTMENT');
    }

    if (lowerMessage.includes('cancel') || lowerMessage.includes('delete')) {
      tools.push('CANCEL_APPOINTMENT');
    }

    if (lowerMessage.includes('available') || lowerMessage.includes('slot')) {
      tools.push('GET_AVAILABLE_SLOTS');
    }

    if (lowerMessage.includes('confirm') || lowerMessage.includes('yes')) {
      tools.push('CONFIRM_APPOINTMENT');
    }

    return {
      sessionId,
      detectedTools: tools,
      originalMessage: message,
    };
  }

  async invokeTool(sessionId, toolName, parameters) {
    if (!sessionId || !toolName) {
      throw new Error('sessionId and toolName are required');
    }

    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const stateJson = JSON.parse(session.stateJson || '{}');

    const result = {
      tool: toolName,
      parameters,
      status: 'executed',
      result: null,
    };

    switch (toolName) {
      case 'BOOK_APPOINTMENT':
        result.result = await this._handleBookAppointment(session, parameters);
        break;
      case 'RESCHEDULE_APPOINTMENT':
        result.result = await this._handleRescheduleAppointment(session, parameters);
        break;
      case 'CANCEL_APPOINTMENT':
        result.result = await this._handleCancelAppointment(session, parameters);
        break;
      case 'GET_AVAILABLE_SLOTS':
        result.result = await this._handleGetAvailableSlots(session, parameters);
        break;
      case 'CONFIRM_APPOINTMENT':
        result.result = await this._handleConfirmAppointment(session, parameters);
        break;
      default:
        result.status = 'unknown_tool';
        result.result = `Unknown tool: ${toolName}`;
    }

    stateJson.lastToolExecution = result;

    await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        stateJson,
        lastActivityAt: new Date(),
      },
    });

    return result;
  }

  async closeSession(sessionId) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    return this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });
  }

  async _handleBookAppointment(session, parameters) {
    return {
      action: 'book_appointment',
      status: 'pending',
      parameters,
    };
  }

  async _handleRescheduleAppointment(session, parameters) {
    return {
      action: 'reschedule_appointment',
      status: 'pending',
      parameters,
    };
  }

  async _handleCancelAppointment(session, parameters) {
    return {
      action: 'cancel_appointment',
      status: 'pending',
      parameters,
    };
  }

  async _handleGetAvailableSlots(session, parameters) {
    return {
      action: 'get_available_slots',
      status: 'pending',
      slots: [],
      parameters,
    };
  }

  async _handleConfirmAppointment(session, parameters) {
    return {
      action: 'confirm_appointment',
      status: 'pending',
      parameters,
    };
  }
}

module.exports = ConversationOrchestrator;
