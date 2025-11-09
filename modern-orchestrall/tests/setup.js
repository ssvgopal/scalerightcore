// Test setup file

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.OPENWEATHER_API_KEY = 'test-openweather-key';
process.env.GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
process.env.NCDEX_API_KEY = 'test-ncdex-key';
process.env.AGMARKNET_API_KEY = 'test-agmarknet-key';

// PatientFlow specific environment variables
process.env.TWILIO_WEBHOOK_SECRET = 'test-twilio-webhook-secret';
process.env.OPENAI_API_KEY = 'test-openai-api-key';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-account-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Mock external dependencies for PatientFlow tests
jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn()
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent'
      })
    },
    calls: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-call-sid',
        status: 'queued'
      })
    }
  }))
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                type: 'book_appointment',
                confidence: 0.95,
                parameters: {}
              })
            }
          }]
        })
      }
    }
  }))
}));

// Mock crypto for signature validation
const originalCrypto = global.crypto;

beforeAll(() => {
  global.crypto = {
    ...originalCrypto,
    createHmac: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn((format) => {
        if (format === 'base64') {
          return 'mock-signature';
        }
        return 'mock-signature';
      })
    })),
    timingSafeEqual: jest.fn((a, b) => {
      return a.length === b.length && a.every((val, index) => val === b[index]);
    })
  };
});

afterAll(() => {
  global.crypto = originalCrypto;
});