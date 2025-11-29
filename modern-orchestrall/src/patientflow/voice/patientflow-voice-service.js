const { OpenAI } = require('openai');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const twilio = require('twilio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const config = require('../../config');
const cacheService = require('../../cache');
const logger = require('../../utils/logger');

const DEFAULT_AUDIO_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_GATHER_TIMEOUT = config.voice.gatherTimeout || 6;
const MAX_GATHER_ATTEMPTS = config.voice.maxGatherAttempts || 3;
const DEFAULT_TTS_LANGUAGE = config.googleCloud.ttsLanguageCode || 'en-US';
const DEFAULT_TTS_VOICE = config.googleCloud.ttsVoiceName || '';
const DEFAULT_TTS_RATE = config.googleCloud.ttsSpeakingRate || 1.0;
const RESCHEDULE_OFFSET_MINUTES = 60;

class PatientflowVoiceService {
  constructor(prisma) {
    this.prisma = prisma;
    this.twilioVoiceResponse = twilio.twiml.VoiceResponse;
    this.openai = config.ai.openaiApiKey ? new OpenAI({ apiKey: config.ai.openaiApiKey }) : null;
    this.ttsClient = null;
    this.sessionStore = new Map();
    this.audioStore = new Map();
    this.analytics = {
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      paths: {},
      averageDurationMs: 0,
    };
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (!cacheService.isConnected) {
        await cacheService.connect().catch((error) => {
          logger.warn('PatientflowVoiceService redis connection failed, using in-memory fallback', {
            error: error.message,
          });
        });
      }

      this.ttsClient = new TextToSpeechClient();
      this.isInitialized = true;
      logger.info('PatientflowVoiceService initialized');
    } catch (error) {
      logger.error('Failed to initialize PatientflowVoiceService', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle the initial Twilio webhook request when a call is received.
   */
  async handleIncomingCall(payload, organizationId, baseUrl) {
    const { CallSid: callSid, From: fromNumber = '', To: toNumber = '' } = payload || {};

    if (!callSid) {
      throw new Error('Missing CallSid from Twilio payload');
    }

    const session = await this.bootstrapSession({ callSid, organizationId, fromNumber, toNumber });
    const patient = await this.resolvePatient(organizationId, session.normalizedFrom);

    if (patient) {
      session.patient = {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        status: patient.status,
      };
      session.state.phase = 'existing_menu';
      session.state.languageCode = this.detectPreferredLanguage(patient);
      session.isExistingPatient = true;
      await this.recordCallLog(session, 'ANSWERED');
    } else {
      session.patient = null;
      session.state.phase = 'identify';
      session.isExistingPatient = false;
      session.state.languageCode = DEFAULT_TTS_LANGUAGE;
      await this.recordCallLog(session, 'ANSWERED');
    }

    await this.persistSession(session);
    return this.buildInitialMenu(session, baseUrl);
  }

  /**
   * Handle gather callbacks for subsequent IVR interactions.
   */
  async handleGather(payload, organizationId, baseUrl) {
    const { CallSid: callSid, From: fromNumber = '', To: toNumber = '' } = payload || {};
    if (!callSid) {
      throw new Error('Missing CallSid from Twilio payload');
    }

    const session = await this.bootstrapSession({ callSid, organizationId, fromNumber, toNumber });
    const input = this.parseUserInput(payload);

    session.analytics.lastInteractionAt = new Date().toISOString();
    session.analytics.lastInput = input;

    switch (session.state.phase) {
      case 'existing_menu':
        return await this.processExistingPatientMenu(session, input, baseUrl);
      case 'identify':
        return await this.processIdentification(session, input, baseUrl);
      case 'new_patient_name':
        return await this.processNewPatientName(session, input, baseUrl);
      case 'new_patient_reason':
        return await this.processNewPatientReason(session, input, baseUrl);
      case 'reschedule_confirm':
        return await this.processRescheduleConfirmation(session, input, baseUrl);
      case 'ai_conversation':
        return await this.continueAIConversation(session, input, baseUrl);
      default:
        return this.buildFallbackResponse(session, baseUrl, 'I did not understand that. Let me connect you to our care assistant.');
    }
  }

  /**
   * Process Twilio recording webhook for transcription + summary.
   */
  async handleRecording(payload, organizationId) {
    const { CallSid: callSid, RecordingUrl: recordingUrl, RecordingSid: recordingSid, RecordingDuration } = payload || {};

    if (!callSid || !recordingUrl) {
      logger.warn('Recording webhook missing required fields', { callSid, recordingUrl });
      return { success: false, reason: 'missing-fields' };
    }

    const session = await this.getSession(callSid);
    if (!session) {
      logger.warn('Recording webhook received without session', { callSid });
      return { success: false, reason: 'session-not-found' };
    }

    const audioUrl = `${recordingUrl}.mp3`;
    const audioPath = path.join(os.tmpdir(), `${recordingSid || callSid}.mp3`);

    try {
      await this.downloadRecording(audioUrl, audioPath);
      const transcript = await this.transcribeRecording(audioPath);

      session.transcript = transcript;
      session.recordingDuration = RecordingDuration ? Number(RecordingDuration) : null;
      session.state.phase = 'completed';
      await this.persistSession(session);

      const summary = await this.generateCallSummary(session, transcript);
      await this.finalizeCallLog(session, transcript, summary);
      await this.closeConversationSession(session);

      this.analytics.completedCalls += 1;

      return { success: true, transcript, summary };
    } catch (error) {
      logger.error('Failed to process recording webhook', { error: error.message, callSid });
      await this.finalizeCallLog(session, null, null, error.message);
      this.analytics.failedCalls += 1;
      return { success: false, reason: error.message };
    } finally {
      fs.promises.unlink(audioPath).catch(() => {});
    }
  }

  /**
   * Retrieve audio metadata for streaming endpoint.
   */
  getAudioResource(audioId) {
    const record = this.audioStore.get(audioId);
    if (!record) return null;

    const expired = Date.now() - record.createdAt > DEFAULT_AUDIO_TTL_MS;
    if (expired) {
      this.cleanupAudio(audioId);
      return null;
    }

    return record;
  }

  /**
   * Bootstrap session state either from cache or by creating new entry.
   */
  async bootstrapSession({ callSid, organizationId, fromNumber, toNumber }) {
    let session = await this.getSession(callSid);

    if (!session) {
      session = {
        callSid,
        organizationId: organizationId || config.voice.defaultOrganizationId || null,
        rawFrom: fromNumber,
        rawTo: toNumber,
        normalizedFrom: this.normalizePhoneNumber(fromNumber),
        normalizedTo: this.normalizePhoneNumber(toNumber),
        createdAt: new Date().toISOString(),
        isExistingPatient: false,
        patient: null,
        transcript: null,
        recordingDuration: null,
        state: {
          phase: 'identify',
          gatherAttempts: 0,
          languageCode: DEFAULT_TTS_LANGUAGE,
          newPatient: {
            name: null,
            reason: null,
          },
          reschedule: {
            appointmentId: null,
            proposedStart: null,
          },
          aiConversation: {
            messages: [],
          },
        },
        analytics: {
          startedAt: new Date().toISOString(),
          path: [],
          lastInteractionAt: new Date().toISOString(),
          lastInput: null,
        },
        conversationSessionId: null,
        callLogId: null,
      };

      await this.ensureConversationSession(session);
      this.analytics.totalCalls += 1;
    }

    if (!session.organizationId && organizationId) {
      session.organizationId = organizationId;
    }

    await this.persistSession(session);
    return session;
  }

  /**
   * Parse user input from Twilio gather payload.
   */
  parseUserInput(payload = {}) {
    const digits = payload.Digits ? String(payload.Digits).trim() : null;
    const speech = payload.SpeechResult ? String(payload.SpeechResult).trim() : null;
    const confidence = payload.Confidence ? Number(payload.Confidence) : null;

    const normalizedSpeech = speech ? speech.toLowerCase() : '';

    return {
      digits,
      speech,
      normalizedSpeech,
      confidence,
    };
  }

  /**
   * Handle menu for recognized existing patients.
   */
  async processExistingPatientMenu(session, input, baseUrl) {
    const intent = this.resolveIntent(input, session.isExistingPatient);

    switch (intent) {
      case 'appointment_summary':
        session.analytics.path.push('existing:summary');
        await this.persistSession(session);
        return await this.respondWithAppointmentSummary(session, baseUrl);
      case 'reschedule':
        session.analytics.path.push('existing:reschedule');
        await this.persistSession(session);
        return await this.startRescheduleFlow(session, baseUrl);
      case 'assistant':
      default:
        session.analytics.path.push('existing:assistant');
        await this.persistSession(session);
        return await this.startAIConversation(session, input, baseUrl, 'How can I assist you today?');
    }
  }

  /**
   * Handle initial identification for callers without recognized patient record.
   */
  async processIdentification(session, input, baseUrl) {
    const intent = this.resolveIntent(input, session.isExistingPatient);

    if (intent === 'new_patient' || intent === 'book_appointment') {
      session.state.phase = 'new_patient_name';
      session.state.newPatient.name = null;
      session.state.newPatient.reason = null;
      session.state.stateAttempts = 0;
      session.analytics.path.push('new:collect-name');
      await this.persistSession(session);
      return this.buildGatherResponse(session, baseUrl, {
        prompt: 'Please tell me your full name so I can create your profile.',
        phase: 'new_patient_name',
        hints: 'My name is, new patient name',
      });
    }

    if (intent === 'reschedule' || intent === 'assistant') {
      session.analytics.path.push('identify:assistant');
      session.state.phase = 'ai_conversation';
      session.state.stateAttempts = 0;
      await this.persistSession(session);
      return await this.startAIConversation(session, input, baseUrl, 'Thanks for calling. How can I help you today?');
    }

    session.state.stateAttempts = (session.state.stateAttempts || 0) + 1;
    await this.persistSession(session);

    if (session.state.stateAttempts >= MAX_GATHER_ATTEMPTS) {
      return this.buildHangupResponse('We were unable to capture your selection. Please call us again. Goodbye.');
    }

    return this.buildGatherResponse(session, baseUrl, {
      prompt: 'Press 1 or say "new patient" if this is your first visit. Otherwise, you can say what you need help with.',
      phase: 'identify',
      hints: 'new patient, reschedule, appointment, representative',
      reprompt: true,
    });
  }

  /**
   * Capture new patient name via speech input.
   */
  async processNewPatientName(session, input, baseUrl) {
    if (!input.speech) {
      return this.retryPhase(session, baseUrl, 'new_patient_name', 'I did not catch that name. Please clearly say your full name.');
    }

    session.state.newPatient.name = input.speech;
    session.state.phase = 'new_patient_reason';
    session.state.gatherAttempts = 0;
    session.analytics.path.push('new:collect-reason');
    await this.persistSession(session);

    return this.buildGatherResponse(session, baseUrl, {
      prompt: `Thanks ${input.speech}. Briefly describe the reason for your visit, such as annual checkup or follow up.`,
      phase: 'new_patient_reason',
      hints: 'appointment reason, doctor visit reason',
    });
  }

  /**
   * Handle reason for new patient booking, then create patient + appointment.
   */
  async processNewPatientReason(session, input, baseUrl) {
    if (!input.speech) {
      return this.retryPhase(session, baseUrl, 'new_patient_reason', 'Please share a short reason for your visit.');
    }

    session.state.newPatient.reason = input.speech;
    session.analytics.path.push('new:create');
    session.state.gatherAttempts = 0;

    const patient = await this.createOrUpdatePatientRecord(session);
    session.patient = patient
      ? {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          status: patient.status,
        }
      : session.patient;

    const appointment = await this.createProvisionalAppointment(session, patient);
    const aiPrompt = this.buildNewPatientAIPrompt(session, appointment);

    session.state.phase = 'ai_conversation';
    await this.persistSession(session);

    return await this.startAIConversation(session, { speech: session.state.newPatient.reason }, baseUrl, aiPrompt);
  }

  /**
   * Process confirmation gather for reschedule flow.
   */
  async processRescheduleConfirmation(session, input, baseUrl) {
    if (input.digits === '1' || input.normalizedSpeech.includes('yes')) {
      const appointment = await this.commitReschedule(session);
      session.analytics.path.push('reschedule:confirmed');
      session.state.gatherAttempts = 0;
      await this.persistSession(session);

      const message = appointment
        ? `Your appointment has been moved to ${appointment.startTime.toLocaleString()}.` 
        : 'I have noted your request to reschedule.';

      return await this.startAIConversation(session, input, baseUrl, message, {
        followUp: 'Is there anything else I can help you with?',
      });
    }

    if (input.digits === '2' || input.normalizedSpeech.includes('no')) {
      session.state.phase = 'ai_conversation';
      session.analytics.path.push('reschedule:declined');
      session.state.gatherAttempts = 0;
      await this.persistSession(session);
      return await this.startAIConversation(session, input, baseUrl, 'No changes were made to your appointment. What else can I help you with?');
    }

    return this.retryPhase(session, baseUrl, 'reschedule_confirm', 'Press 1 to confirm the new time or 2 to keep your original appointment.');
  }

  /**
   * Continue AI conversation after the initial prompt.
   */
  async continueAIConversation(session, input, baseUrl) {
    if (!input.speech && !input.digits) {
      return this.retryPhase(session, baseUrl, 'ai_conversation', 'I did not hear anything. Please share your question or say done to finish.');
    }

    if (input.normalizedSpeech.includes('done') || input.normalizedSpeech.includes('nothing')) {
      await this.persistSession(session);
      return this.buildHangupResponse('Thank you for calling. Take care!');
    }

    return await this.startAIConversation(session, input, baseUrl);
  }

  /**
   * Start or continue AI conversation leveraging OpenAI + Google TTS.
   */
  async startAIConversation(session, input, baseUrl, assistantLeadIn = null, options = {}) {
    session.state.phase = 'ai_conversation';
    session.state.gatherAttempts = 0;

    const language = session.state.languageCode || DEFAULT_TTS_LANGUAGE;
    const conversation = session.state.aiConversation;

    if (!conversation.messages.length) {
      conversation.messages.push({
        role: 'system',
        content: 'You are an empathetic healthcare assistant helping patients over the phone. Keep responses under 50 words, confirm key details, and guide them calmly. Use warm tone.',
      });
    }

    if (assistantLeadIn) {
      conversation.messages.push({ role: 'assistant', content: assistantLeadIn });
    }

    const userMessage = input.speech
      ? input.speech
      : input.digits
        ? `Caller selected option ${input.digits}`
        : 'Caller input not captured, continue assistance.';

    conversation.messages.push({ role: 'user', content: userMessage });

    let aiTextResponse;
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: config.ai.defaultModel || 'gpt-4',
          messages: conversation.messages,
          temperature: 0.6,
          max_tokens: 220,
        });
        aiTextResponse = response.choices[0]?.message?.content?.trim();
      } catch (error) {
        logger.error('OpenAI conversation failed', { error: error.message });
      }
    }

    if (!aiTextResponse) {
      aiTextResponse = assistantLeadIn || 'I would love to help. Could you please provide more details?';
    }

    conversation.messages.push({ role: 'assistant', content: aiTextResponse });
    await this.persistSession(session);

    const { audioUrl, fallbackText } = await this.generateTTS(aiTextResponse, language, baseUrl);

    const response = new this.twilioVoiceResponse();
    if (audioUrl) {
      response.play(audioUrl);
    } else {
      response.say(fallbackText, { language: this.twilioLanguageFromLocale(language) });
    }

    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      speechTimeout: 'auto',
      hints: 'yes, no, done, more help, reschedule appointment, new appointment',
    });

    gather.say(options.followUp || 'You can ask another question or say done to finish.', {
      language: this.twilioLanguageFromLocale(language),
    });

    return response.toString();
  }

  /**
   * Build TwiML for initial menu flow.
   */
  buildInitialMenu(session, baseUrl) {
    const response = new this.twilioVoiceResponse();
    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      speechTimeout: 'auto',
      hints: 'appointment, reschedule, new patient, assistant',
    });

    if (session.isExistingPatient && session.patient) {
      gather.say(`Hello ${session.patient.firstName || 'there'}. Press 1 to hear your upcoming appointment, press 2 to reschedule, or press 3 to speak with our AI care assistant. You can also just say what you need.`, {
        language: this.twilioLanguageFromLocale(session.state.languageCode),
      });
    } else {
      gather.say('Welcome to PatientFlow. Press 1 or say "new patient" to book a visit, or tell me how I can help you.', {
        language: this.twilioLanguageFromLocale(session.state.languageCode),
      });
    }

    response.redirect({ method: 'POST' }, this.buildActionUrl('/patientflow/webhooks/voice', session, baseUrl));
    return response.toString();
  }

  /**
   * Provide appointment summary for existing patient.
   */
  async respondWithAppointmentSummary(session, baseUrl) {
    const appointment = await this.findUpcomingAppointment(session);
    const response = new this.twilioVoiceResponse();

    if (!appointment) {
      response.say('I could not find any upcoming appointments. Would you like to schedule one?', {
        language: this.twilioLanguageFromLocale(session.state.languageCode),
      });
      response.redirect(this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl));
      return response.toString();
    }

    const dateTimeStr = appointment.startTime.toLocaleString();
    response.say(`Your next appointment is on ${dateTimeStr} with Doctor ${appointment.doctor?.lastName || appointment.doctor?.firstName}.`, {
      language: this.twilioLanguageFromLocale(session.state.languageCode),
    });

    session.state.phase = 'ai_conversation';
    await this.persistSession(session);

    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      speechTimeout: 'auto',
      hints: 'reschedule, assistant, done',
    });
    gather.say('You can say reschedule, talk to assistant, or done to finish.', {
      language: this.twilioLanguageFromLocale(session.state.languageCode),
    });

    return response.toString();
  }

  /**
   * Initiate reschedule flow.
   */
  async startRescheduleFlow(session, baseUrl) {
    const appointment = await this.findUpcomingAppointment(session);
    if (!appointment) {
      session.state.phase = 'ai_conversation';
      await this.persistSession(session);
      return await this.startAIConversation(session, { speech: 'reschedule' }, baseUrl, 'I could not find an appointment to reschedule. Let me connect you to the assistant.');
    }

    const proposed = new Date(appointment.startTime.getTime() + RESCHEDULE_OFFSET_MINUTES * 60000);
    session.state.reschedule = {
      appointmentId: appointment.id,
      proposedStart: proposed.toISOString(),
    };
    session.state.phase = 'reschedule_confirm';
    await this.persistSession(session);

    const response = new this.twilioVoiceResponse();
    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      numDigits: 1,
      hints: 'yes, no, confirm, keep',
    });

    gather.say(`I can move your appointment to ${proposed.toLocaleString()}. Press 1 or say yes to confirm, or press 2 to keep your current time.`, {
      language: this.twilioLanguageFromLocale(session.state.languageCode),
    });

    return response.toString();
  }

  /**
   * Build fallback response when input not understood.
   */
  buildFallbackResponse(session, baseUrl, prompt) {
    const response = new this.twilioVoiceResponse();
    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      hints: 'appointment, reschedule, assistant, new patient',
    });

    gather.say(prompt, {
      language: this.twilioLanguageFromLocale(session.state.languageCode),
    });

    return response.toString();
  }

  retryPhase(session, baseUrl, phase, prompt) {
    session.state.phase = phase;
    session.state.gatherAttempts = (session.state.gatherAttempts || 0) + 1;
    if (session.state.gatherAttempts >= MAX_GATHER_ATTEMPTS) {
      return this.buildHangupResponse('We are having trouble understanding. Please contact the clinic directly. Goodbye.');
    }

    return this.buildGatherResponse(session, baseUrl, {
      prompt,
      phase,
      reprompt: true,
    });
  }

  buildGatherResponse(session, baseUrl, options = {}) {
    const response = new this.twilioVoiceResponse();
    const gather = response.gather({
      action: this.buildActionUrl('/patientflow/webhooks/voice/gather', session, baseUrl),
      method: 'POST',
      input: 'speech dtmf',
      timeout: DEFAULT_GATHER_TIMEOUT,
      speechTimeout: 'auto',
      hints: options.hints,
    });

    gather.say(options.prompt, {
      language: this.twilioLanguageFromLocale(session.state.languageCode),
    });

    if (options.reprompt) {
      response.pause({ length: 1 });
      response.say('Taking you back to the main menu.', {
        language: this.twilioLanguageFromLocale(session.state.languageCode),
      });
      response.redirect(this.buildActionUrl('/patientflow/webhooks/voice', session, baseUrl));
    }

    return response.toString();
  }

  buildHangupResponse(message) {
    const response = new this.twilioVoiceResponse();
    response.say(message, { language: this.twilioLanguageFromLocale(DEFAULT_TTS_LANGUAGE) });
    response.hangup();
    return response.toString();
  }

  normalizePhoneNumber(phone = '') {
    return phone.replace(/[^+\d]/g, '');
  }

  detectPreferredLanguage(patient) {
    const preferences = patient.preferences;
    if (preferences?.preferredLanguage) {
      switch (preferences.preferredLanguage.toLowerCase()) {
        case 'hi':
        case 'hi-in':
          return 'hi-IN';
        case 'te':
        case 'te-in':
          return 'te-IN';
        case 'ta':
        case 'ta-in':
          return 'ta-IN';
        default:
          return 'en-US';
      }
    }
    return 'en-US';
  }

  twilioLanguageFromLocale(locale) {
    if (!locale) return 'en-US';
    if (locale.includes('-')) return locale;

    switch (locale.toLowerCase()) {
      case 'en':
        return 'en-US';
      case 'hi':
        return 'hi-IN';
      case 'te':
        return 'te-IN';
      case 'ta':
        return 'ta-IN';
      default:
        return 'en-US';
    }
  }

  resolveIntent(input, isExisting) {
    if (!input) return 'assistant';

    const speech = input.normalizedSpeech || '';

    if (input.digits === '1' || speech.includes('appointment') || speech.includes('upcoming')) {
      return isExisting ? 'appointment_summary' : 'new_patient';
    }

    if (input.digits === '2' || speech.includes('reschedule') || speech.includes('change')) {
      return 'reschedule';
    }

    if (input.digits === '3' || speech.includes('assistant') || speech.includes('agent') || speech.includes('help')) {
      return 'assistant';
    }

    if (speech.includes('new patient') || speech.includes('book') || speech.includes('schedule')) {
      return 'new_patient';
    }

    if (speech.includes('yes')) {
      return 'yes';
    }

    return 'assistant';
  }

  buildActionUrl(pathname, session, baseUrl, extra = {}) {
    const params = new URLSearchParams({
      callSid: session.callSid,
      orgId: session.organizationId || '',
      ...extra,
    });
    return `${baseUrl}${pathname}?${params.toString()}`;
  }

  async getSession(callSid) {
    if (this.sessionStore.has(callSid)) {
      return this.sessionStore.get(callSid);
    }

    if (cacheService.isConnected) {
      const cached = await cacheService.get(this.sessionCacheKey(callSid));
      if (cached) {
        this.sessionStore.set(callSid, cached);
        return cached;
      }
    }

    return null;
  }

  async persistSession(session) {
    this.sessionStore.set(session.callSid, session);

    if (cacheService.isConnected) {
      await cacheService.set(this.sessionCacheKey(session.callSid), session, 3600);
    }

    await this.updateConversationSession(session);
  }

  sessionCacheKey(callSid) {
    return `patientflow:voice:${callSid}`;
  }

  async ensureConversationSession(session) {
    if (!session.organizationId) return;

    const sessionKey = `${session.organizationId}:${session.callSid}`;
    try {
      const record = await this.prisma.conversationSession.upsert({
        where: { sessionKey },
        update: {
          patientPhone: session.normalizedFrom,
          stateJson: session.state,
          isActive: true,
        },
        create: {
          organizationId: session.organizationId,
          patientPhone: session.normalizedFrom,
          sessionKey,
          stateJson: session.state,
          metadata: { callSid: session.callSid },
        },
      });
      session.conversationSessionId = record.id;
    } catch (error) {
      logger.error('Failed to upsert conversation session', { error: error.message });
    }
  }

  async updateConversationSession(session) {
    if (!session.conversationSessionId) {
      await this.ensureConversationSession(session);
      return;
    }

    try {
      await this.prisma.conversationSession.update({
        where: { id: session.conversationSessionId },
        data: {
          stateJson: session.state,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to update conversation session', { error: error.message });
    }
  }

  async closeConversationSession(session) {
    if (!session.conversationSessionId) return;

    try {
      await this.prisma.conversationSession.update({
        where: { id: session.conversationSessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          stateJson: session.state,
        },
      });
    } catch (error) {
      logger.error('Failed to close conversation session', { error: error.message });
    }
  }

  async resolvePatient(organizationId, phone) {
    if (!organizationId || !phone) return null;

    try {
      return await this.prisma.patient.findUnique({
        where: {
          organizationId_phone: {
            organizationId,
            phone,
          },
        },
        include: {
          preferences: true,
        },
      });
    } catch (error) {
      logger.error('Failed to fetch patient by phone', { error: error.message });
      return null;
    }
  }

  async createOrUpdatePatientRecord(session) {
    if (!session.organizationId) return null;

    const existing = await this.resolvePatient(session.organizationId, session.normalizedFrom);
    if (existing) return existing;

    const fullName = session.state.newPatient.name || 'New Patient';
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.length ? rest.join(' ') : 'Patient';

    try {
      return await this.prisma.patient.create({
        data: {
          organizationId: session.organizationId,
          phone: session.normalizedFrom,
          firstName: firstName || 'Guest',
          lastName,
          status: 'active',
          metadata: {
            createdVia: 'voice-ivr',
            callSid: session.callSid,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to create patient record', { error: error.message });
      return null;
    }
  }

  async createProvisionalAppointment(session, patient) {
    if (!patient || !session.organizationId) return null;

    const doctor = await this.prisma.doctor.findFirst({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
    });

    if (!doctor) {
      logger.warn('No active doctor found for appointment creation', { organizationId: session.organizationId });
      return null;
    }

    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + 30 * 60000);

    try {
      const appointment = await this.prisma.appointment.create({
        data: {
          organizationId: session.organizationId,
          patientId: patient.id,
          doctorId: doctor.id,
          status: 'BOOKED',
          source: 'VOICE',
          channel: 'VOICE',
          startTime,
          endTime,
          reason: session.state.newPatient.reason,
          channelMetadata: {
            createdVia: 'voice-ivr',
            callSid: session.callSid,
          },
        },
        include: {
          doctor: true,
        },
      });
      return appointment;
    } catch (error) {
      logger.error('Failed to create appointment', { error: error.message });
      return null;
    }
  }

  buildNewPatientAIPrompt(session, appointment) {
    if (!appointment) {
      return `A new patient named ${session.state.newPatient.name || 'the caller'} wants to book an appointment for ${session.state.newPatient.reason}. Offer to connect them with a scheduling specialist.`;
    }

    return `Booked a new patient appointment on ${appointment.startTime.toLocaleString()} with Dr. ${appointment.doctor?.lastName || appointment.doctor?.firstName}. Confirm the appointment details and ask if they need anything else.`;
  }

  async findUpcomingAppointment(session) {
    if (!session.patient?.id) return null;

    try {
      return await this.prisma.appointment.findFirst({
        where: {
          organizationId: session.organizationId,
          patientId: session.patient.id,
          startTime: {
            gte: new Date(),
          },
        },
        orderBy: { startTime: 'asc' },
        include: {
          doctor: true,
        },
      });
    } catch (error) {
      logger.error('Failed to fetch upcoming appointment', { error: error.message });
      return null;
    }
  }

  async commitReschedule(session) {
    const { appointmentId, proposedStart } = session.state.reschedule || {};
    if (!appointmentId || !proposedStart) return null;

    const newStart = new Date(proposedStart);
    const newEnd = new Date(newStart.getTime() + 30 * 60000);

    try {
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          startTime: newStart,
          endTime: newEnd,
          status: 'BOOKED',
          channelMetadata: {
            ...(session.state.channelMetadata || {}),
            rescheduledVia: 'voice-ivr',
            rescheduledAt: new Date().toISOString(),
          },
        },
      });
      return updated;
    } catch (error) {
      logger.error('Failed to reschedule appointment', { error: error.message });
      return null;
    }
  }

  async generateTTS(text, language, baseUrl) {
    if (!text) {
      return { audioUrl: null, fallbackText: 'I am here to help you with your request.' };
    }

    if (!this.ttsClient) {
      return { audioUrl: null, fallbackText: text };
    }

    try {
      const [response] = await this.ttsClient.synthesizeSpeech({
        input: { text },
        voice: {
          languageCode: language || DEFAULT_TTS_LANGUAGE,
          name: DEFAULT_TTS_VOICE || undefined,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: DEFAULT_TTS_RATE,
        },
      });

      if (response?.audioContent) {
        const audioId = this.storeAudioBuffer(Buffer.from(response.audioContent), { text, language });
        return {
          audioUrl: `${baseUrl}/patientflow/voice/audio/${audioId}`,
          fallbackText: text,
        };
      }
    } catch (error) {
      logger.error('Google TTS synthesis failed', { error: error.message });
    }

    return { audioUrl: null, fallbackText: text };
  }

  storeAudioBuffer(buffer, metadata = {}) {
    const audioId = crypto.randomUUID();
    const filePath = path.join(os.tmpdir(), `patientflow-voice-${audioId}.mp3`);

    fs.writeFileSync(filePath, buffer);
    this.audioStore.set(audioId, {
      id: audioId,
      filePath,
      metadata,
      createdAt: Date.now(),
    });

    setTimeout(() => this.cleanupAudio(audioId), DEFAULT_AUDIO_TTL_MS).unref?.();
    return audioId;
  }

  cleanupAudio(audioId) {
    const record = this.audioStore.get(audioId);
    if (!record) return;

    fs.promises.unlink(record.filePath).catch(() => {});
    this.audioStore.delete(audioId);
  }

  async downloadRecording(url, destinationPath) {
    if (!config.voice.twilioAccountSid || !config.voice.twilioAuthToken) {
      throw new Error('Twilio credentials not configured for recording download');
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      auth: {
        username: config.voice.twilioAccountSid,
        password: config.voice.recordingCallbackAuthToken || config.voice.twilioAuthToken,
      },
    });

    await fs.promises.writeFile(destinationPath, response.data);
  }

  async transcribeRecording(filePath) {
    if (!this.openai) {
      return 'Transcription unavailable. OpenAI credentials missing.';
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'whisper-1',
          response_format: 'text',
        });
        if (typeof transcription === 'string') {
          return transcription;
        }
        if (transcription && typeof transcription.text === 'string') {
          return transcription.text;
        }
        return '';
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        const delay = attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return '';
  }

  async generateCallSummary(session, transcript) {
    if (!this.openai || !transcript) {
      return transcript ? transcript.slice(0, 280) : null;
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.ai.defaultModel || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Summarize the patient phone call in 3 sentences, highlighting intent, actions taken, and follow-up.',
          },
          {
            role: 'user',
            content: transcript.slice(0, 6000),
          },
        ],
        temperature: 0.4,
        max_tokens: 150,
      });
      return completion.choices[0]?.message?.content?.trim();
    } catch (error) {
      logger.error('Failed to generate call summary', { error: error.message });
      return transcript ? transcript.slice(0, 280) : null;
    }
  }

  async recordCallLog(session, status) {
    if (!session.organizationId || !session.normalizedFrom) return;

    let patientId = session.patient?.id || null;
    if (!patientId) {
      const patient = await this.resolvePatient(session.organizationId, session.normalizedFrom);
      patientId = patient?.id || null;
    }

    const data = {
      organizationId: session.organizationId,
      patientId,
      callSid: session.callSid,
      status: status || 'INITIATED',
      startTime: new Date(session.analytics.startedAt || Date.now()),
      callMetadata: {
        from: session.normalizedFrom,
        to: session.normalizedTo,
        path: session.analytics.path,
      },
    };

    try {
      const existing = await this.prisma.patientCallLog.findFirst({
        where: {
          organizationId: session.organizationId,
          callSid: session.callSid,
        },
      });

      if (existing) {
        const updated = await this.prisma.patientCallLog.update({
          where: { id: existing.id },
          data,
        });
        session.callLogId = updated.id;
        await this.persistSession(session);
        return updated;
      }

      const created = await this.prisma.patientCallLog.create({ data });
      session.callLogId = created.id;
      await this.persistSession(session);
      return created;
    } catch (error) {
      logger.error('Failed to record call log', { error: error.message });
      return null;
    }
  }

  async finalizeCallLog(session, transcript, summary, errorMessage = null) {
    if (!session.callLogId) {
      await this.recordCallLog(session, errorMessage ? 'FAILED' : 'COMPLETED');
    }

    const update = {
      status: errorMessage ? 'FAILED' : 'COMPLETED',
      endTime: new Date(),
      transcription: transcript,
      summary: summary,
      durationSeconds: session.recordingDuration || null,
      callMetadata: {
        ...((await this.fetchExistingCallMetadata(session.callLogId)) || {}),
        error: errorMessage,
        path: session.analytics.path,
        transcriptLength: transcript ? transcript.length : 0,
      },
    };

    try {
      await this.prisma.patientCallLog.update({
        where: { id: session.callLogId },
        data: update,
      });

      logger.info('PatientFlow voice call completed', {
        callSid: session.callSid,
        organizationId: session.organizationId,
        status: update.status,
        durationSeconds: update.durationSeconds,
        path: session.analytics.path,
      });
    } catch (error) {
      logger.error('Failed to finalize call log', { error: error.message });
    }
  }

  async fetchExistingCallMetadata(callLogId) {
    try {
      const record = await this.prisma.patientCallLog.findUnique({
        where: { id: callLogId },
        select: { callMetadata: true },
      });
      return record?.callMetadata || {};
    } catch (error) {
      logger.error('Failed to fetch call metadata', { error: error.message });
      return {};
    }
  }
}

module.exports = PatientflowVoiceService;
