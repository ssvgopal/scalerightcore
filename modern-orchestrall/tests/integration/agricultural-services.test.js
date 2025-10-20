const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma for testing
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    farmer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    crop: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    weatherData: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    marketPrice: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    loanApplication: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    insuranceClaim: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    creditScore: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    yieldPrediction: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    cropHealthRecord: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    farmerDocument: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    landRecord: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    sellingRecommendation: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    weatherAlert: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    marketAlert: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    farmerVerification: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    insurancePolicy: {
      create: jest.fn(),
      findMany: jest.fn()
    },
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
  }))
}));

// Mock external APIs
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

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

describe('Agricultural Services Integration Tests', () => {
  let app;
  let prisma;
  let mockToken;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock Prisma instance
    prisma = new PrismaClient();
    
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
    prisma.user.findUnique.mockResolvedValue({
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
    const ZeroConfigServer = require('../src/app-zero-config');
    const server = new ZeroConfigServer();
    server.prisma = prisma;
    await server.initialize();
    app = server.app;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Farmer Management Service', () => {
    test('POST /api/agricultural/farmers - should register farmer with valid data', async () => {
      const farmerData = {
        name: 'John Doe',
        farmLocation: 'Delhi',
        region: 'North India',
        phone: '9876543210',
        email: 'john@example.com',
        aadhaarNumber: '123456789012',
        panNumber: 'ABCDE1234F',
        bankAccountNumber: '1234567890',
        ifscCode: 'SBIN0001234'
      };

      prisma.farmerProfile.create.mockResolvedValue({
        id: 'farmer-123',
        ...farmerData,
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(farmerData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('John Doe');
      expect(prisma.farmerProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining(farmerData)
      });
    });

    test('POST /api/agricultural/farmers - should reject invalid data', async () => {
      const invalidData = {
        name: 'A', // Too short
        farmLocation: '', // Empty
        email: 'invalid-email', // Invalid email
        aadhaarNumber: '123', // Invalid Aadhaar
        panNumber: 'INVALID', // Invalid PAN
        ifscCode: 'INVALID' // Invalid IFSC
      };

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    test('GET /api/agricultural/farmers/:id - should return farmer profile', async () => {
      const farmerId = 'farmer-123';
      const mockFarmer = {
        id: farmerId,
        name: 'John Doe',
        farmLocation: 'Delhi',
        region: 'North India',
        phone: '9876543210',
        email: 'john@example.com'
      };

      prisma.farmerProfile.findUnique.mockResolvedValue(mockFarmer);

      const response = await request(app)
        .get(`/api/agricultural/farmers/${farmerId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(farmerId);
      expect(response.body.data.name).toBe('John Doe');
    });
  });

  describe('Crop Monitoring Service', () => {
    test('POST /api/agricultural/crops - should add crop with valid data', async () => {
      const cropData = {
        name: 'Rice',
        variety: 'Basmati',
        plantingDate: '2024-01-01T00:00:00Z',
        harvestDate: '2024-06-01T00:00:00Z',
        status: 'planted'
      };

      prisma.crop.create.mockResolvedValue({
        id: 'crop-123',
        farmerId: 'farmer-123',
        ...cropData,
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/crops')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(cropData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Rice');
    });

    test('GET /api/agricultural/crops/:id/health - should analyze crop health', async () => {
      const cropId = 'crop-123';
      const mockHealthData = {
        healthScore: 85,
        diseaseDetected: [],
        pestDetected: [],
        nutrientDeficiency: [],
        recommendations: {
          watering: 'Increase watering frequency',
          fertilization: 'Apply nitrogen fertilizer'
        }
      };

      prisma.crop.findUnique.mockResolvedValue({
        id: cropId,
        name: 'Rice',
        farmerId: 'farmer-123'
      });

      prisma.cropHealthRecord.findMany.mockResolvedValue([mockHealthData]);

      const response = await request(app)
        .get(`/api/agricultural/crops/${cropId}/health`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.healthScore).toBe(85);
    });
  });

  describe('Market Intelligence Service', () => {
    test('GET /api/agricultural/market/prices/:cropType - should return crop prices', async () => {
      const cropType = 'rice';
      const mockPrices = [
        {
          cropType: 'rice',
          variety: 'Basmati',
          price: 2800,
          unit: 'quintal',
          market: 'Delhi',
          location: 'Delhi',
          updatedAt: new Date()
        }
      ];

      prisma.marketPrice.findMany.mockResolvedValue(mockPrices);

      const response = await request(app)
        .get(`/api/agricultural/market/prices/${cropType}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .query({ location: 'Delhi' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Weather Integration Service', () => {
    test('GET /api/agricultural/weather/current/:location - should return current weather', async () => {
      const location = 'Delhi';
      const mockWeather = {
        temperature: 28.5,
        humidity: 65,
        pressure: 1013,
        windSpeed: 5.2,
        windDirection: 180,
        visibility: 10,
        condition: 'clear',
        description: 'Clear sky',
        timestamp: new Date()
      };

      prisma.weatherData.create.mockResolvedValue({
        id: 'weather-123',
        location,
        ...mockWeather,
        createdAt: new Date()
      });

      const response = await request(app)
        .get(`/api/agricultural/weather/current/${location}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.temperature).toBe(28.5);
    });
  });

  describe('Agricultural Financial Service', () => {
    test('POST /api/agricultural/loans - should apply for loan with valid data', async () => {
      const loanData = {
        amount: 50000,
        purpose: 'crop_cultivation',
        tenure: 12,
        interestRate: 12.5
      };

      prisma.loanApplication.create.mockResolvedValue({
        id: 'loan-123',
        farmerId: 'test-user-id',
        ...loanData,
        status: 'pending',
        appliedAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/loans')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(loanData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(50000);
    });

    test('POST /api/agricultural/loans - should reject invalid loan data', async () => {
      const invalidLoanData = {
        amount: -1000, // Negative amount
        purpose: 'invalid_purpose', // Invalid purpose
        tenure: 0, // Invalid tenure
        interestRate: 150 // Invalid interest rate
      };

      const response = await request(app)
        .post('/api/agricultural/loans')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidLoanData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Authentication and Authorization', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .post('/api/agricultural/farmers')
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject requests with invalid token', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test Farmer' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });

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
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      prisma.farmerProfile.create.mockRejectedValue(new Error('Database connection failed'));

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
      expect(response.body.error).toBe('Database connection failed');
    });

    test('should handle external API errors gracefully', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('External API timeout'));

      const response = await request(app)
        .get('/api/agricultural/weather/current/Delhi')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Mock rate limit exceeded
      const response = await request(app)
        .get('/api/agricultural/market/prices/rice')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-RateLimit-Remaining', '0')
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize malicious input', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>John Doe',
        farmLocation: 'Delhi',
        region: 'North India'
      };

      prisma.farmerProfile.create.mockResolvedValue({
        id: 'farmer-123',
        name: 'John Doe', // Should be sanitized
        farmLocation: 'Delhi',
        region: 'North India',
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/agricultural/farmers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(maliciousData)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Verify that malicious content was sanitized
      expect(response.body.data.name).not.toContain('<script>');
    });
  });
});

describe('Performance Tests', () => {
  let app;
  let prisma;

  beforeEach(async () => {
    prisma = new PrismaClient();
    const ZeroConfigServer = require('../src/app-zero-config');
    const server = new ZeroConfigServer();
    server.prisma = prisma;
    await server.initialize();
    app = server.app;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test('should handle concurrent requests efficiently', async () => {
    const mockToken = 'mock-jwt-token';
    const jwt = require('jsonwebtoken');
    jwt.verify.mockReturnValue({
      userId: 'test-user-id',
      organizationId: 'test-org-id',
      roles: ['farmer']
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: 'test-org-id',
      status: 'active'
    });

    prisma.farmerProfile.findUnique.mockResolvedValue({
      id: 'farmer-123',
      name: 'John Doe',
      farmLocation: 'Delhi',
      region: 'North India'
    });

    const startTime = Date.now();
    const promises = Array(10).fill().map(() =>
      request(app)
        .get('/api/agricultural/farmers/farmer-123')
        .set('Authorization', `Bearer ${mockToken}`)
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // Should complete within reasonable time (5 seconds)
    expect(duration).toBeLessThan(5000);
  });
});
