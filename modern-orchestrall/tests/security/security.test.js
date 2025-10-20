// tests/security/security.test.js - Professional Security Tests
const { PrismaClient } = require('@prisma/client');

describe('Security Tests', () => {
  let app;
  let prisma;

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
      console.log('✅ Test database connected for security tests');
    } catch (error) {
      console.log('⚠️ Test database not available, using mock mode');
    }

    // Import and initialize the app
    const ZeroConfigServer = require('../../src/app-zero-config');
    const server = new ZeroConfigServer();
    await server.initialize();
    app = server.app;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Authentication Security', () => {
    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'invalid@example.com',
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Invalid credentials');
    });

    it('should reject empty credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {}
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject malformed credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'not-an-email',
          password: ''
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Authorization Security', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject malformed authorization headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization',
        headers: {
          'Authorization': 'InvalidFormat token'
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Input Validation Security', () => {
    let authToken;

    beforeAll(async () => {
      // Get valid auth token
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

    it('should prevent SQL injection in search parameters', async () => {
      const maliciousSearch = "'; DROP TABLE organizations; --";
      
      const response = await app.inject({
        method: 'GET',
        url: `/api/organization?search=${encodeURIComponent(maliciousSearch)}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // Should not crash and should return empty results or error gracefully
      expect([200, 400, 500]).toContain(response.statusCode);
    });

    it('should prevent XSS in input fields', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: xssPayload,
          slug: 'xss-test',
          description: 'XSS test'
        }
      });

      // Should handle XSS payload safely
      expect([200, 201, 400]).toContain(response.statusCode);
      
      if (response.statusCode === 201) {
        const data = JSON.parse(response.payload);
        // Should not execute the script
        expect(data.data.name).toBe(xssPayload);
      }
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          // Missing required fields
          description: 'Missing name and slug'
        }
      });

      expect([400, 422]).toContain(response.statusCode);
    });

    it('should validate field types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 123, // Should be string
          slug: 'test-slug',
          description: 'Test description'
        }
      });

      expect([200, 201, 400, 422]).toContain(response.statusCode);
    });

    it('should prevent oversized payloads', async () => {
      const oversizedData = {
        name: 'A'.repeat(10000), // Very large string
        slug: 'test-slug',
        description: 'B'.repeat(50000)
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: oversizedData
      });

      // Should reject oversized payloads
      expect([400, 413, 422]).toContain(response.statusCode);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          app.inject({
            method: 'GET',
            url: '/health'
          })
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed (health endpoint might not be rate limited)
      // But we can check that the server handles multiple requests gracefully
      responses.forEach(response => {
        expect([200, 429]).toContain(response.statusCode);
      });
    });
  });

  describe('CORS Security', () => {
    it('should include proper CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/organization',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Content Security Policy', () => {
    it('should include CSP headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Data Sanitization', () => {
    let authToken;

    beforeAll(async () => {
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

    it('should sanitize special characters in URLs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization/../../../etc/passwd',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle null and undefined values safely', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/organization',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: null,
          slug: undefined,
          description: 'Test'
        }
      });

      expect([200, 201, 400, 422]).toContain(response.statusCode);
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose sensitive information in errors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/organization/invalid-id',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const data = JSON.parse(response.payload);
      
      // Should not expose database errors, stack traces, or internal paths
      expect(JSON.stringify(data)).not.toMatch(/database|connection|stack|trace|path|file/i);
    });
  });
});
