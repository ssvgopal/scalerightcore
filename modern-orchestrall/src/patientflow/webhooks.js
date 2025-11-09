// src/patientflow/webhooks.js - PatientFlow Webhook Handlers
const patientFlowService = require('./index');
const logger = require('../utils/logger');

// WhatsApp webhook handler
async function handleWhatsAppWebhook(request, reply) {
  try {
    const { Body, From, To, MessageSid } = request.body;

    // Process inbound WhatsApp message
    const result = await patientFlowService.handleWhatsAppMessage({
      direction: 'INBOUND',
      from: From,
      to: To,
      content: Body,
      messageId: MessageSid,
    });

    logger.info('WhatsApp webhook processed', { MessageSid, From });

    return reply.status(200).send({
      status: 'processed',
      messageId: result.messageId,
    });

  } catch (error) {
    logger.error('WhatsApp webhook error', error);
    return reply.status(500).send({
      error: 'Failed to process WhatsApp webhook',
      message: error.message,
    });
  }
}

// Twilio voice webhook handler
async function handleTwilioVoiceWebhook(request, reply) {
  try {
    const { CallSid, CallStatus, From, To, Duration } = request.body;

    // Convert duration from string to number if present
    const durationMs = Duration ? parseInt(Duration) * 1000 : undefined;

    // Process voice call event
    const result = await patientFlowService.handleVoiceCall({
      status: CallStatus,
      callSid: CallSid,
      duration: durationMs,
      from: From,
      to: To,
    });

    logger.info('Twilio voice webhook processed', { CallSid, CallStatus });

    // Return TwiML if needed for ongoing calls
    if (CallStatus === 'ringing') {
      reply.type('text/xml');
      return reply.send(`
        <Response>
          <Say>Welcome to PatientFlow. Please hold while we connect you.</Say>
        </Response>
      `);
    }

    return reply.status(200).send({
      status: 'processed',
      callId: result.callId,
    });

  } catch (error) {
    logger.error('Twilio voice webhook error', error);
    return reply.status(500).send({
      error: 'Failed to process Twilio voice webhook',
      message: error.message,
    });
  }
}

// Appointment booking webhook handler
async function handleAppointmentWebhook(request, reply) {
  try {
    const { 
      source, 
      patientId, 
      doctorId, 
      startTime, 
      endTime, 
      reason 
    } = request.body;

    // Process appointment booking
    const result = await patientFlowService.handleAppointmentBooking({
      source: source || 'MANUAL',
      status: 'BOOKED',
      patientId,
      doctorId,
      startTime,
      endTime,
      reason,
    });

    logger.info('Appointment webhook processed', { 
      source, 
      patientId, 
      doctorId,
      appointmentId: result.appointmentId,
    });

    return reply.status(201).send({
      status: 'booked',
      appointmentId: result.appointmentId,
      message: 'Appointment booked successfully',
    });

  } catch (error) {
    logger.error('Appointment webhook error', error);
    return reply.status(500).send({
      error: 'Failed to book appointment',
      message: error.message,
    });
  }
}

// Test endpoint for simulating PatientFlow interactions
async function simulatePatientFlowInteractions(request, reply) {
  try {
    const { type, count = 1 } = request.query;
    const results = [];

    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'message':
          // Simulate WhatsApp message
          const messageResult = await patientFlowService.handleWhatsAppMessage({
            direction: Math.random() > 0.5 ? 'INBOUND' : 'OUTBOUND',
            from: '+1234567890',
            to: '+0987654321',
            content: `Test message ${i + 1}`,
          });
          results.push({ type: 'message', result: messageResult });
          break;

        case 'call':
          // Simulate voice call
          const callResult = await patientFlowService.handleVoiceCall({
            status: ['COMPLETED', 'MISSED', 'FAILED'][Math.floor(Math.random() * 3)],
            callSid: `call_${Date.now()}_${i}`,
            duration: Math.floor(Math.random() * 300000), // 0-5 minutes in ms
            from: '+1234567890',
            to: '+0987654321',
          });
          results.push({ type: 'call', result: callResult });
          break;

        case 'booking':
          // Simulate appointment booking
          const bookingResult = await patientFlowService.handleAppointmentBooking({
            source: ['WHATSAPP', 'VOICE', 'MANUAL'][Math.floor(Math.random() * 3)],
            status: ['BOOKED', 'CONFIRMED', 'CANCELLED'][Math.floor(Math.random() * 3)],
            patientId: `patient_${i + 1}`,
            doctorId: `doctor_${(i % 3) + 1}`,
            startTime: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
          });
          results.push({ type: 'booking', result: bookingResult });
          break;

        default:
          // Simulate all types
          const allResults = await simulatePatientFlowInteractions(
            { query: { type: 'message', count: 1 } },
            { send: () => {} }
          );
          const callResults = await simulatePatientFlowInteractions(
            { query: { type: 'call', count: 1 } },
            { send: () => {} }
          );
          const bookingResults = await simulatePatientFlowInteractions(
            { query: { type: 'booking', count: 1 } },
            { send: () => {} }
          );
          return reply.send({
            message: 'Simulated all interaction types',
            results: [...allResults.results, ...callResults.results, ...bookingResults.results],
          });
      }
    }

    return reply.send({
      message: `Simulated ${count} ${type} interaction(s)`,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Simulation error', error);
    return reply.status(500).send({
      error: 'Failed to simulate interactions',
      message: error.message,
    });
  }
}

module.exports = {
  handleWhatsAppWebhook,
  handleTwilioVoiceWebhook,
  handleAppointmentWebhook,
  simulatePatientFlowInteractions,
};