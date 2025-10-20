// tests/setup.js - Enhanced Professional Test Setup Configuration
const { PrismaClient } = require('@prisma/client');

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orchestrall_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  process.env.PORT = '3001'; // Use different port for tests
  
  console.log('✅ Test environment configured');
});

// Global test teardown
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any global resources
  if (global.testPrisma) {
    try {
      await global.testPrisma.$disconnect();
    } catch (error) {
      console.log('⚠️ Error disconnecting test database:', error.message);
    }
  }
  
  if (global.testServer) {
    try {
      await global.testServer.close();
    } catch (error) {
      console.log('⚠️ Error closing test server:', error.message);
    }
  }
  
  console.log('✅ Test environment cleaned up');
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests
});

// Mock console methods in test environment to reduce noise
if (process.env.NODE_ENV === 'test') {
  const originalConsole = { ...console };
  
  // Only mock in test environment, not in CI
  if (!process.env.CI) {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }
  
  // Restore console for cleanup
  global.restoreConsole = () => {
    global.console = originalConsole;
  };
}

// Global test utilities
global.testUtils = {
  // Generate random test data
  generateTestOrg: (overrides = {}) => ({
    name: `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}`,
    description: 'Test organization',
    tier: 'premium',
    status: 'active',
    ...overrides
  }),

  generateTestUser: (overrides = {}) => ({
    email: `test-${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    isActive: true,
    ...overrides
  }),

  generateTestProduct: (overrides = {}) => ({
    name: `Test Product ${Date.now()}`,
    description: 'Test product description',
    price: 99.99,
    sku: `SKU-${Date.now()}`,
    status: 'active',
    ...overrides
  }),

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate auth token for tests
  generateAuthToken: async (app) => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@orchestrall.com',
        password: 'admin123'
      }
    });

    const loginData = JSON.parse(loginResponse.payload);
    return loginData.token;
  },

  // Clean up test data
  cleanupTestData: async (prisma) => {
    if (!prisma) return;

    try {
      // Clean up test data in reverse dependency order
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { resource: { contains: 'test' } },
            { resource: { contains: 'Test' } }
          ]
        }
      });

      await prisma.product.deleteMany({
        where: {
          OR: [
            { name: { contains: 'Test' } },
            { sku: { contains: 'SKU-' } }
          ]
        }
      });

      await prisma.user.deleteMany({
        where: {
          email: { contains: 'test' }
        }
      });

      await prisma.organization.deleteMany({
        where: {
          OR: [
            { name: { contains: 'Test' } },
            { slug: { contains: 'test' } }
          ]
        }
      });
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }
};

// Custom matchers for better test assertions
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },

  toBeValidTimestamp(received) {
    const pass = typeof received === 'string' && !isNaN(Date.parse(received));
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid timestamp`,
      pass,
    };
  },

  toBeValidResponseTime(received) {
    const pass = typeof received === 'string' && received.match(/^\d+ms$/);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid response time`,
      pass,
    };
  }
});

// Export test configuration
module.exports = {
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/config.js',
    '!src/database/client.js',
    '!src/utils/logger.js',
    '!src/seed.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};