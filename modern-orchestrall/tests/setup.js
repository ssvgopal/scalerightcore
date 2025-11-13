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
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-account-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-auth-token';
process.env.TWILIO_PHONE_NUMBER = '+1-555-0000';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'test-whatsapp-biz-id';
process.env.WHATSAPP_API_KEY = 'test-whatsapp-api-key';
process.env.LLM_SERVICE_URL = 'http://localhost:3000';
process.env.LLM_API_KEY = 'test-llm-api-key';

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