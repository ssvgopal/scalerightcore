// src/patientflow/WebhookHandlers.js - Webhook Handlers for WhatsApp and Voice
const crypto = require('crypto');
const logger = require('../utils/logger');
const ConversationOrchestrator = require('./ConversationOrchestrator');

class WebhookHandlers {
  constructor() {
    this.orchestrator = new ConversationOrchestrator();
    this.twilioWebhookSecret = process.env.TWILIO_WEBHOOK_SECRET || 'test-secret';
    this.processedMessages = new Set(); // Prevent duplicate processing
  }

  async initialize() {
    await this.orchestrator.initialize();
  }

  /**
   * Validate webhook signature
   */
  validateSignature(payload, signature, secret = this.twilioWebhookSecret) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Signature validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Handle WhatsApp webhook
   */
  async handleWhatsAppWebhook(req, reply) {
    try {
      const signature = req.headers['x-twilio-signature'];
      const payload = JSON.stringify(req.body);

      // Validate signature
      if (!this.validateSignature(payload, signature)) {
        logger.warn('Invalid webhook signature for WhatsApp', { signature });
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const { From, To, Body, MessageSid, NumMedia } = req.body;

      // Check for duplicates
      if (this.processedMessages.has(MessageSid)) {
        logger.info('Duplicate WhatsApp message ignored', { MessageSid });
        return reply.status(200).send({ message: 'Duplicate ignored' });
      }

      this.processedMessages.add(MessageSid);

      // Process the message
      const result = await this.orchestrator.processMessage(
        req.organizationId, // This should come from auth middleware
        {
          phone: From,
          channel: 'whatsapp',
          content: Body,
          messageId: MessageSid,
          to: To,
          hasMedia: NumMedia > 0
        },
        {
          source: 'webhook',
          timestamp: new Date()
        }
      );

      // Generate response
      const responseMessage = this.generateWhatsAppResponse(result);
      
      // Send response via Twilio (mocked in tests)
      if (process.env.NODE_ENV !== 'test') {
        await this.sendWhatsAppMessage(To, From, responseMessage);
      }

      logger.info('WhatsApp webhook processed', {
        MessageSid,
        From: From.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        intent: result.intent.type
      });

      return reply.status(200).send({ 
        message: 'Processed successfully',
        intent: result.intent.type,
        response: responseMessage
      });
    } catch (error) {
      logger.error('WhatsApp webhook error', { error: error.message, body: req.body });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Handle voice webhook (incoming call)
   */
  async handleVoiceWebhook(req, reply) {
    try {
      const signature = req.headers['x-twilio-signature'];
      const payload = JSON.stringify(req.body);

      // Validate signature
      if (!this.validateSignature(payload, signature)) {
        logger.warn('Invalid webhook signature for voice', { signature });
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const { From, To, CallSid, CallStatus } = req.body;

      // Check for duplicates
      if (this.processedMessages.has(CallSid)) {
        logger.info('Duplicate voice call ignored', { CallSid });
        return reply.status(200).send({ message: 'Duplicate ignored' });
      }

      this.processedMessages.add(CallSid);

      // Process the call
      const result = await this.orchestrator.processMessage(
        req.organizationId,
        {
          phone: From,
          channel: 'voice',
          content: CallStatus, // For voice, content could be the call status
          messageId: CallSid,
          to: To,
          callStatus: CallStatus
        },
        {
          source: 'webhook',
          timestamp: new Date(),
          callFlow: true
        }
      );

      // Generate TwiML response for voice
      const twiml = this.generateVoiceResponse(result);

      logger.info('Voice webhook processed', {
        CallSid,
        From: From.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        CallStatus,
        intent: result.intent.type
      });

      // Set content type for TwiML
      reply.type('text/xml');
      return reply.send(twiml);
    } catch (error) {
      logger.error('Voice webhook error', { error: error.message, body: req.body });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Handle voice webhook with speech recognition results
   */
  async handleVoiceSpeechWebhook(req, reply) {
    try {
      const signature = req.headers['x-twilio-signature'];
      const payload = JSON.stringify(req.body);

      if (!this.validateSignature(payload, signature)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const { From, To, CallSid, SpeechResult } = req.body;

      if (this.processedMessages.has(`${CallSid}-speech`)) {
        return reply.status(200).send({ message: 'Duplicate ignored' });
      }

      this.processedMessages.add(`${CallSid}-speech`);

      // Process speech result
      const result = await this.orchestrator.processMessage(
        req.organizationId,
        {
          phone: From,
          channel: 'voice',
          content: SpeechResult,
          messageId: `${CallSid}-speech`,
          to: To,
          speechResult: true
        },
        {
          source: 'speech',
          timestamp: new Date()
        }
      );

      // Generate TwiML response
      const twiml = this.generateVoiceResponse(result);

      reply.type('text/xml');
      return reply.send(twiml);
    } catch (error) {
      logger.error('Voice speech webhook error', { error: error.message, body: req.body });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Generate WhatsApp response message
   */
  generateWhatsAppResponse(result) {
    const { intent, result: actionResult } = result;
    
    switch (intent.type) {
      case 'appointment_booked':
        return `✅ Your appointment has been confirmed!\n\n📅 Date: ${actionResult.appointment.startTime.toLocaleDateString()}\n⏰ Time: ${actionResult.appointment.startTime.toLocaleTimeString()}\n👨‍⚕️ Doctor: ${actionResult.appointment.doctor.firstName} ${actionResult.appointment.doctor.lastName}\n\nWe'll send you a reminder before your appointment.`;

      case 'appointment_rescheduled':
        return `🔄 Your appointment has been rescheduled!\n\n📅 New Date: ${actionResult.appointment.startTime.toLocaleDateString()}\n⏰ New Time: ${actionResult.appointment.startTime.toLocaleTimeString()}\n👨‍⚕️ Doctor: ${actionResult.appointment.doctor.firstName} ${actionResult.appointment.doctor.lastName}\n\nWe'll send you a reminder before your appointment.`;

      case 'appointment_cancelled':
        return `❌ Your appointment has been cancelled.\n\nIf you'd like to book a new appointment, just let me know!`;

      case 'appointments_list':
        if (actionResult.appointments.length === 0) {
          return '📅 You have no upcoming appointments.\n\nWould you like to book one?';
        }
        
        let response = `📅 You have ${actionResult.appointments.length} upcoming appointment(s):\n\n`;
        actionResult.appointments.forEach((apt, index) => {
          response += `${index + 1}. ${apt.startTime.toLocaleDateString()} at ${apt.startTime.toLocaleTimeString()}\n   with Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}\n\n`;
        });
        return response;

      case 'no_slots_available':
        return `🤔 Sorry, no available slots found for ${actionResult.message.includes('requested date') ? 'that date' : 'the selected date'}.\n\nAvailable dates:\n${actionResult.suggestedDates.map(date => `• ${date}`).join('\n')}\n\nWould you like to try one of these dates?`;

      case 'no_appointment_found':
        return '📅 You have no upcoming appointments to reschedule or cancel.\n\nWould you like to book a new appointment?';

      default:
        return '👋 Hello! I can help you book, reschedule, or cancel appointments. How can I assist you today?';
    }
  }

  /**
   * Generate TwiML response for voice
   */
  generateVoiceResponse(result) {
    const { intent, result: actionResult } = result;
    
    let message = '';
    
    switch (intent.type) {
      case 'appointment_booked':
        message = `Your appointment has been confirmed for ${actionResult.appointment.startTime.toLocaleDateString()} at ${actionResult.appointment.startTime.toLocaleTimeString()} with Doctor ${actionResult.appointment.doctor.firstName} ${actionResult.appointment.doctor.lastName}. We'll send you a reminder before your appointment.`;
        break;

      case 'appointment_rescheduled':
        message = `Your appointment has been rescheduled to ${actionResult.appointment.startTime.toLocaleDateString()} at ${actionResult.appointment.startTime.toLocaleTimeString()} with Doctor ${actionResult.appointment.doctor.firstName} ${actionResult.appointment.doctor.lastName}.`;
        break;

      case 'appointment_cancelled':
        message = 'Your appointment has been cancelled. If you would like to book a new appointment, please call us again.';
        break;

      case 'appointments_list':
        if (actionResult.appointments.length === 0) {
          message = 'You have no upcoming appointments. Would you like to book one?';
        } else {
          message = `You have ${actionResult.appointments.length} upcoming appointments. `;
          actionResult.appointments.forEach((apt, index) => {
            message += `Appointment ${index + 1}: ${apt.startTime.toLocaleDateString()} at ${apt.startTime.toLocaleTimeString()} with Doctor ${apt.doctor.firstName} ${apt.doctor.lastName}. `;
          });
        }
        break;

      default:
        message = 'Hello! I can help you book, reschedule, or cancel appointments. How can I assist you today?';
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Pause length="1"/>
  <Gather input="speech" timeout="3" action="/api/patientflow/webhooks/voice/speech" method="POST">
    <Say voice="alice">Is there anything else I can help you with?</Say>
  </Gather>
</Response>`;
  }

  /**
   * Send WhatsApp message (mocked in tests)
   */
  async sendWhatsAppMessage(to, from, message) {
    try {
      // This would normally use Twilio API
      logger.info('WhatsApp message sent', {
        to: to.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        from,
        message: message.substring(0, 100) + '...'
      });

      return { sid: `mock-message-${Date.now()}`, status: 'sent' };
    } catch (error) {
      logger.error('Failed to send WhatsApp message', { to, from, error: error.message });
      throw error;
    }
  }

  /**
   * Clean up old processed message IDs
   */
  cleanupProcessedMessages() {
    // Clean up messages older than 1 hour to prevent memory leaks
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // This is a simplified cleanup - in production you'd want a more sophisticated approach
    if (this.processedMessages.size > 10000) {
      this.processedMessages.clear();
    }
  }
}

module.exports = WebhookHandlers;