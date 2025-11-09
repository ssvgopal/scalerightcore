// tests/patientflow/mocks.js - Mock utilities for PatientFlow tests

// Mock Prisma Client
const createMockPrisma = () => ({
  patient: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  patientPreference: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn()
  },
  patientNote: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  appointment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  doctor: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  doctorSchedule: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  },
  clinicBranch: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  organization: {
    findUnique: jest.fn(),
    findMany: jest.fn()
  },
  conversationSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  patientMessageLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  patientCallLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  $transaction: jest.fn((callback) => callback(createMockPrisma())),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn()
});

// Mock Twilio Client
const createMockTwilio = () => ({
  messages: {
    create: jest.fn().mockResolvedValue({
      sid: 'test-message-sid',
      status: 'sent',
      to: '+12345678900',
      from: '+12345678999'
    })
  },
  calls: {
    create: jest.fn().mockResolvedValue({
      sid: 'test-call-sid',
      status: 'queued',
      to: '+12345678900',
      from: '+12345678999'
    })
  }
});

// Mock LLM Service (OpenAI)
const createMockLLMService = () => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              type: 'book_appointment',
              confidence: 0.95,
              parameters: {
                preferredDate: '2024-12-16',
                preferredTime: '10:00'
              }
            })
          }
        }]
      })
    }
  }
});

// Mock Database
const createMockDatabase = () => ({
  client: createMockPrisma(),
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  healthCheck: jest.fn().mockResolvedValue({
    status: 'healthy',
    responseTime: 10
  }),
  transaction: jest.fn((callback) => callback(createMockPrisma()))
});

// Mock Logger
const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

// Mock Fastify Request/Reply
const createMockRequest = (overrides = {}) => ({
  body: {},
  headers: {},
  params: {},
  query: {},
  organizationId: 'test-org-id',
  ...overrides
});

const createMockReply = () => {
  const reply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis()
  };
  return reply;
};

// Mock Environment Variables
const setMockEnv = (overrides = {}) => {
  const originalEnv = process.env;
  
  process.env = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
    JWT_SECRET: 'test-jwt-secret',
    TWILIO_WEBHOOK_SECRET: 'test-webhook-secret',
    OPENAI_API_KEY: 'test-openai-key',
    ...overrides
  };
  
  return () => {
    process.env = originalEnv;
  };
};

// Mock Date utilities
const mockDate = (dateString) => {
  const mockDate = new Date(dateString);
  const originalDate = global.Date;
  
  global.Date = jest.fn(() => mockDate);
  global.Date.UTC = originalDate.UTC;
  global.Date.parse = originalDate.parse;
  global.Date.now = jest.fn(() => mockDate.getTime());
  
  // Copy static methods
  Object.setPrototypeOf(global.Date, originalDate);
  Object.getOwnPropertyNames(originalDate).forEach(name => {
    if (name !== 'length' && name !== 'name' && name !== 'prototype') {
      global.Date[name] = originalDate[name];
    }
  });
  
  return () => {
    global.Date = originalDate;
  };
};

// Reset all mocks
const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};

// Spy on console methods
const spyOnConsole = () => {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });
  
  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });
};

// Mock crypto for signature validation
const mockCrypto = () => {
  const originalCrypto = global.crypto;
  
  global.crypto = {
    ...originalCrypto,
    timingSafeEqual: jest.fn((a, b) => {
      return a.length === b.length && a.every((val, index) => val === b[index]);
    })
  };
  
  return () => {
    global.crypto = originalCrypto;
  };
};

// Test data generators
const generateTestPatient = (overrides = {}) => ({
  id: 'patient_test_123',
  organizationId: 'org_test_123',
  firstName: 'Test',
  lastName: 'Patient',
  phone: '+12345678900',
  email: 'test@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides
});

const generateTestAppointment = (overrides = {}) => ({
  id: 'apt_test_123',
  organizationId: 'org_test_123',
  patientId: 'patient_test_123',
  doctorId: 'doctor_test_123',
  status: 'BOOKED',
  source: 'WHATSAPP',
  channel: 'whatsapp',
  startTime: new Date('2024-12-15T10:00:00.000Z'),
  endTime: new Date('2024-12-15T10:30:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides
});

const generateTestDoctor = (overrides = {}) => ({
  id: 'doctor_test_123',
  organizationId: 'org_test_123',
  firstName: 'Test',
  lastName: 'Doctor',
  specialization: 'General Practice',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides
});

// Async test utilities
const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock event emitter
const createMockEventEmitter = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
});

module.exports = {
  createMockPrisma,
  createMockTwilio,
  createMockLLMService,
  createMockDatabase,
  createMockLogger,
  createMockRequest,
  createMockReply,
  setMockEnv,
  mockDate,
  resetAllMocks,
  spyOnConsole,
  mockCrypto,
  generateTestPatient,
  generateTestAppointment,
  generateTestDoctor,
  waitFor,
  flushPromises,
  createMockEventEmitter
};