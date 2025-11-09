// tests/integration/health-checks.test.js - Professional Health Check Tests
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

describe('Health Check Integration Tests', () => {
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
      console.log('✅ Test database connected');
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

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('2.0.0');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });

    it('should include environment information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      const data = JSON.parse(response.payload);
      expect(data.environment).toBeDefined();
      expect(data.database).toBeDefined();
      expect(data.dashboard).toBe('ready');
    });
  });

  describe('GET /health/database', () => {
    it('should return database health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/database'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('database');
      expect(data.timestamp).toBeDefined();
    });

    it('should include response time', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/database'
      });

      const data = JSON.parse(response.payload);
      expect(data.responseTime).toBeDefined();
      expect(data.responseTime).toMatch(/\d+ms/);
    });
  });

  describe('GET /health/redis', () => {
    it('should return redis health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/redis'
      });

      // Redis might not be available in test environment
      if (response.statusCode === 200) {
        const data = JSON.parse(response.payload);
        expect(data.status).toBe('healthy');
        expect(data.service).toBe('redis');
        expect(data.responseTime).toBeDefined();
      } else {
        expect(response.statusCode).toBe(503);
        const data = JSON.parse(response.payload);
        expect(data.status).toBe('unhealthy');
        expect(data.service).toBe('redis');
      }
    });
  });

  describe('GET /health/full', () => {
    it('should return comprehensive health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/full'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.redis).toBeDefined();
      expect(data.checks.memory).toBeDefined();
    });

    it('should include memory usage information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/full'
      });

      const data = JSON.parse(response.payload);
      expect(data.checks.memory.status).toBeDefined();
      expect(data.checks.memory.usage).toBeDefined();
      expect(data.checks.memory.limit).toBeDefined();
    });

    it('should include system uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/full'
      });

      const data = JSON.parse(response.payload);
      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThan(0);
    });
  });
});
