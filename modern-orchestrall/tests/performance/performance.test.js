// tests/performance/performance.test.js - Professional Performance Tests
const { PrismaClient } = require('@prisma/client');

describe('Performance Tests', () => {
  let app;
  let prisma;
  let authToken;

  beforeAll(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orchestrall_test'
        }
      }
    });

    try {
      await prisma.$connect();
      console.log('✅ Test database connected for performance tests');
    } catch (error) {
      console.log('⚠️ Test database not available, using mock mode');
    }

    // Import and initialize the app
    const ZeroConfigServer = require('../../src/app-zero-config');
    const server = new ZeroConfigServer();
    await server.initialize();
    app = server.app;

    // Get auth token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@orchestrall.com',
        password: 'admin123'
      }
    });

    const loginData = JSON.parse(loginResponse.payload);
    authToken = loginData.token;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to database health check within 200ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health/database'
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond to full health check within 500ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/health/full'
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(500);
    });

    it('should respond to entity list within 200ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/entities',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('CRUD Performance Tests', () => {
    it('should create entity within 300ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 'Performance Test Org',
          slug: 'perf-test-org',
          description: 'Performance test organization'
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(300);
    });

    it('should read entities within 200ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?page=1&limit=10',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(200);
    });

    it('should update entity within 300ms', async () => {
      // First create an entity
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 'Update Test Org',
          slug: 'update-test-org',
          description: 'Update test organization'
        }
      });

      const createdData = JSON.parse(createResponse.payload);
      const orgId = createdData.data.id;

      const start = Date.now();
      
      const response = await app.inject({
        method: 'PUT',
        url: `/api/organization/${orgId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 'Updated Performance Test Org',
          description: 'Updated description'
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(300);
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk create within 1 second', async () => {
      const bulkData = {
        items: Array.from({ length: 10 }, (_, i) => ({
          name: `Bulk Org ${i + 1}`,
          slug: `bulk-org-${i + 1}`,
          description: `Bulk organization ${i + 1}`
        }))
      };

      const start = Date.now();
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkData
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle bulk update within 1 second', async () => {
      const bulkUpdateData = {
        updates: Array.from({ length: 5 }, (_, i) => ({
          id: `bulk-org-${i + 1}`,
          data: { name: `Updated Bulk Org ${i + 1}` }
        }))
      };

      const start = Date.now();
      
      const response = await app.inject({
        method: 'PUT',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkUpdateData
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 10 concurrent requests within 2 seconds', async () => {
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'GET',
          url: '/health',
        })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - start;

      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      expect(totalTime).toBeLessThan(2000);
    });

    it('should handle 5 concurrent authenticated requests within 1 second', async () => {
      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/entities',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - start;

      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not exceed memory limits during bulk operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operation
      const bulkData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          name: `Memory Test Org ${i + 1}`,
          slug: `memory-test-org-${i + 1}`,
          description: `Memory test organization ${i + 1}`.repeat(10) // Large description
        }))
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkData
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(response.statusCode).toBe(201);
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Pagination Performance', () => {
    beforeEach(async () => {
      // Create test data for pagination tests
      const bulkData = {
        items: Array.from({ length: 50 }, (_, i) => ({
          name: `Pagination Test Org ${i + 1}`,
          slug: `pagination-test-org-${i + 1}`,
          description: `Pagination test organization ${i + 1}`
        }))
      };

      await app.inject({
        method: 'POST',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkData
      });
    });

    it('should handle large page sizes efficiently', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?page=1&limit=50',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(500);
      
      const data = JSON.parse(response.payload);
      expect(data.data.length).toBeLessThanOrEqual(50);
    });

    it('should handle deep pagination efficiently', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?page=10&limit=5',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(300);
    });
  });

  describe('Search Performance', () => {
    it('should handle search queries within 300ms', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?search=Pagination',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(300);
    });

    it('should handle complex search queries efficiently', async () => {
      const start = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?search=Test&sortField=name&sortOrder=asc&page=1&limit=20',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(400);
    });
  });
});
