const createMockPrisma = () => {
  const mockData = {};

  const mockClient = {
    patient: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patientPreference: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    patientNote: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    doctor: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    doctorSchedule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    clinicBranch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversationSession: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    patientMessageLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    patientCallLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  return mockClient;
};

const createMockLlmService = () => {
  return {
    getIntentAndTools: jest.fn().mockResolvedValue({
      intent: 'booking',
      response: 'I can help you book an appointment',
      toolInvocations: ['BOOK_APPOINTMENT'],
    }),
    processMessage: jest.fn().mockResolvedValue({
      response: 'Processing your request',
    }),
  };
};

const createMockTwilioClient = () => {
  return {
    calls: {
      create: jest.fn().mockResolvedValue({
        sid: 'CA-test-123',
        from: '+1-555-1111',
        to: '+1-555-2222',
        status: 'initiated',
      }),
    },
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SM-test-456',
        to: '+1-555-2222',
        body: 'Test message',
        status: 'queued',
      }),
    },
  };
};

const createMockWhatsAppClient = () => {
  return {
    sendMessage: jest.fn().mockResolvedValue({
      messageId: 'wamid-test-789',
      status: 'sent',
    }),
    getTemplate: jest.fn().mockResolvedValue({
      id: 'template-123',
      name: 'appointment_reminder',
      status: 'APPROVED',
    }),
  };
};

module.exports = {
  createMockPrisma,
  createMockLlmService,
  createMockTwilioClient,
  createMockWhatsAppClient,
};
