const crypto = require('crypto');

class WebhookHandler {
  constructor(prisma = null, conversationOrchestrator = null) {
    this.prisma = prisma;
    this.orchestrator = conversationOrchestrator;
    this.processedWebhookIds = new Map();
  }

  validateSignature(payload, signature, secret) {
    if (!payload || !signature || !secret) {
      throw new Error('payload, signature, and secret are required');
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  }

  isDuplicateWebhook(webhookId) {
    if (this.processedWebhookIds.has(webhookId)) {
      return true;
    }

    this.processedWebhookIds.set(webhookId, true);

    if (this.processedWebhookIds.size > 10000) {
      const firstKey = this.processedWebhookIds.keys().next().value;
      this.processedWebhookIds.delete(firstKey);
    }

    return false;
  }

  async handleWhatsAppWebhook(payload, organizationId) {
    if (!payload) {
      throw new Error('payload is required');
    }

    const webhookId = payload.id || `${Date.now()}-${Math.random()}`;

    if (this.isDuplicateWebhook(webhookId)) {
      return {
        status: 'duplicate',
        webhookId,
      };
    }

    const phoneNumber = payload.from || payload.senderPhone;
    const messageText = payload.text || payload.body || '';
    const messageId = payload.messageId || payload.waId;

    if (!phoneNumber) {
      throw new Error('Phone number not found in WhatsApp payload');
    }

    const session = await this.orchestrator.getOrCreateSession(organizationId, phoneNumber);

    const messageLog = await this.prisma.patientMessageLog.create({
      data: {
        organizationId,
        patientId: null,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        payload,
        externalMessageId: messageId,
      },
    });

    const processResult = await this.orchestrator.processConversationMessage(session.id, messageText);

    const toolDecision = await this.orchestrator.decideTool(session.id, messageText);

    return {
      status: 'processed',
      webhookId,
      sessionId: session.id,
      messageLogId: messageLog.id,
      toolsDetected: toolDecision.detectedTools,
      response: processResult.response,
    };
  }

  async handleVoiceWebhook(payload, organizationId) {
    if (!payload) {
      throw new Error('payload is required');
    }

    const webhookId = payload.id || payload.CallSid || `${Date.now()}-${Math.random()}`;

    if (this.isDuplicateWebhook(webhookId)) {
      return {
        status: 'duplicate',
        webhookId,
      };
    }

    const phoneNumber = payload.from || payload.caller;
    const callSid = payload.CallSid || payload.id;
    const callStatus = payload.CallStatus || payload.status || 'INITIATED';

    if (!phoneNumber) {
      throw new Error('Phone number not found in voice payload');
    }

    let callLog = await this.prisma.patientCallLog.findFirst({
      where: { callSid },
    });

    if (!callLog) {
      callLog = await this.prisma.patientCallLog.create({
        data: {
          organizationId,
          patientId: null,
          callSid,
          status: callStatus,
          startTime: new Date(),
          callMetadata: payload,
        },
      });
    } else {
      callLog = await this.prisma.patientCallLog.update({
        where: { id: callLog.id },
        data: {
          status: callStatus,
          endTime: callStatus === 'COMPLETED' ? new Date() : null,
          callMetadata: payload,
        },
      });
    }

    const session = await this.orchestrator.getOrCreateSession(organizationId, phoneNumber);

    let response = {};

    if (callStatus === 'ANSWERED') {
      const toolDecision = await this.orchestrator.decideTool(session.id, 'voice_call_connected');

      response = {
        status: 'answered',
        sessionId: session.id,
        callSid,
        toolsDetected: toolDecision.detectedTools,
      };
    } else if (callStatus === 'COMPLETED') {
      response = {
        status: 'completed',
        sessionId: session.id,
        callSid,
        callLogId: callLog.id,
      };

      await this.orchestrator.closeSession(session.id);
    }

    return {
      webhookId,
      ...response,
    };
  }

  async triggerAction(organizationId, actionType, parameters) {
    if (!organizationId || !actionType) {
      throw new Error('organizationId and actionType are required');
    }

    const action = {
      organizationId,
      actionType,
      parameters,
      status: 'triggered',
      triggeredAt: new Date(),
    };

    switch (actionType) {
      case 'SEND_MESSAGE':
        action.result = await this._triggerSendMessage(parameters);
        break;

      case 'PLACE_CALL':
        action.result = await this._triggerPlaceCall(parameters);
        break;

      case 'BOOK_APPOINTMENT':
        action.result = await this._triggerBookAppointment(parameters);
        break;

      case 'SEND_REMINDER':
        action.result = await this._triggerSendReminder(parameters);
        break;

      default:
        action.status = 'unknown_action';
        action.result = `Unknown action: ${actionType}`;
    }

    return action;
  }

  async _triggerSendMessage(parameters) {
    const { phoneNumber, message, channel } = parameters;

    if (!phoneNumber || !message) {
      throw new Error('phoneNumber and message are required');
    }

    return {
      service: channel || 'WHATSAPP',
      phoneNumber,
      message,
      status: 'queued',
    };
  }

  async _triggerPlaceCall(parameters) {
    const { phoneNumber } = parameters;

    if (!phoneNumber) {
      throw new Error('phoneNumber is required');
    }

    return {
      service: 'VOICE',
      phoneNumber,
      status: 'initiating',
    };
  }

  async _triggerBookAppointment(parameters) {
    const { patientId, doctorId, startTime, endTime } = parameters;

    if (!patientId || !doctorId || !startTime || !endTime) {
      throw new Error('patientId, doctorId, startTime, and endTime are required');
    }

    return {
      action: 'book_appointment',
      patientId,
      doctorId,
      startTime,
      endTime,
      status: 'queued',
    };
  }

  async _triggerSendReminder(parameters) {
    const { appointmentId, phoneNumber } = parameters;

    if (!appointmentId) {
      throw new Error('appointmentId is required');
    }

    return {
      action: 'send_reminder',
      appointmentId,
      phoneNumber,
      status: 'queued',
    };
  }
}

module.exports = WebhookHandler;
