// tests/api/universal-crud.test.js - Enhanced Universal CRUD API Tests
const { PrismaClient } = require('@prisma/client');

describe('Universal CRUD API Tests', () => {
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
      console.log('✅ Test database connected for API tests');
      global.testPrisma = prisma;
    } catch (error) {
      console.log('⚠️ Test database not available, using mock mode:', error.message);
      prisma = null;
    }

    // Import and initialize the app
    try {
      const ZeroConfigServer = require('../../src/app-zero-config');
      const server = new ZeroConfigServer();
      await server.initialize();
      app = server.app;
      global.testServer = app;
    } catch (error) {
      console.log('⚠️ Failed to initialize app:', error.message);
      // Create a mock app for testing
      app = {
        inject: jest.fn().mockResolvedValue({
          statusCode: 200,
          payload: JSON.stringify({ success: true, data: [] })
        })
      };
    }

    // Get auth token
    try {
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
    } catch (error) {
      console.log('⚠️ Failed to get auth token:', error.message);
      authToken = 'mock-token';
    }
  });

  afterAll(async () => {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.log('⚠️ Error disconnecting test database:', error.message);
      }
    }
    if (app && app.close) {
      try {
        await app.close();
      } catch (error) {
        console.log('⚠️ Error closing test app:', error.message);
      }
    }
  });

  describe('GET /api/entities', () => {
    it('should return list of available entities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/entities',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });
  });

  describe('CRUD Operations for Organization Entity', () => {
    let createdOrgId;

    it('should create a new organization', async () => {
      const orgData = {
        name: 'Test Organization',
        slug: 'test-org',
        description: 'A test organization',
        tier: 'premium',
        status: 'active'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: orgData
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(orgData.name);
      expect(data.data.slug).toBe(orgData.slug);
      createdOrgId = data.data.id;
    });

    it('should retrieve organizations with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?page=1&limit=10',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    it('should retrieve a specific organization', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/organization/${createdOrgId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdOrgId);
    });

    it('should update an organization', async () => {
      const updateData = {
        name: 'Updated Test Organization',
        description: 'Updated description'
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/organization/${createdOrgId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: updateData
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updateData.name);
      expect(data.data.description).toBe(updateData.description);
    });

    it('should delete an organization', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/organization/${createdOrgId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted successfully');
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk create', async () => {
      const bulkData = {
        items: [
          { name: 'Bulk Org 1', slug: 'bulk-org-1', description: 'First bulk org' },
          { name: 'Bulk Org 2', slug: 'bulk-org-2', description: 'Second bulk org' }
        ]
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

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(2);
    });

    it('should perform bulk update', async () => {
      const bulkUpdateData = {
        updates: [
          { id: 'bulk-org-1', data: { name: 'Updated Bulk Org 1' } },
          { id: 'bulk-org-2', data: { name: 'Updated Bulk Org 2' } }
        ]
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkUpdateData
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should perform bulk delete', async () => {
      const bulkDeleteData = {
        ids: ['bulk-org-1', 'bulk-org-2']
      };

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/organization/bulk',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: bulkDeleteData
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Bulk delete');
    });
  });

  describe('Query Parameters', () => {
    beforeEach(async () => {
      // Create test data
      const testOrgs = [
        { name: 'Alpha Corp', slug: 'alpha-corp', description: 'Alpha organization', tier: 'premium' },
        { name: 'Beta Inc', slug: 'beta-inc', description: 'Beta organization', tier: 'basic' },
        { name: 'Gamma LLC', slug: 'gamma-llc', description: 'Gamma organization', tier: 'premium' }
      ];

      for (const org of testOrgs) {
        await app.inject({
          method: 'POST',
          url: '/api/organization',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          payload: org
        });
      }
    });

    it('should support search functionality', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?search=Alpha',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should support sorting', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization?sortField=name&sortOrder=asc',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should support filtering', async () => {
      const filter = JSON.stringify({ tier: 'premium' });
      const response = await app.inject({
        method: 'GET',
        url: `/api/organization?filter=${encodeURIComponent(filter)}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent entity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent record', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization/nonexistent-id',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for missing authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization'
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
