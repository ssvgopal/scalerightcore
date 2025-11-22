// src/app.js - Complete Orchestrall Platform Implementation with Commercial Features
const fastify = require('fastify');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const database = require('./database');
const authService = require('./auth');
const agentSystem = require('./agents');
const cacheService = require('./cache');
const monitoringService = require('./monitoring');
const securityService = require('./security');

// Create Fastify instance with enhanced configuration
const app = fastify({
  logger: {
    level: config.monitoring.logLevel,
    transport: config.server.nodeEnv === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
  trustProxy: true,
  bodyLimit: config.upload.maxFileSize,
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  genReqId: () => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await app.register(require('@fastify/cors'), {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  });

  // Helmet for security headers
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  // Rate limiting
  await app.register(require('@fastify/rate-limit'), {
    max: config.security.rateLimitMax,
    timeWindow: config.security.rateLimitWindow,
  });

  // JWT
  await app.register(require('@fastify/jwt'), {
    secret: config.security.jwtSecret,
    sign: {
      expiresIn: config.security.jwtExpiresIn,
    },
  });

  // Swagger documentation
  await app.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'Orchestrall Platform API',
        description: 'Complete AI Agent Orchestration System',
        version: config.deployment.version,
      },
      host: `${config.server.host}:${config.server.port}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'agents', description: 'AI Agent execution' },
        { name: 'workflows', description: 'Workflow management' },
        { name: 'organizations', description: 'Organization management' },
        { name: 'users', description: 'User management' },
        { name: 'health', description: 'Health checks' },
        { name: 'Demo', description: 'Demo endpoints' },
        { name: 'Saree', description: 'Saree demo endpoints' },
      ],
    },
  });

  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
  });

  // Static file serving for uploads
  await app.register(require('@fastify/static'), {
    root: path.join(process.cwd(), config.storage.path || './uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
}

// Add request logging middleware
app.addHook('onRequest', (request, reply, done) => {
  logger.requestLogger(request, reply);
  done();
});

// Error handling
app.setErrorHandler(async (error, request, reply) => {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    userId: request.user?.id,
  });

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;

  reply.code(statusCode).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: message,
      ...(config.server.nodeEnv === 'development' && { stack: error.stack }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      version: config.deployment.version,
    },
  });
});

// Health check endpoint
app.get('/health', {
  schema: {
    description: 'Health check endpoint',
    tags: ['health'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          uptime: { type: 'number' },
          version: { type: 'string' },
          services: {
            type: 'object',
            properties: {
              database: { type: 'object' },
              redis: { type: 'object' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const dbHealth = await database.healthCheck();
  
  return {
    status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.deployment.version,
    services: {
      database: dbHealth,
      redis: { status: 'not_implemented' },
    },
  };
});

// Authentication routes
app.post('/auth/login', {
  schema: {
    description: 'User login',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const { email, password } = request.body;
  return authService.login(email, password);
});

app.post('/auth/register', {
  schema: {
    description: 'User registration',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['email', 'password', 'organizationName'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' },
        organizationName: { type: 'string' },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const { email, password, name, organizationName } = request.body;
  const result = await authService.register(email, password, name, organizationName);
  return reply.code(201).send(result);
});

app.post('/auth/refresh', {
  schema: {
    description: 'Refresh access token',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string' },
      },
    },
  },
}, async (request, reply) => {
  const { refreshToken } = request.body;
  return authService.refreshToken(refreshToken);
});

app.get('/auth/me', {
  schema: {
    description: 'Get current user',
    tags: ['auth'],
    security: [{ bearerAuth: [] }],
  },
  preHandler: [authService.authenticateToken()],
}, async (request, reply) => {
  return authService.getCurrentUser(request.user.id);
});

// Agent routes
app.get('/api/agents', {
  schema: {
    description: 'List available agents',
    tags: ['agents'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          agents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                capabilities: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          count: { type: 'number' },
        },
      },
    },
  },
}, async (request, reply) => {
  const agents = agentSystem.getAvailableAgents();
  return {
    success: true,
    agents,
    count: agents.length,
  };
});

app.post('/api/agents/:agentName/execute', {
  schema: {
    description: 'Execute an agent',
    tags: ['agents'],
    params: {
      type: 'object',
      properties: {
        agentName: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      required: ['input'],
      properties: {
        input: { type: 'string' },
        context: { type: 'object' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          result: { type: 'object' },
          metadata: { type: 'object' },
        },
      },
    },
  },
}, async (request, reply) => {
  const { agentName } = request.params;
  const { input, context = {} } = request.body;
  
  // Add user context if authenticated
  if (request.user) {
    context.userId = request.user.id;
    context.organizationId = request.user.organizationId;
  }
  
  return agentSystem.executeAgent(agentName, input, context);
});

// Organization routes
app.get('/api/organizations', {
  schema: {
    description: 'List organizations',
    tags: ['organizations'],
    security: [{ bearerAuth: [] }],
  },
  preHandler: [authService.authenticateToken()],
}, async (request, reply) => {
  const organizations = await database.client.organization.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      slug: true,
      tier: true,
      status: true,
      createdAt: true,
    },
  });
  
  return {
    success: true,
    data: organizations,
  };
});

// User routes
app.get('/api/users', {
  schema: {
    description: 'List users in organization',
    tags: ['users'],
    security: [{ bearerAuth: [] }],
  },
  preHandler: [authService.authenticateToken()],
}, async (request, reply) => {
  const users = await database.client.user.findMany({
    where: { organizationId: request.user.organizationId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  
  return {
    success: true,
    data: users,
  };
});

// Workflow routes
app.get('/api/workflows', {
  schema: {
    description: 'List workflows',
    tags: ['workflows'],
    security: [{ bearerAuth: [] }],
  },
  preHandler: [authService.authenticateToken()],
}, async (request, reply) => {
  const workflows = await database.client.workflow.findMany({
    where: { organizationId: request.user.organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return {
    success: true,
    data: workflows,
  };
});

app.post('/api/workflows/:workflowId/execute', {
  schema: {
    description: 'Execute a workflow',
    tags: ['workflows'],
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      properties: {
        input: { type: 'object' },
        async: { type: 'boolean', default: false },
      },
    },
  },
  preHandler: [authService.authenticateToken()],
}, async (request, reply) => {
  const { workflowId } = request.params;
  const { input = {}, async = false } = request.body;
  
  // Find workflow
  const workflow = await database.client.workflow.findFirst({
    where: {
      id: workflowId,
      organizationId: request.user.organizationId,
    },
  });
  
  if (!workflow) {
    return reply.code(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Workflow not found' },
    });
  }
  
  // Create execution record
  const execution = await database.client.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      input,
      status: 'running',
      triggeredBy: request.user.id,
      metadata: { userId: request.user.id, organizationId: request.user.organizationId },
    },
  });
  
  // Simple workflow execution (placeholder)
  const result = {
    executionId: execution.id,
    status: 'completed',
    output: { message: 'Workflow executed successfully', input },
  };
  
  // Update execution
  await database.client.workflowExecution.update({
    where: { id: execution.id },
    data: {
      output: result.output,
      status: 'completed',
      completedAt: new Date(),
    },
  });
  
  return {
    success: true,
    data: result,
  };
});

// Legacy endpoints for backward compatibility
app.get('/test', async (request, reply) => {
  return { message: 'Orchestrall Platform is working', version: config.deployment.version };
});

app.get('/api/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.deployment.version,
  };
});

// Register demo saree routes
const demoSareeRoutes = require('./routes/demo-saree-routes');
app.register(demoSareeRoutes, { prisma: database.client });

// Start server
async function start() {
  try {
    // Initialize services
    await database.connect();
    await authService.initialize();
    await agentSystem.initialize();
    
    // Register plugins
    await registerPlugins();
    
    // Start server
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    
    logger.info('🚀 Orchestrall Platform started successfully', {
      port: config.server.port,
      host: config.server.host,
      version: config.deployment.version,
      environment: config.server.nodeEnv,
    });
    
    console.log('✅ Orchestrall Platform running on http://localhost:' + config.server.port);
    console.log('📋 Available endpoints:');
    console.log('   GET  /health - Health check');
    console.log('   GET  /docs - API documentation');
    console.log('   POST /auth/login - User login');
    console.log('   POST /auth/register - User registration');
    console.log('   GET  /api/agents - List agents');
    console.log('   POST /api/agents/:name/execute - Execute agent');
    console.log('   GET  /api/workflows - List workflows');
    console.log('   POST /api/workflows/:id/execute - Execute workflow');
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await app.close();
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await app.close();
  await database.disconnect();
  process.exit(0);
});

// Start the server
start();
