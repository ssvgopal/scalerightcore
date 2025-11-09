const PatientService = require('../../src/patientflow/PatientService');
const AppointmentService = require('../../src/patientflow/AppointmentService');
const ConversationOrchestrator = require('../../src/patientflow/ConversationOrchestrator');
const WebhookHandler = require('../../src/patientflow/webhookHandlers');
const {
  createMockPrisma,
  createMockLlmService,
} = require('./utils/mockPrisma');

describe('PatientFlow Integration Tests', () => {
  let patientService;
  let appointmentService;
  let orchestrator;
  let webhookHandler;
  let mockPrisma;
  let mockLlmService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockLlmService = createMockLlmService();

    patientService = new PatientService(mockPrisma);
    appointmentService = new AppointmentService(mockPrisma);
    orchestrator = new ConversationOrchestrator(mockPrisma, mockLlmService);
    webhookHandler = new WebhookHandler(mockPrisma, orchestrator);
  });

  describe('Demo Flow: New Patient Signup', () => {
    it('should complete new patient signup flow', async () => {
      const organizationId = 'org-1';
      const patientData = {
        phone: '+1-555-1000',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@example.com',
        dateOfBirth: '1985-05-15',
        gender: 'F',
        preferredLanguage: 'en',
        preferredTimeSlots: ['morning'],
        preferredChannels: ['phone', 'whatsapp'],
      };

      const mockCreatedPatient = {
        id: 'patient-1',
        organizationId,
        ...patientData,
        status: 'active',
      };

      const mockPreferences = {
        id: 'pref-1',
        patientId: 'patient-1',
        preferredLanguage: 'en',
        preferredTimeSlots: ['morning'],
        preferredChannels: ['phone', 'whatsapp'],
      };

      mockPrisma.patient.create.mockResolvedValue(mockCreatedPatient);
      mockPrisma.patientPreference.findUnique.mockResolvedValue(null);
      mockPrisma.patientPreference.create.mockResolvedValue(mockPreferences);

      const result = await patientService.signupNewPatient(organizationId, patientData);

      expect(result.patient.status).toBe('active');
      expect(result.preferences.preferredLanguage).toBe('en');
      expect(mockPrisma.patient.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.patientPreference.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Demo Flow: WhatsApp Booking Flow', () => {
    it('should handle complete WhatsApp booking conversation', async () => {
      const organizationId = 'org-1';
      const phoneNumber = '+1-555-1000';

      const whatsappPayload = {
        id: 'wh-1',
        from: phoneNumber,
        text: 'I want to book an appointment',
        messageId: 'msg-1',
      };

      const mockSession = {
        id: 'session-1',
        organizationId,
        patientPhone: phoneNumber,
        sessionKey: `${organizationId}:${phoneNumber}`,
        isActive: true,
        stateJson: {
          messages: [],
          context: 'booking_request',
          toolsCalled: [],
        },
      };

      const mockMessageLog = {
        id: 'msglog-1',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        externalMessageId: 'msg-1',
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);
      mockPrisma.conversationSession.create.mockResolvedValue(mockSession);
      mockPrisma.patientMessageLog.create.mockResolvedValue(mockMessageLog);
      mockPrisma.conversationSession.update.mockResolvedValue({
        ...mockSession,
        stateJson: {
          messages: [
            { role: 'user', content: 'I want to book an appointment' },
          ],
        },
      });
      mockLlmService.getIntentAndTools.mockResolvedValue({
        intent: 'booking',
        response: 'I can help you book an appointment',
        toolInvocations: ['BOOK_APPOINTMENT'],
      });

      // For integration test, mock the webhook handler's orchestrator
      const mockOrchestratorForWebhook = {
        getOrCreateSession: jest.fn().mockResolvedValue(mockSession),
        processConversationMessage: jest.fn().mockResolvedValue({
          response: 'I can help you book an appointment',
          toolInvocations: ['BOOK_APPOINTMENT'],
        }),
        decideTool: jest.fn().mockResolvedValue({
          detectedTools: ['BOOK_APPOINTMENT'],
        }),
        closeSession: jest.fn(),
      };

      webhookHandler = new WebhookHandler(mockPrisma, mockOrchestratorForWebhook);

      const whatsappResult = await webhookHandler.handleWhatsAppWebhook(
        whatsappPayload,
        organizationId
      );

      expect(whatsappResult.status).toBe('processed');
      expect(whatsappResult.toolsDetected).toContain('BOOK_APPOINTMENT');
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Demo Flow: Voice Call Booking', () => {
    it('should handle complete voice call booking flow', async () => {
      const organizationId = 'org-1';
      const phoneNumber = '+1-555-1000';

      const voicePayload = {
        id: 'call-1',
        CallSid: 'CA-123456',
        from: phoneNumber,
        CallStatus: 'ANSWERED',
      };

      const mockSession = {
        id: 'session-1',
        organizationId,
        patientPhone: phoneNumber,
        isActive: true,
        stateJson: { messages: [] },
      };

      const mockCallLog = {
        id: 'calllog-1',
        callSid: 'CA-123456',
        status: 'ANSWERED',
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);
      mockPrisma.conversationSession.create.mockResolvedValue(mockSession);
      mockPrisma.patientCallLog.findFirst.mockResolvedValue(null);
      mockPrisma.patientCallLog.create.mockResolvedValue(mockCallLog);
      mockPrisma.patientCallLog.update.mockResolvedValue({
        ...mockCallLog,
        status: 'COMPLETED',
      });
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const mockOrchestratorForWebhook = {
        getOrCreateSession: jest.fn().mockResolvedValue(mockSession),
        decideTool: jest.fn().mockResolvedValue({
          detectedTools: ['BOOK_APPOINTMENT'],
        }),
        closeSession: jest.fn(),
      };

      webhookHandler = new WebhookHandler(mockPrisma, mockOrchestratorForWebhook);

      const voiceResult = await webhookHandler.handleVoiceWebhook(
        voicePayload,
        organizationId
      );

      expect(voiceResult.status).toBe('answered');
      expect(mockPrisma.patientCallLog.create).toHaveBeenCalledTimes(1);

      // Create a new webhook handler instance to avoid duplicate detection
      webhookHandler = new WebhookHandler(mockPrisma, mockOrchestratorForWebhook);
      
      const completedPayload = { ...voicePayload, CallStatus: 'COMPLETED' };
      mockPrisma.patientCallLog.findFirst.mockResolvedValue({
        id: 'calllog-1',
        callSid: 'CA-123456',
        status: 'ANSWERED',
      });
      
      const completedResult = await webhookHandler.handleVoiceWebhook(
        completedPayload,
        organizationId
      );

      expect(completedResult.status).toBe('completed');
    });
  });

  describe('Demo Flow: Appointment Booking and Confirmation', () => {
    it('should book and confirm appointment without conflicts', async () => {
      const organizationId = 'org-1';

      const appointmentData = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: '2025-01-07T10:00:00',
        endTime: '2025-01-07T10:30:00',
        reason: 'Regular checkup',
        source: 'WHATSAPP',
      };

      const mockBooked = {
        id: 'apt-1',
        organizationId,
        ...appointmentData,
        status: 'BOOKED',
        patient: { id: 'patient-1' },
        doctor: { id: 'doctor-1' },
      };

      const mockConfirmed = {
        ...mockBooked,
        status: 'CONFIRMED',
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      mockPrisma.appointment.create.mockResolvedValue(mockBooked);
      mockPrisma.appointment.findUnique.mockResolvedValue(mockBooked);
      mockPrisma.appointment.update.mockResolvedValue(mockConfirmed);

      const bookedApt = await appointmentService.bookAppointment(organizationId, appointmentData);

      expect(bookedApt.status).toBe('BOOKED');
      expect(mockPrisma.appointment.create).toHaveBeenCalledTimes(1);

      const confirmedApt = await appointmentService.confirmAppointment('apt-1');

      expect(confirmedApt.status).toBe('CONFIRMED');
      expect(mockPrisma.appointment.update).toHaveBeenCalledTimes(1);
    });

    it('should prevent double bookings', async () => {
      const organizationId = 'org-1';

      const appointmentData = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: '2025-01-07T10:00:00',
        endTime: '2025-01-07T10:30:00',
      };

      const existingAppointment = {
        id: 'apt-existing',
        doctorId: 'doctor-1',
        startTime: new Date('2025-01-07T10:00:00'),
        endTime: new Date('2025-01-07T10:30:00'),
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(existingAppointment);

      await expect(
        appointmentService.bookAppointment(organizationId, appointmentData)
      ).rejects.toThrow('Time slot conflict with existing appointment');

      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });
  });

  describe('Demo Flow: Appointment Rescheduling', () => {
    it('should reschedule appointment to new available slot', async () => {
      const existingAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        status: 'BOOKED',
        startTime: new Date('2025-01-07T10:00:00'),
        endTime: new Date('2025-01-07T10:30:00'),
      };

      const rescheduledAppointment = {
        ...existingAppointment,
        startTime: new Date('2025-01-08T14:00:00'),
        endTime: new Date('2025-01-08T14:30:00'),
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      mockPrisma.appointment.update.mockResolvedValue(rescheduledAppointment);

      const result = await appointmentService.rescheduleAppointment(
        'apt-1',
        '2025-01-08T14:00:00',
        '2025-01-08T14:30:00'
      );

      expect(result.startTime).toEqual(rescheduledAppointment.startTime);
      expect(mockPrisma.appointment.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Demo Flow: Patient Conversation with Tool Invocation', () => {
    it('should process conversation and invoke booking tool', async () => {
      const sessionId = 'session-1';
      const mockSession = {
        id: sessionId,
        stateJson: JSON.stringify({ messages: [] }),
        isActive: true,
      };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.conversationSession.update.mockResolvedValue({
        ...mockSession,
        stateJson: { messages: [], intent: 'booking' },
      });
      mockLlmService.getIntentAndTools.mockResolvedValue({
        intent: 'booking',
        response: 'I can help you book',
        toolInvocations: ['BOOK_APPOINTMENT'],
      });

      const processResult = await orchestrator.processConversationMessage(
        sessionId,
        'I want to book an appointment'
      );

      expect(processResult.response).toBeDefined();
      expect(processResult.toolInvocations).toBeDefined();

      const toolDecision = await orchestrator.decideTool(
        sessionId,
        'I want to book an appointment'
      );

      expect(toolDecision.detectedTools).toContain('BOOK_APPOINTMENT');

      const invokeResult = await orchestrator.invokeTool(sessionId, 'BOOK_APPOINTMENT', {
        doctorId: 'doctor-1',
        patientId: 'patient-1',
      });

      expect(invokeResult.tool).toBe('BOOK_APPOINTMENT');
      expect(invokeResult.status).toBe('executed');
    });
  });

  describe('Demo Flow: Duplicate Webhook Handling', () => {
    it('should handle duplicate WhatsApp webhooks gracefully', async () => {
      const organizationId = 'org-1';
      const whatsappPayload = {
        id: 'wh-duplicate-1',
        from: '+1-555-1000',
        text: 'Book appointment',
        messageId: 'msg-1',
      };

      const mockSession = { id: 'session-1' };

      mockPrisma.conversationSession.findUnique.mockResolvedValue(null);
      mockPrisma.conversationSession.create.mockResolvedValue(mockSession);
      mockPrisma.patientMessageLog.create.mockResolvedValue({ id: 'msglog-1' });
      mockPrisma.conversationSession.update.mockResolvedValue(mockSession);

      const mockOrchestratorForWebhook = {
        getOrCreateSession: jest.fn().mockResolvedValue(mockSession),
        processConversationMessage: jest.fn().mockResolvedValue({
          response: 'I can help',
          toolInvocations: [],
        }),
        decideTool: jest.fn().mockResolvedValue({
          detectedTools: [],
        }),
        closeSession: jest.fn(),
      };

      webhookHandler = new WebhookHandler(mockPrisma, mockOrchestratorForWebhook);

      const firstCall = await webhookHandler.handleWhatsAppWebhook(
        whatsappPayload,
        organizationId
      );

      expect(firstCall.status).toBe('processed');
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalledTimes(1);

      const secondCall = await webhookHandler.handleWhatsAppWebhook(
        whatsappPayload,
        organizationId
      );

      expect(secondCall.status).toBe('duplicate');
      expect(mockPrisma.patientMessageLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Demo Flow: Patient Cancellation', () => {
    it('should handle appointment cancellation', async () => {
      const existingAppointment = {
        id: 'apt-1',
        status: 'BOOKED',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
      };

      const cancelledAppointment = {
        ...existingAppointment,
        status: 'CANCELLED',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      mockPrisma.appointment.update.mockResolvedValue(cancelledAppointment);

      const result = await appointmentService.cancelAppointment(
        'apt-1',
        'Patient requested cancellation'
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockPrisma.appointment.update).toHaveBeenCalledTimes(1);
    });
  });
});
