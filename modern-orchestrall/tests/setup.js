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

// Mock console for tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  global.console.log = jest.fn();
  global.console.error = jest.fn();
});

afterAll(() => {
  global.console.log = originalConsoleLog;
  global.console.error = originalConsoleError;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});