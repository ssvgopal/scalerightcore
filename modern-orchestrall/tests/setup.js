// tests/setup.js - Jest Test Setup
const { PrismaClient } = require('@prisma/client');

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orchestrall_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
});

afterAll(async () => {
  // Cleanup after all tests
  try {
    const prisma = new PrismaClient();
    await prisma.$disconnect();
  } catch (error) {
    console.error('Test cleanup error:', error);
  }
});

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestOrganization: () => ({
    id: 'test-org-' + Date.now(),
    name: 'Test Organization',
    slug: 'test-org-' + Date.now(),
    tier: 'starter'
  }),

  generateTestUser: (organizationId) => ({
    email: 'test@example.com',
    name: 'Test User',
    organizationId: organizationId || 'test-org'
  }),

  generateTestProduct: (organizationId) => ({
    name: 'Test Product',
    description: 'Test product description',
    price: 99.99,
    sku: 'TEST-SKU-' + Date.now(),
    organizationId: organizationId || 'test-org'
  }),

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock logger for tests
  mockLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
};

// Suppress console logs during tests unless explicitly enabled
if (!process.env.TEST_VERBOSE) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}
