const config = require('../../config');
const database = require('../../database');
const logger = require('../../utils/logger');
const metrics = require('../metrics');
const twilioIntegration = require('../integrations/twilio');
const sessionManager = require('./session-manager');

class ConversationOrchestrator {
  constructor() {
    this.prismaClient = null;
  }

  get prisma() {
    if (!this.prismaClient) {
      this.prismaClient = database.client;
    }

    return this.prismaClient;
  }

  createInitialSession(patientId, sessionKey) {
    return {
      stage: 'awaiting_slot',
      patientId,
      greeted: false,
      history: [],
      context: {},
      createdAt: new Date().toISOString(),
      sessionKey,
    };
  }

  async handleInboundMessage({ organizationId, patient, inboundMessage }) {
    if (!organizationId) {
      throw new Error('Missing organizationId for conversation handling');
    }

    if (!patient || !patient.id) {
      throw new Error('Missing patient details for conversation handling');
    }

    const normalizedFrom = inboundMessage.from || patient.phone;
    const messageText = (inboundMessage.body || '').trim();
    const receivedAt = inboundMessage.receivedAt || new Date();
    const sessionKey = `${organizationId}:${patient.phone}`;

    let session = await sessionManager.getSession(organizationId, patient.phone);
    if (!session) {
      session = this.createInitialSession(patient.id, sessionKey);
    }

    session.sessionKey = session.sessionKey || sessionKey;
    session.history = session.history || [];
    session.history.push({
      direction: 'INBOUND',
      body: messageText,
      timestamp: receivedAt.toISOString(),
      sid: inboundMessage.sid,
    });

    await this.logPatientMessage({
      organizationId,
      patientId: patient.id,
      direction: 'INBOUND',
      payload: inboundMessage.raw || {},
      externalMessageId: inboundMessage.sid,
      metadata: {
        retryCount: inboundMessage.retryCount || 0,
        from: normalizedFrom,
        to: inboundMessage.to,
        waId: inboundMessage.waId,
        receivedAt: receivedAt.toISOString(),
      },
    });

    metrics.recordInbound(organizationId);

    const responses = await this.generateResponses({
      session,
      patient,
      organizationId,
      inboundMessage,
      messageText,
    });

    const sentMessages = [];

    for (const response of responses) {
      try {
        const { response: twilioResponse, latencyMs } = await twilioIntegration.sendWhatsAppMessage({
          to: patient.phone,
          body: response.body,
          mediaUrls: response.mediaUrls,
          persistentAction: response.persistentAction,
        });

        sentMessages.push({ response: twilioResponse, latencyMs });
        metrics.recordOutbound(organizationId);

        session.history.push({
          direction: 'OUTBOUND',
          body: response.body,
          timestamp: new Date().toISOString(),
          sid: twilioResponse.sid,
        });

        await this.logPatientMessage({
          organizationId,
          patientId: patient.id,
          direction: 'OUTBOUND',
          payload: {
            body: response.body,
            mediaUrls: response.mediaUrls || [],
          },
          externalMessageId: twilioResponse.sid,
          metadata: {
            status: twilioResponse.status,
            to: twilioResponse.to,
            from: twilioResponse.from,
            latencyMs,
          },
        });
      } catch (error) {
        logger.error('Failed to send WhatsApp response', {
          organizationId,
          patientId: patient.id,
          error: error.message,
        });

        await this.logPatientMessage({
          organizationId,
          patientId: patient.id,
          direction: 'OUTBOUND',
          payload: {
            body: response.body,
            mediaUrls: response.mediaUrls || [],
          },
          metadata: {
            error: error.message,
          },
        });
      }
    }

    await sessionManager.saveSession(organizationId, patient.phone, session);

    return {
      session,
      sentMessages,
      appointmentId: session.lastAppointment?.id,
    };
  }

  async generateResponses({ session, patient, organizationId, inboundMessage, messageText }) {
    const responses = [];
    const lowerCased = messageText.toLowerCase();

    if (!session.stage) {
      session.stage = 'awaiting_slot';
    }

    if (!session.context) {
      session.context = {};
    }

    if (!session.greeted) {
      const firstName = patient.firstName || 'there';
      responses.push({
        body: `Hi ${firstName}! 👋 Thanks for messaging us at the clinic.`,
      });
      session.greeted = true;
    }

    // Allow fresh booking after completion when user provides new details
    if (session.stage === 'completed') {
      const slot = this.parseAppointmentRequest(messageText);
      if (slot) {
        session.pendingAppointment = Object.assign({}, slot, {
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
        });
        session.stage = 'awaiting_confirmation';
        responses.push({
          body: `I can help you schedule a new visit on ${slot.displayDate} at ${slot.displayTime}. Reply YES to confirm or share another time.`,
        });
        return responses;
      }

      responses.push({
        body: 'You are already booked. If you need to reschedule, reply with a new date (YYYY-MM-DD) and time (HH:MM).',
      });
      return responses;
    }

    if (session.stage === 'awaiting_confirmation') {
      const replacementSlot = this.parseAppointmentRequest(messageText);
      if (replacementSlot) {
        session.pendingAppointment = Object.assign({}, replacementSlot, {
          start: replacementSlot.start.toISOString(),
          end: replacementSlot.end.toISOString(),
        });
        responses.push({
          body: `Got it. Shall I move your appointment to ${replacementSlot.displayDate} at ${replacementSlot.displayTime}? Reply YES to confirm.`,
        });
        return responses;
      }

      if (this.isAffirmative(lowerCased)) {
        const appointment = await this.createAppointment({
          organizationId,
          patient,
          session,
          inboundMessage,
        });

        session.pendingAppointment = null;
        session.stage = 'completed';
        session.lastAppointment = {
          id: appointment.id,
          startTime: appointment.startTime.toISOString(),
          endTime: appointment.endTime.toISOString(),
        };

        responses.push({
          body: `✅ All set! Your appointment is booked for ${this.formatDisplayDate(appointment.startTime)} at ${this.formatDisplayTime(appointment.startTime)}.`,
        });
        responses.push({
          body: 'We will send a reminder before your visit. Reply here if you need any changes.',
        });
        return responses;
      }

      if (this.isNegative(lowerCased)) {
        session.stage = 'awaiting_slot';
        session.pendingAppointment = null;
        responses.push({
          body: 'No problem. Please share the date (YYYY-MM-DD) and time (HH:MM) you would prefer.',
        });
        return responses;
      }

      responses.push({
        body: 'Please reply YES to confirm the appointment or send a new date/time if you need adjustments.',
      });
      return responses;
    }

    const requestedSlot = this.parseAppointmentRequest(messageText);

    if (requestedSlot) {
      session.pendingAppointment = Object.assign({}, requestedSlot, {
        start: requestedSlot.start.toISOString(),
        end: requestedSlot.end.toISOString(),
      });
      session.stage = 'awaiting_confirmation';
      session.context.reason = this.deriveReason(messageText);
      responses.push({
        body: `Great! I can schedule you on ${requestedSlot.displayDate} at ${requestedSlot.displayTime}. Reply YES to confirm.`,
      });
      return responses;
    }

    if (!messageText) {
      responses.push({
        body: 'To help you schedule a visit, please reply with the date (YYYY-MM-DD) and time (HH:MM) that works for you.',
      });
      return responses;
    }

    responses.push({
      body: 'I can help you book an appointment. Please include the date (YYYY-MM-DD) and time (HH:MM) you prefer in your reply.',
    });

    return responses;
  }

  deriveReason(messageText) {
    if (!messageText) {
      return null;
    }

    const sanitized = messageText.replace(/\s+/g, ' ').trim();
    if (!sanitized) {
      return null;
    }

    return sanitized.length > 180 ? `${sanitized.slice(0, 177)}...` : sanitized;
  }

  parseAppointmentRequest(text) {
    if (!text) {
      return null;
    }

    const dateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (!dateMatch) {
      return null;
    }

    const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i);
    if (!timeMatch) {
      return null;
    }

    const date = dateMatch[1];
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || '00', 10);
    const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
      return null;
    }

    if (meridiem) {
      if (meridiem.startsWith('p') && hours < 12) {
        hours += 12;
      }
      if (meridiem.startsWith('a') && hours === 12) {
        hours = 0;
      }
    }

    if (hours > 23) {
      return null;
    }

    const hourSegment = hours.toString().padStart(2, '0');
    const minuteSegment = minutes.toString().padStart(2, '0');
    const isoStart = `${date}T${hourSegment}:${minuteSegment}:00.000Z`;
    const start = new Date(isoStart);

    if (Number.isNaN(start.getTime())) {
      return null;
    }

    const end = new Date(start.getTime() + 30 * 60 * 1000);

    return {
      date,
      time: `${hourSegment}:${minuteSegment}`,
      displayDate: this.formatDisplayDate(start),
      displayTime: this.formatDisplayTime(start),
      start,
      end,
      meridiem: meridiem || null,
    };
  }

  formatDisplayDate(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDisplayTime(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  isAffirmative(text) {
    return ['yes', 'y', 'yup', 'yeah', 'confirm', 'okay', 'ok', 'sure'].includes(text.trim());
  }

  isNegative(text) {
    return ['no', 'n', 'cancel', 'stop', 'later'].includes(text.trim());
  }

  async ensureDefaultBranch(organizationId) {
    let branch = await this.prisma.clinicBranch.findFirst({
      where: { organizationId },
    });

    if (branch) {
      return branch;
    }

    branch = await this.prisma.clinicBranch.create({
      data: {
        organizationId,
        name: 'Main Clinic',
        address: 'Clinic Address Pending',
        operatingHours: {},
      },
    });

    logger.info('Created default clinic branch for PatientFlow', {
      organizationId,
      branchId: branch.id,
    });

    return branch;
  }

  async ensureDefaultDoctor(organizationId) {
    let doctor = await this.prisma.doctor.findFirst({
      where: {
        organizationId,
        isActive: true,
      },
    });

    if (doctor) {
      return doctor;
    }

    const branch = await this.ensureDefaultBranch(organizationId);
    const safeOrg = (organizationId || 'org').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'org';

    doctor = await this.prisma.doctor.create({
      data: {
        firstName: 'Primary',
        lastName: 'Physician',
        email: `default-doctor-${safeOrg}@patientflow.local`,
        phone: null,
        organizationId,
        branchId: branch.id,
        specialty: 'General Practice',
        languages: ['en'],
        isAvailable: true,
        isActive: true,
      },
    });

    logger.info('Created default doctor for PatientFlow', {
      organizationId,
      doctorId: doctor.id,
    });

    return doctor;
  }

  async createAppointment({ organizationId, patient, session, inboundMessage }) {
    const doctor = await this.ensureDefaultDoctor(organizationId);
    const slot = session.pendingAppointment;

    if (!slot || !slot.start) {
      throw new Error('Missing pending appointment slot information');
    }

    const startTime = slot.start instanceof Date ? slot.start : new Date(slot.start);
    if (Number.isNaN(startTime.getTime())) {
      throw new Error('Invalid appointment start time');
    }

    const endTime = slot.end
      ? (slot.end instanceof Date ? slot.end : new Date(slot.end))
      : new Date(startTime.getTime() + 30 * 60 * 1000);

    const channelMetadata = {
      source: 'whatsapp',
      inboundMessageSid: inboundMessage.sid,
      sessionKey: session.sessionKey,
      retryCount: inboundMessage.retryCount || 0,
      receivedAt: inboundMessage.receivedAt?.toISOString?.() || new Date().toISOString(),
    };

    const appointment = await this.prisma.appointment.create({
      data: {
        organizationId,
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'BOOKED',
        source: 'WHATSAPP',
        channel: 'WHATSAPP',
        startTime,
        endTime,
        reason: session.context?.reason || null,
        channelMetadata,
      },
    });

    logger.info('Booked appointment via WhatsApp conversation', {
      organizationId,
      appointmentId: appointment.id,
      patientId: patient.id,
    });

    metrics.recordAppointmentBooked(organizationId);

    return appointment;
  }

  async logPatientMessage({ organizationId, patientId, direction, payload, externalMessageId, metadata }) {
    try {
      await this.prisma.patientMessageLog.create({
        data: {
          organizationId,
          patientId,
          channel: 'WHATSAPP',
          direction,
          payload: payload || {},
          externalMessageId: externalMessageId || null,
          metadata: metadata || {},
        },
      });
    } catch (error) {
      logger.error('Failed to persist patient message log', {
        organizationId,
        patientId,
        direction,
        error: error.message,
      });
    }
  }
}

module.exports = new ConversationOrchestrator();
