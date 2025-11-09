// src/patientflow/ConversationOrchestrator.js - Conversation Orchestrator for PatientFlow
const EventEmitter = require('events');
const logger = require('../utils/logger');
const PatientService = require('./PatientService');
const AppointmentService = require('./AppointmentService');

class ConversationOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.patientService = new PatientService();
    this.appointmentService = new AppointmentService();
    this.llmService = null; // Will be injected or mocked
    this.twilioService = null; // Will be injected or mocked
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    await this.patientService.initialize();
    await this.appointmentService.initialize();
    this.initialized = true;
    
    logger.info('Conversation Orchestrator initialized');
  }

  /**
   * Process incoming message and determine appropriate action
   */
  async processMessage(organizationId, message, context = {}) {
    try {
      await this.initialize();
      
      const { phone, channel, content, messageId } = message;
      
      // Get or create patient
      const { patient, isNew } = await this.patientService.getOrCreateByPhone(
        organizationId,
        phone,
        context.patientInfo
      );

      // Get patient preferences
      const preferences = await this.patientService.getPatientPreferences(patient.id);
      
      // Create or update conversation session
      const session = await this.getOrCreateSession(organizationId, patient.id, channel, context);
      
      // Analyze message intent using LLM
      const intent = await this.analyzeIntent(content, {
        patient,
        session,
        preferences,
        organizationId
      });

      // Execute appropriate action based on intent
      const result = await this.executeAction(intent, {
        patient,
        session,
        preferences,
        message,
        organizationId
      });

      // Log the interaction
      await this.logInteraction({
        organizationId,
        patientId: patient.id,
        sessionId: session.id,
        message,
        intent,
        result,
        channel
      });

      return {
        patient,
        session,
        intent,
        result,
        isNewPatient: isNew
      };
    } catch (error) {
      logger.error('Failed to process message', { organizationId, message, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze message intent using LLM
   */
  async analyzeIntent(content, context) {
    try {
      const prompt = this.buildIntentAnalysisPrompt(content, context);
      
      // This would normally call an LLM service
      // For testing, we'll use a simple rule-based approach
      const intent = this.stubLLMResponse(content, context);
      
      logger.info('Intent analyzed', { intent: intent.type, confidence: intent.confidence });
      return intent;
    } catch (error) {
      logger.error('Failed to analyze intent', { content, error: error.message });
      throw error;
    }
  }

  /**
   * Execute action based on intent
   */
  async executeAction(intent, context) {
    try {
      const { patient, session, message, organizationId } = context;
      
      switch (intent.type) {
        case 'book_appointment':
          return await this.handleBookingIntent(intent, context);
          
        case 'reschedule_appointment':
          return await this.handleRescheduleIntent(intent, context);
          
        case 'cancel_appointment':
          return await this.handleCancelIntent(intent, context);
          
        case 'check_appointments':
          return await this.handleCheckAppointmentsIntent(intent, context);
          
        case 'general_inquiry':
          return await this.handleGeneralInquiryIntent(intent, context);
          
        default:
          return await this.handleUnknownIntent(intent, context);
      }
    } catch (error) {
      logger.error('Failed to execute action', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle appointment booking intent
   */
  async handleBookingIntent(intent, context) {
    try {
      const { patient, organizationId } = context;
      const { doctorId, preferredDate, preferredTime } = intent.parameters;

      // Generate available slots
      const { slots } = await this.appointmentService.generateAvailableSlots(
        doctorId,
        preferredDate
      );

      if (slots.length === 0) {
        return {
          type: 'no_slots_available',
          message: 'No available slots found for the requested date.',
          suggestedDates: await this.getSuggestedDates(doctorId, preferredDate)
        };
      }

      // Find the best matching slot
      let selectedSlot = slots[0];
      if (preferredTime) {
        const matchingSlot = slots.find(slot => {
          const slotHour = slot.startTime.getHours();
          const preferredHour = parseInt(preferredTime.split(':')[0]);
          return Math.abs(slotHour - preferredHour) <= 1;
        });
        if (matchingSlot) selectedSlot = matchingSlot;
      }

      // Create the appointment
      const appointment = await this.appointmentService.createAppointment({
        organizationId,
        patientId: patient.id,
        doctorId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        source: 'WHATSAPP',
        channel: context.message.channel,
        notes: 'Booked via conversation'
      });

      return {
        type: 'appointment_booked',
        appointment,
        message: `Appointment confirmed for ${selectedSlot.startTime.toLocaleString()}`
      };
    } catch (error) {
      logger.error('Failed to handle booking intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle appointment rescheduling intent
   */
  async handleRescheduleIntent(intent, context) {
    try {
      const { patient, organizationId } = context;
      const { appointmentId, newDate, newTime } = intent.parameters;

      // Get the appointment
      const appointment = await this.appointmentService.getPatientAppointments(patient.id, {
        limit: 1,
        status: 'BOOKED'
      });

      if (!appointment || appointment.length === 0) {
        return {
          type: 'no_appointment_found',
          message: 'No upcoming appointments found to reschedule.'
        };
      }

      const targetAppointment = appointment.find(apt => apt.id === appointmentId) || appointment[0];

      // Generate new slots
      const { slots } = await this.appointmentService.generateAvailableSlots(
        targetAppointment.doctorId,
        newDate
      );

      if (slots.length === 0) {
        return {
          type: 'no_slots_available',
          message: 'No available slots for the new date.'
        };
      }

      // Select best slot
      const selectedSlot = newTime 
        ? slots.find(slot => {
            const slotHour = slot.startTime.getHours();
            const preferredHour = parseInt(newTime.split(':')[0]);
            return Math.abs(slotHour - preferredHour) <= 1;
          }) || slots[0]
        : slots[0];

      // Reschedule the appointment
      const updatedAppointment = await this.appointmentService.rescheduleAppointment(
        targetAppointment.id,
        {
          newStartTime: selectedSlot.startTime,
          newEndTime: selectedSlot.endTime,
          reason: 'Patient requested reschedule via conversation'
        }
      );

      return {
        type: 'appointment_rescheduled',
        appointment: updatedAppointment,
        message: `Appointment rescheduled to ${selectedSlot.startTime.toLocaleString()}`
      };
    } catch (error) {
      logger.error('Failed to handle reschedule intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle appointment cancellation intent
   */
  async handleCancelIntent(intent, context) {
    try {
      const { patient } = context;
      const { appointmentId } = intent.parameters;

      // Get upcoming appointments
      const appointments = await this.appointmentService.getPatientAppointments(patient.id, {
        status: 'BOOKED',
        limit: 5
      });

      if (!appointments || appointments.length === 0) {
        return {
          type: 'no_appointment_found',
          message: 'No upcoming appointments found to cancel.'
        };
      }

      const targetAppointment = appointmentId 
        ? appointments.find(apt => apt.id === appointmentId)
        : appointments[0];

      if (!targetAppointment) {
        return {
          type: 'appointment_not_found',
          message: 'Appointment not found.'
        };
      }

      // Cancel the appointment
      const cancelledAppointment = await this.appointmentService.cancelAppointment(
        targetAppointment.id,
        {
          reason: 'Patient requested cancellation via conversation'
        }
      );

      return {
        type: 'appointment_cancelled',
        appointment: cancelledAppointment,
        message: 'Appointment has been cancelled.'
      };
    } catch (error) {
      logger.error('Failed to handle cancel intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle check appointments intent
   */
  async handleCheckAppointmentsIntent(intent, context) {
    try {
      const { patient } = context;

      const appointments = await this.appointmentService.getPatientAppointments(patient.id, {
        limit: 5
      });

      return {
        type: 'appointments_list',
        appointments,
        message: `You have ${appointments.length} appointment(s).`
      };
    } catch (error) {
      logger.error('Failed to handle check appointments intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle general inquiry intent
   */
  async handleGeneralInquiryIntent(intent, context) {
    try {
      return {
        type: 'general_response',
        message: 'I can help you book, reschedule, or cancel appointments. How can I assist you today?'
      };
    } catch (error) {
      logger.error('Failed to handle general inquiry intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Handle unknown intent
   */
  async handleUnknownIntent(intent, context) {
    try {
      return {
        type: 'unknown_intent',
        message: 'I did not understand that. Can you please rephrase or let me know how I can help you with your appointments?'
      };
    } catch (error) {
      logger.error('Failed to handle unknown intent', { intent, error: error.message });
      throw error;
    }
  }

  /**
   * Get or create conversation session
   */
  async getOrCreateSession(organizationId, patientId, channel, context) {
    try {
      // For simplicity, we'll create a new session each time
      // In a real implementation, you'd check for existing active sessions
      const session = await this.prisma?.conversationSession.create({
        data: {
          organizationId,
          patientId,
          channel,
          status: 'active',
          stateJson: context.sessionState || {},
          metadata: {
            startedAt: new Date(),
            channel
          }
        }
      });

      return session;
    } catch (error) {
      logger.error('Failed to get or create session', { organizationId, patientId, error: error.message });
      // Fallback to mock session if database is not available
      return {
        id: `mock-session-${Date.now()}`,
        organizationId,
        patientId,
        channel,
        status: 'active',
        stateJson: {},
        metadata: {}
      };
    }
  }

  /**
   * Log interaction
   */
  async logInteraction(logData) {
    try {
      // Log to database if available
      if (this.prisma) {
        await this.prisma.patientMessageLog.create({
          data: {
            organizationId: logData.organizationId,
            patientId: logData.patientId,
            channel: logData.channel,
            direction: 'inbound',
            content: logData.message.content,
            metadata: {
              intent: logData.intent,
              result: logData.result,
              sessionId: logData.sessionId
            }
          }
        });
      }

      logger.info('Interaction logged', logData);
    } catch (error) {
      logger.error('Failed to log interaction', { logData, error: error.message });
    }
  }

  /**
   * Build intent analysis prompt for LLM
   */
  buildIntentAnalysisPrompt(content, context) {
    return `
Analyze the following patient message and determine the intent:

Message: "${content}"

Context:
- Patient: ${context.patient.firstName} ${context.patient.lastName}
- Current session state: ${JSON.stringify(context.session.stateJson || {})}

Possible intents:
- book_appointment: Patient wants to book a new appointment
- reschedule_appointment: Patient wants to change an existing appointment
- cancel_appointment: Patient wants to cancel an appointment
- check_appointments: Patient wants to see their appointments
- general_inquiry: General question or greeting

Return the intent as JSON with:
{
  "type": "intent_type",
  "confidence": 0.95,
  "parameters": {
    "doctorId": "doctor_id_if_mentioned",
    "preferredDate": "date_if_mentioned",
    "preferredTime": "time_if_mentioned",
    "appointmentId": "appointment_id_if_mentioned"
  }
}
    `;
  }

  /**
   * Stub LLM response for testing
   */
  stubLLMResponse(content, context) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('book') || lowerContent.includes('appointment') && lowerContent.includes('new')) {
      return {
        type: 'book_appointment',
        confidence: 0.9,
        parameters: this.extractBookingParams(content)
      };
    }
    
    if (lowerContent.includes('reschedule') || lowerContent.includes('change') || lowerContent.includes('move')) {
      return {
        type: 'reschedule_appointment',
        confidence: 0.9,
        parameters: this.extractRescheduleParams(content)
      };
    }
    
    if (lowerContent.includes('cancel')) {
      return {
        type: 'cancel_appointment',
        confidence: 0.9,
        parameters: this.extractCancelParams(content)
      };
    }
    
    if (lowerContent.includes('appointment') || lowerContent.includes('schedule') || lowerContent.includes('when')) {
      return {
        type: 'check_appointments',
        confidence: 0.8,
        parameters: {}
      };
    }
    
    return {
      type: 'general_inquiry',
      confidence: 0.7,
      parameters: {}
    };
  }

  /**
   * Extract booking parameters from message
   */
  extractBookingParams(content) {
    const params = {};
    
    // Extract date patterns
    const dateMatch = content.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|tomorrow|today|next week)\b/i);
    if (dateMatch) {
      params.preferredDate = dateMatch[1];
    }
    
    // Extract time patterns
    const timeMatch = content.match(/\b(\d{1,2}:\d{2}\s*(am|pm)?)\b/i);
    if (timeMatch) {
      params.preferredTime = timeMatch[1];
    }
    
    return params;
  }

  /**
   * Extract reschedule parameters from message
   */
  extractRescheduleParams(content) {
    const params = {};
    
    // Similar to booking but might include appointment ID
    const idMatch = content.match(/\b(apt-?\d+|appointment\s*\d+)\b/i);
    if (idMatch) {
      params.appointmentId = idMatch[1].replace(/[^0-9]/g, '');
    }
    
    const dateMatch = content.match(/\b(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|tomorrow|today|next week)\b/i);
    if (dateMatch) {
      params.newDate = dateMatch[1];
    }
    
    const timeMatch = content.match(/\b(\d{1,2}:\d{2}\s*(am|pm)?)\b/i);
    if (timeMatch) {
      params.newTime = timeMatch[1];
    }
    
    return params;
  }

  /**
   * Extract cancel parameters from message
   */
  extractCancelParams(content) {
    const params = {};
    
    const idMatch = content.match(/\b(apt-?\d+|appointment\s*\d+)\b/i);
    if (idMatch) {
      params.appointmentId = idMatch[1].replace(/[^0-9]/g, '');
    }
    
    return params;
  }

  /**
   * Get suggested dates for appointments
   */
  async getSuggestedDates(doctorId, currentDate) {
    // Simple implementation - return next 3 days
    const suggestions = [];
    const date = new Date(currentDate);
    
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + i);
      suggestions.push(nextDate.toISOString().split('T')[0]);
    }
    
    return suggestions;
  }
}

module.exports = ConversationOrchestrator;