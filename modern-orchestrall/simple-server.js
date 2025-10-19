// simple-server.js - Simple server with Universal CRUD APIs (no database)
require('dotenv').config();
const fastify = require('fastify');

console.log('Starting simple server with Universal CRUD APIs...');

const app = fastify({ 
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }
});

// Mock Prisma client for testing
const mockPrisma = {
  organization: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  user: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  product: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  order: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  customer: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  story: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  crop: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  store: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  voiceCall: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  },
  team: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: (data) => Promise.resolve({ id: 'mock-id', ...data.data }),
    update: (data) => Promise.resolve({ id: data.where.id, ...data.data }),
    delete: () => Promise.resolve({ success: true }),
    count: () => Promise.resolve(0)
  }
};

// Mock authentication middleware
app.addHook('preHandler', async (request, reply) => {
  // Mock user for testing
  request.user = {
    id: 'test-user',
    organizationId: 'test-org'
  };
});

// Health endpoint
app.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Universal CRUD API Server Running'
  };
});

// Register Universal CRUD routes
const universalCRUDRoutes = require('./src/routes/universal-crud');
app.register(universalCRUDRoutes, { prisma: mockPrisma });

// Start server
app.listen({ port: 3001, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log('Universal CRUD API Server listening on', address);
  console.log('Available endpoints:');
  console.log('- GET /health');
  console.log('- GET /api/entities');
  console.log('- GET /api/entities/:entityName/schema');
  console.log('- GET /api/:entityName');
  console.log('- GET /api/:entityName/:id');
  console.log('- POST /api/:entityName');
  console.log('- PUT /api/:entityName/:id');
  console.log('- DELETE /api/:entityName/:id');
  console.log('- POST /api/:entityName/bulk');
  console.log('- PUT /api/:entityName/bulk');
  console.log('- DELETE /api/:entityName/bulk');
  console.log('- GET /api/:entityName/stats');
});
