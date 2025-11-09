const { describe, test, expect, beforeEach, jest } = require('@jest/globals');
const request = require('supertest');

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn()
  },
  role: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  userRole: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn()
  },
  apiKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
};

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

describe('Security Tests', () => {
  let app;
  let mockToken;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock JWT token
    mockToken = 'mock-jwt-token';
    
    // Mock successful authentication
    const jwt = require('jsonwebtoken');
    jwt.verify.mockReturnValue({
      userId: 'test-user-id',
      organizationId: 'test-org-id',
      roles: ['farmer']
    });

    // Mock user lookup
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: 'test-org-id',
      status: 'active',
      organization: {
        id: 'test-org-id',
        name: 'Test Organization',
        tier: 'professional'
      }
    });

    // Create test app
    const ZeroConfigServer = require('../../src/app-zero-config');
    const server = new ZeroConfigServer();
    server.prisma = mockPrisma;
    await server.initialize();
    app = server.app;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Authentication Security', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .post('/api/agricultural/farmers')
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    test('should reject requests with invalid token format', async () => {
      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', 'InvalidFormat token')
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject requests with expired token', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token expired');
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    test('should reject requests with invalid token', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject requests with inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'test-org-id',
        status: 'inactive' // Inactive user
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject requests with non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Authorization Security', () => {
    test('should reject requests with insufficient permissions', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        roles: ['viewer'] // Insufficient role
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient permissions');
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should allow requests with sufficient permissions', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        roles: ['farmer'] // Sufficient role
      });

      mockPrisma.farmerProfile.create.mockResolvedValue({
        id: 'farmer-123',
        name: 'Test Farmer',
        farmLocation: 'Delhi',
        region: 'North India',
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Farmer',
          farmLocation: 'Delhi',
          region: 'North India'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should allow super admin access to all resources', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        roles: ['super_admin'] // Super admin role
      });

      mockPrisma.farmerProfile.create.mockResolvedValue({
        id: 'farmer-123',
        name: 'Test Farmer',
        farmLocation: 'Delhi',
        region: 'North India',
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Farmer',
          farmLocation: 'Delhi',
          region: 'North India'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('API Key Security', () => {
    test('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/agricultural/market/prices/rice')
        .set('X-API-Key', 'invalid-api-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired API key');
      expect(response.body.code).toBe('INVALID_API_KEY');
    });

    test('should reject requests with revoked API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'api-key-123',
        name: 'Test API Key',
        key: 'valid-api-key',
        permissions: ['agricultural:read'],
        organizationId: 'test-org-id',
        revoked: true, // Revoked key
        expiresAt: null
      });

      const response = await request(app)
        .get('/api/agricultural/market/prices/rice')
        .set('X-API-Key', 'valid-api-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired API key');
    });

    test('should reject requests with expired API key', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'api-key-123',
        name: 'Test API Key',
        key: 'valid-api-key',
        permissions: ['agricultural:read'],
        organizationId: 'test-org-id',
        revoked: false,
        expiresAt: expiredDate // Expired key
      });

      const response = await request(app)
        .get('/api/agricultural/market/prices/rice')
        .set('X-API-Key', 'valid-api-key')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired API key');
    });

    test('should enforce rate limits on API keys', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'api-key-123',
        name: 'Test API Key',
        key: 'valid-api-key',
        permissions: ['agricultural:read'],
        organizationId: 'test-org-id',
        revoked: false,
        expiresAt: null,
        rateLimit: 100,
        usageCount: 100, // At rate limit
        lastUsedAt: new Date()
      });

      const response = await request(app)
        .get('/api/agricultural/market/prices/rice')
        .set('X-API-Key', 'valid-api-key')
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Input Validation Security', () => {
    test('should reject SQL injection attempts', async () => {
      const maliciousData = {
        name: "'; DROP TABLE farmers; --",
        farmLocation: 'Delhi',
        region: 'North India'
      };

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject XSS attempts', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>John Doe',
        farmLocation: 'Delhi',
        region: 'North India'
      };

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject oversized payloads', async () => {
      const oversizedData = {
        name: 'A'.repeat(10000), // Very long name
        farmLocation: 'Delhi',
        region: 'North India'
      };

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(oversizedData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject invalid data types', async () => {
      const invalidData = {
        name: 123, // Should be string
        farmLocation: 'Delhi',
        region: 'North India',
        phone: 'not-a-number' // Invalid phone
      };

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Rate Limiting Security', () => {
    test('should enforce rate limits on authenticated requests', async () => {
      // Mock rate limit exceeded
      const response = await request(app)
        .get('/api/agricultural/farmers/farmer-123')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-RateLimit-Remaining', '0')
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should include rate limit headers in responses', async () => {
      mockPrisma.farmerProfile.findUnique.mockResolvedValue({
        id: 'farmer-123',
        name: 'John Doe',
        farmLocation: 'Delhi',
        region: 'North India'
      });

      const response = await request(app)
        .get('/api/agricultural/farmers/farmer-123')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Audit Logging Security', () => {
    test('should log all authenticated requests', async () => {
      mockPrisma.farmerProfile.findUnique.mockResolvedValue({
        id: 'farmer-123',
        name: 'John Doe',
        farmLocation: 'Delhi',
        region: 'North India'
      });

      await request(app)
        .get('/api/agricultural/farmers/farmer-123')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'test-org-id',
          userId: 'test-user-id',
          action: 'GET',
          resource: 'farmers',
          resourceId: 'farmer-123'
        })
      });
    });

    test('should log failed authentication attempts', async () => {
      await request(app)
        .post('/api/agricultural/farmers')
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'POST',
          resource: 'farmers',
          details: expect.objectContaining({
            statusCode: 401
          })
        })
      });
    });
  });

  describe('Organization Access Control', () => {
    test('should reject cross-organization access', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        userId: 'test-user-id',
        organizationId: 'test-org-id',
        roles: ['farmer']
      });

      // Mock user from different organization
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'different-org-id', // Different organization
        status: 'active'
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Test Farmer' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied to organization');
      expect(response.body.code).toBe('ORG_ACCESS_DENIED');
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not expose sensitive information in errors', async () => {
      mockPrisma.farmerProfile.create.mockRejectedValue(new Error('Database connection failed: password=secret123'));

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Farmer',
          farmLocation: 'Delhi',
          region: 'North India'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database connection failed: password=secret123');
      // In production, this should be sanitized
    });

    test('should not expose stack traces in production', async () => {
      process.env.NODE_ENV = 'production';
      
      mockPrisma.farmerProfile.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Farmer',
          farmLocation: 'Delhi',
          region: 'North India'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
      expect(response.body.stack).toBeUndefined();
    });
  });
});