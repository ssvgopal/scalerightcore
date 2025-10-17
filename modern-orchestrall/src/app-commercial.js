// src/app.js - Complete Orchestrall Platform Implementation with Commercial Features
require('dotenv').config();
const fastify = require('fastify');
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

// Register plugins with enhanced security and monitoring
async function registerPlugins() {
  // CORS with enhanced security
  await app.register(require('@fastify/cors'), {
    origin: config.cors.origins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  });

  // Helmet for comprehensive security headers
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Enhanced rate limiting with Redis backend
  await app.register(require('@fastify/rate-limit'), {
    max: config.security.rateLimitMax,
    timeWindow: config.security.rateLimitWindow,
    redis: cacheService.redis,
    keyGenerator: (request) => {
      return `${request.ip}:${request.routeOptions.url}`;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate limit exceeded',
        statusCode: 429,
        message: `Too many requests from ${request.ip}`,
        retryAfter: Math.round(context.ttl / 1000),
      };
    },
  });

  // JWT authentication with enhanced security
  await app.register(require('@fastify/jwt'), {
    secret: config.security.jwtSecret,
    sign: {
      expiresIn: config.security.jwtExpiresIn,
      issuer: 'orchestrall-platform',
      audience: 'orchestrall-users',
    },
    verify: {
      issuer: 'orchestrall-platform',
      audience: 'orchestrall-users',
    },
  });

  // Swagger documentation with enhanced security
  await app.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'Orchestrall Platform API',
        description: 'Enterprise AI Agent Orchestration System',
        version: '2.0.0',
        contact: {
          name: 'Orchestrall Team',
          email: 'support@orchestrall.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      host: config.server.host + ':' + config.server.port,
      schemes: config.server.nodeEnv === 'production' ? ['https'] : ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT token for authentication',
        },
        apiKeyAuth: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API key for service authentication',
        },
      },
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Agents', description: 'AI agent management and execution' },
        { name: 'Organizations', description: 'Organization management' },
        { name: 'Users', description: 'User management' },
        { name: 'Workflows', description: 'Workflow management' },
        { name: 'Monitoring', description: 'System monitoring and metrics' },
        { name: 'Security', description: 'Security and compliance endpoints' },
      ],
    },
  });

  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Compression
  await app.register(require('@fastify/compress'), {
    global: true,
    threshold: 1024,
    encodings: ['gzip', 'deflate'],
  });
}

// Enhanced request logging with monitoring
app.addHook('onRequest', async (request, reply) => {
  const startTime = Date.now();
  request.startTime = startTime;
  
  // Security checks
  if (securityService.isIPBlocked(request.ip)) {
    reply.code(403).send({ error: 'IP blocked due to suspicious activity' });
    return;
  }

  // Add security headers
  Object.entries(securityService.getSecurityHeaders()).forEach(([key, value]) => {
    reply.header(key, value);
  });

  logger.info('Incoming request', {
    reqId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });
});

// Enhanced response logging with monitoring
app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  
  // Record metrics
  monitoringService.recordHttpRequest(
    request.method,
    request.routeOptions?.url || request.url,
    reply.statusCode,
    duration / 1000
  );

  logger.info('Request completed', {
    reqId: request.id,
    statusCode: reply.statusCode,
    responseTime: duration,
  });
});

// Enhanced error handling with security logging
app.setErrorHandler(async (error, request, reply) => {
  const duration = Date.now() - request.startTime;
  
  // Log security events for certain errors
  if (error.statusCode === 401 || error.statusCode === 403) {
    securityService.logSecurityEvent('unauthorized_access', {
      ip: request.ip,
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
    });
  }

  // Record error metrics
  monitoringService.recordError(error.name || 'UnknownError', 'medium');

  logger.error('Request error', {
    reqId: request.id,
    error: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    duration,
  });

  // Don't expose internal errors in production
  const isDevelopment = config.server.nodeEnv === 'development';
  const errorResponse = {
    error: error.message || 'Internal Server Error',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    requestId: request.id,
  };

  if (isDevelopment) {
    errorResponse.stack = error.stack;
  }

  reply.code(error.statusCode || 500).send(errorResponse);
});

// Enhanced authentication middleware
async function authenticateRequest(request, reply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      reply.code(401).send({ error: 'Authentication required' });
      return false;
    }

    const decoded = securityService.verifyToken(token);
    
    // Check if user is blocked
    if (securityService.isBlocked(decoded.email, request.ip)) {
      reply.code(403).send({ error: 'Account temporarily locked' });
      return false;
    }

    // Add user context
    request.user = decoded;
    request.userId = decoded.id;
    request.organizationId = decoded.organizationId;

    return true;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid token' });
    return false;
  }
}

// API Key authentication middleware
async function authenticateAPIKey(request, reply) {
  try {
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      reply.code(401).send({ error: 'API key required' });
      return false;
    }

    const keyData = await securityService.validateAPIKey(apiKey);
    
    if (!keyData) {
      reply.code(401).send({ error: 'Invalid API key' });
      return false;
    }

    request.apiKey = keyData;
    request.userId = keyData.userId;
    request.organizationId = keyData.organizationId;

    return true;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid API key' });
    return false;
  }
}

// Health check endpoint with comprehensive monitoring
app.get('/health', {
  schema: {
    description: 'Comprehensive health check',
    tags: ['Monitoring'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          version: { type: 'string' },
          uptime: { type: 'number' },
          services: {
            type: 'object',
            properties: {
              database: { type: 'object' },
              cache: { type: 'object' },
              monitoring: { type: 'object' },
            },
          },
          metrics: { type: 'object' },
        },
      },
    },
  },
}, async (request, reply) => {
  const startTime = Date.now();
  
  try {
    // Check all services
    const [dbHealth, cacheHealth, systemMetrics] = await Promise.all([
      database.healthCheck(),
      cacheService.healthCheck(),
      monitoringService.getHealthMetrics(),
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.deployment.version,
      uptime: process.uptime(),
      services: {
        database: dbHealth,
        cache: cacheHealth,
        monitoring: { status: 'healthy' },
      },
      metrics: systemMetrics,
    };

    // Determine overall health
    if (dbHealth.status !== 'healthy' || cacheHealth.status !== 'healthy') {
      health.status = 'degraded';
    }

    const duration = Date.now() - startTime;
    monitoringService.recordHttpRequest('GET', '/health', 200, duration / 1000);

    return health;
  } catch (error) {
    logger.error('Health check failed', error);
    monitoringService.recordHttpRequest('GET', '/health', 500, (Date.now() - startTime) / 1000);
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', {
  schema: {
    description: 'Prometheus metrics endpoint',
    tags: ['Monitoring'],
  },
}, async (request, reply) => {
  try {
    const metrics = await monitoringService.getMetrics();
    reply.type('text/plain').send(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error', error);
    reply.code(500).send('Internal Server Error');
  }
});

// Authentication routes with enhanced security
app.post('/auth/login', {
  schema: {
    description: 'User login with enhanced security',
    tags: ['Authentication'],
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
          user: { type: 'object' },
          tokens: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
  },
}, async (request, reply) => {
  const startTime = Date.now();
  
  try {
    const { email, password } = request.body;

    // Security checks
    if (securityService.isBlocked(email, request.ip)) {
      securityService.recordFailedAttempt(email, request.ip);
      reply.code(403).send({ error: 'Account temporarily locked' });
      return;
    }

    // Input validation
    if (!securityService.validateEmail(email)) {
      reply.code(400).send({ error: 'Invalid email format' });
      return;
    }

    // Attempt login
    const result = await authService.login(email, password);
    
    if (result.success) {
      // Record successful login
      monitoringService.recordAuthAttempt('password', 'success');
      
      const duration = Date.now() - startTime;
      monitoringService.recordHttpRequest('POST', '/auth/login', 200, duration / 1000);
      
      return result;
    } else {
      // Record failed attempt
      securityService.recordFailedAttempt(email, request.ip);
      monitoringService.recordAuthAttempt('password', 'failed');
      
      const duration = Date.now() - startTime;
      monitoringService.recordHttpRequest('POST', '/auth/login', 401, duration / 1000);
      
      reply.code(401).send({ error: 'Invalid credentials' });
    }
  } catch (error) {
    logger.error('Login error', error);
    monitoringService.recordHttpRequest('POST', '/auth/login', 500, (Date.now() - startTime) / 1000);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Enhanced agent execution with caching and monitoring
app.post('/api/agents/:name/execute', {
  preHandler: async (request, reply) => {
    // Support both JWT and API key authentication
    const hasJWT = request.headers.authorization;
    const hasAPIKey = request.headers['x-api-key'];
    
    if (!hasJWT && !hasAPIKey) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }
    
    if (hasJWT) {
      return await authenticateRequest(request, reply);
    } else {
      return await authenticateAPIKey(request, reply);
    }
  },
  schema: {
    description: 'Execute AI agent with enhanced monitoring',
    tags: ['Agents'],
    params: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      required: ['input'],
      properties: {
        input: { type: 'string' },
        options: { type: 'object' },
      },
    },
  },
}, async (request, reply) => {
  const startTime = Date.now();
  const { name } = request.params;
  const { input, options = {} } = request.body;

  try {
    // Check cache first
    const cacheKey = `agent:${name}:${securityService.hashInput(input)}`;
    const cachedResult = await cacheService.get(cacheKey);
    
    if (cachedResult) {
      logger.info('Cache hit for agent execution', { agent: name, cacheKey });
      monitoringService.recordCacheHit('agent_execution');
      
      const duration = Date.now() - startTime;
      monitoringService.recordHttpRequest('POST', `/api/agents/${name}/execute`, 200, duration / 1000);
      
      return {
        success: true,
        result: cachedResult,
        cached: true,
        executionTime: duration,
      };
    }

    // Execute agent
    logger.info('Executing agent', { agent: name, userId: request.userId });
    const result = await agentSystem.executeAgent(name, input, options);

    // Cache result
    await cacheService.set(cacheKey, result, 1800); // 30 minutes
    monitoringService.recordCacheMiss('agent_execution');

    // Record metrics
    const duration = Date.now() - startTime;
    monitoringService.recordAgentExecution(name, 'success', duration / 1000);
    monitoringService.recordHttpRequest('POST', `/api/agents/${name}/execute`, 200, duration / 1000);

    return {
      success: true,
      result,
      cached: false,
      executionTime: duration,
    };
  } catch (error) {
    logger.error('Agent execution error', { agent: name, error: error.message });
    
    const duration = Date.now() - startTime;
    monitoringService.recordAgentExecution(name, 'error', duration / 1000);
    monitoringService.recordHttpRequest('POST', `/api/agents/${name}/execute`, 500, duration / 1000);
    
    reply.code(500).send({ error: 'Agent execution failed' });
  }
});

// Security endpoints
app.get('/security/compliance', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get security compliance report',
    tags: ['Security'],
  },
}, async (request, reply) => {
  try {
    const report = securityService.generateComplianceReport();
    return report;
  } catch (error) {
    logger.error('Compliance report error', error);
    reply.code(500).send({ error: 'Failed to generate compliance report' });
  }
});

// API Key management endpoints
app.post('/api/keys', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Create new API key',
    tags: ['Security'],
    body: {
      type: 'object',
      properties: {
        permissions: { type: 'array', items: { type: 'string' } },
        expiresIn: { type: 'number' },
      },
    },
  },
}, async (request, reply) => {
  try {
    const { permissions = ['read'], expiresIn } = request.body;
    const apiKey = await securityService.createAPIKey(
      request.userId,
      request.organizationId,
      permissions,
      expiresIn
    );
    
    return apiKey;
  } catch (error) {
    logger.error('API key creation error', error);
    reply.code(500).send({ error: 'Failed to create API key' });
  }
});

// Workflow Intelligence Agent endpoints
app.post('/api/workflow-intelligence/analyze', {
  preHandler: async (request, reply) => {
    const hasJWT = request.headers.authorization;
    const hasAPIKey = request.headers['x-api-key'];
    
    if (!hasJWT && !hasAPIKey) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }
    
    if (hasJWT) {
      return await authenticateRequest(request, reply);
    } else {
      return await authenticateAPIKey(request, reply);
    }
  },
  schema: {
    description: 'Analyze workflows, integrations, and conflicts',
    tags: ['Workflow Intelligence'],
    body: {
      type: 'object',
      required: ['businessDescription'],
      properties: {
        businessDescription: { type: 'string' },
        analysisType: { 
          type: 'string',
          enum: ['customer-onboarding', 'integration-compatibility', 'workflow-conflicts', 'architecture-assessment', 'integration-recommendations']
        },
        context: { type: 'object' }
      }
    }
  }
}, async (request, reply) => {
  const startTime = Date.now();
  const { businessDescription, analysisType, context = {} } = request.body;

  try {
    const agentSystem = require('./agents');
    const result = await agentSystem.executeAgent('workflow-intelligence', businessDescription, {
      ...context,
      analysisType,
      userId: request.userId,
      organizationId: request.organizationId
    });

    const duration = Date.now() - startTime;
    monitoringService.recordHttpRequest('POST', '/api/workflow-intelligence/analyze', 200, duration / 1000);

    return {
      success: true,
      result,
      executionTime: duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Workflow intelligence analysis error', error);
    monitoringService.recordHttpRequest('POST', '/api/workflow-intelligence/analyze', 500, (Date.now() - startTime) / 1000);
    reply.code(500).send({ error: 'Workflow analysis failed' });
  }
});

// Plugin Management endpoints
app.get('/api/plugins', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get available plugins',
    tags: ['Plugins'],
    querystring: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        organizationId: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const PluginManager = require('./plugins/plugin-manager');
    const pluginManager = new PluginManager();
    await pluginManager.initialize();

    const { category, organizationId } = request.query;
    const plugins = pluginManager.getAvailablePlugins(category);
    const installedPlugins = organizationId ? pluginManager.getInstalledPlugins(organizationId) : [];

    return {
      success: true,
      data: {
        available: plugins,
        installed: installedPlugins,
        total: plugins.length
      }
    };
  } catch (error) {
    logger.error('Plugin listing error', error);
    reply.code(500).send({ error: 'Failed to list plugins' });
  }
});

app.post('/api/plugins/install', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Install a plugin',
    tags: ['Plugins'],
    body: {
      type: 'object',
      required: ['pluginId', 'organizationId'],
      properties: {
        pluginId: { type: 'string' },
        organizationId: { type: 'string' },
        config: { type: 'object' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const PluginManager = require('./plugins/plugin-manager');
    const pluginManager = new PluginManager();
    await pluginManager.initialize();

    const { pluginId, organizationId, config = {} } = request.body;
    const result = await pluginManager.installPlugin(organizationId, pluginId, config);

    return {
      success: true,
      data: result,
      message: `Plugin ${pluginId} installed successfully`
    };
  } catch (error) {
    logger.error('Plugin installation error', error);
    reply.code(400).send({ error: error.message });
  }
});

app.post('/api/plugins/recommendations', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get plugin recommendations based on business description',
    tags: ['Plugins'],
    body: {
      type: 'object',
      required: ['businessDescription', 'organizationId'],
      properties: {
        businessDescription: { type: 'string' },
        organizationId: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const PluginManager = require('./plugins/plugin-manager');
    const pluginManager = new PluginManager();
    await pluginManager.initialize();

    const { businessDescription, organizationId } = request.body;
    const recommendations = await pluginManager.getPluginRecommendations(businessDescription, organizationId);

    return {
      success: true,
      data: {
        recommendations,
        total: recommendations.length
      }
    };
  } catch (error) {
    logger.error('Plugin recommendations error', error);
    reply.code(500).send({ error: 'Failed to generate recommendations' });
  }
});

app.get('/api/plugins/compatibility/:organizationId', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get plugin compatibility report',
    tags: ['Plugins'],
    params: {
      type: 'object',
      properties: {
        organizationId: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const PluginManager = require('./plugins/plugin-manager');
    const pluginManager = new PluginManager();
    await pluginManager.initialize();

    const { organizationId } = request.params;
    const report = pluginManager.generateCompatibilityReport(organizationId);

    return {
      success: true,
      data: report
    };
  } catch (error) {
    logger.error('Compatibility report error', error);
    reply.code(500).send({ error: 'Failed to generate compatibility report' });
  }
});

// Autonomous Platform endpoints
app.get('/api/autonomous/status', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get autonomous platform status',
    tags: ['Autonomous Platform'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' }
        }
      }
    }
  }
}, async (request, reply) => {
  try {
    const status = autonomousPlatformManager.getAutonomousPlatformStatus();
    return {
      success: true,
      data: status
    };
  } catch (error) {
    logger.error('Autonomous status error', error);
    reply.code(500).send({ error: 'Failed to get autonomous status' });
  }
});

app.post('/api/autonomous/mode', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Enable or disable autonomous mode',
    tags: ['Autonomous Platform'],
    body: {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { enabled } = request.body;
    autonomousPlatformManager.setAutonomousMode(enabled);
    
    return {
      success: true,
      message: `Autonomous mode ${enabled ? 'enabled' : 'disabled'}`,
      data: { enabled }
    };
  } catch (error) {
    logger.error('Autonomous mode change error', error);
    reply.code(500).send({ error: 'Failed to change autonomous mode' });
  }
});

app.get('/api/autonomous/policies', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get autonomous policies',
    tags: ['Autonomous Platform']
  }
}, async (request, reply) => {
  try {
    const policies = autonomousPlatformManager.getAutonomousPolicies();
    return {
      success: true,
      data: policies
    };
  } catch (error) {
    logger.error('Autonomous policies error', error);
    reply.code(500).send({ error: 'Failed to get autonomous policies' });
  }
});

app.put('/api/autonomous/policies/:policyId', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Update autonomous policy',
    tags: ['Autonomous Platform'],
    params: {
      type: 'object',
      properties: {
        policyId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        rules: { type: 'array' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { policyId } = request.params;
    const updates = request.body;
    
    autonomousPlatformManager.updateAutonomousPolicy(policyId, updates);
    
    return {
      success: true,
      message: `Policy ${policyId} updated successfully`,
      data: { policyId, updates }
    };
  } catch (error) {
    logger.error('Autonomous policy update error', error);
    reply.code(500).send({ error: 'Failed to update autonomous policy' });
  }
});

app.get('/api/autonomous/health', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get autonomous system health',
    tags: ['Autonomous Platform']
  }
}, async (request, reply) => {
  try {
    const healthStatus = autonomousPlatformManager.selfHealingSystem.getSystemHealthStatus();
    return {
      success: true,
      data: healthStatus
    };
  } catch (error) {
    logger.error('Autonomous health error', error);
    reply.code(500).send({ error: 'Failed to get autonomous health' });
  }
});

app.get('/api/autonomous/learning', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get learning engine status',
    tags: ['Autonomous Platform']
  }
}, async (request, reply) => {
  try {
    const learningStatus = autonomousPlatformManager.learningEngine.getStatus();
    return {
      success: true,
      data: learningStatus
    };
  } catch (error) {
    logger.error('Learning engine status error', error);
    reply.code(500).send({ error: 'Failed to get learning engine status' });
  }
});

app.get('/api/autonomous/orchestration', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get agent orchestration status',
    tags: ['Autonomous Platform']
  }
}, async (request, reply) => {
  try {
    const orchestrationStatus = autonomousPlatformManager.agentOrchestrator.getStatus();
    return {
      success: true,
      data: orchestrationStatus
    };
  } catch (error) {
    logger.error('Agent orchestration status error', error);
    reply.code(500).send({ error: 'Failed to get orchestration status' });
  }
});

// Human-in-the-Loop endpoints
app.post('/api/hitl/approval/request', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Request human approval for autonomous operation',
    tags: ['Human-in-the-Loop'],
    body: {
      type: 'object',
      required: ['operation', 'context'],
      properties: {
        operation: { type: 'string' },
        context: { type: 'object' },
        decision: { type: 'object' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { operation, context, decision } = request.body;
    const humanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const hitlSystem = new humanInTheLoopSystem();
    await hitlSystem.initialize();
    
    const approvalResult = await hitlSystem.createApprovalRequest(operation, context, decision);
    
    return {
      success: true,
      data: approvalResult
    };
  } catch (error) {
    logger.error('Approval request error', error);
    reply.code(500).send({ error: 'Failed to create approval request' });
  }
});

app.post('/api/hitl/approval/:approvalId/respond', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Respond to approval request',
    tags: ['Human-in-the-Loop'],
    params: {
      type: 'object',
      properties: {
        approvalId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      required: ['decision'],
      properties: {
        decision: { type: 'string', enum: ['approve', 'reject'] },
        comments: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { approvalId } = request.params;
    const { decision, comments } = request.body;
    const approver = request.userId;
    
    const humanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const hitlSystem = new humanInTheLoopSystem();
    await hitlSystem.initialize();
    
    const result = await hitlSystem.processApprovalResponse(approvalId, approver, decision, comments);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    logger.error('Approval response error', error);
    reply.code(500).send({ error: 'Failed to process approval response' });
  }
});

app.get('/api/hitl/approvals/pending', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get pending approval requests',
    tags: ['Human-in-the-Loop']
  }
}, async (request, reply) => {
  try {
    const humanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const hitlSystem = new humanInTheLoopSystem();
    await hitlSystem.initialize();
    
    const pendingApprovals = await hitlSystem.getPendingApprovals();
    
    return {
      success: true,
      data: pendingApprovals
    };
  } catch (error) {
    logger.error('Pending approvals error', error);
    reply.code(500).send({ error: 'Failed to get pending approvals' });
  }
});

app.get('/api/hitl/approvals/history', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get approval history',
    tags: ['Human-in-the-Loop'],
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50 }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { limit } = request.query;
    const humanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const hitlSystem = new humanInTheLoopSystem();
    await hitlSystem.initialize();
    
    const approvalHistory = await hitlSystem.getApprovalHistory(limit);
    
    return {
      success: true,
      data: approvalHistory
    };
  } catch (error) {
    logger.error('Approval history error', error);
    reply.code(500).send({ error: 'Failed to get approval history' });
  }
});

app.get('/api/hitl/status', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get Human-in-the-Loop system status',
    tags: ['Human-in-the-Loop']
  }
}, async (request, reply) => {
  try {
    const humanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const hitlSystem = new humanInTheLoopSystem();
    await hitlSystem.initialize();
    
    const status = hitlSystem.getHITLStatus();
    
    return {
      success: true,
      data: status
    };
  } catch (error) {
    logger.error('HITL status error', error);
    reply.code(500).send({ error: 'Failed to get HITL status' });
  }
});

// Human Oversight Dashboard endpoints
app.get('/api/dashboard/:dashboardId', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get dashboard data',
    tags: ['Human Oversight Dashboard'],
    params: {
      type: 'object',
      properties: {
        dashboardId: { type: 'string' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { dashboardId } = request.params;
    const userId = request.userId;
    
    const humanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const dashboard = new humanOversightDashboard();
    await dashboard.initialize();
    
    const dashboardData = await dashboard.getDashboardData(dashboardId, userId);
    
    return {
      success: true,
      data: dashboardData
    };
  } catch (error) {
    logger.error('Dashboard data error', error);
    reply.code(500).send({ error: 'Failed to get dashboard data' });
  }
});

app.post('/api/dashboard/control/:controlPanelId/:controlId', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Execute control action',
    tags: ['Human Oversight Dashboard'],
    params: {
      type: 'object',
      properties: {
        controlPanelId: { type: 'string' },
        controlId: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        parameters: { type: 'object' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const { controlPanelId, controlId } = request.params;
    const { parameters } = request.body;
    const userId = request.userId;
    
    const humanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const dashboard = new humanOversightDashboard();
    await dashboard.initialize();
    
    const result = await dashboard.executeControlAction(controlPanelId, controlId, userId, parameters);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    logger.error('Control execution error', error);
    reply.code(500).send({ error: 'Failed to execute control action' });
  }
});

app.get('/api/dashboard/status', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get dashboard system status',
    tags: ['Human Oversight Dashboard']
  }
}, async (request, reply) => {
  try {
    const humanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const dashboard = new humanOversightDashboard();
    await dashboard.initialize();
    
    const status = dashboard.getDashboardStatus();
    
    return {
      success: true,
      data: status
    };
  } catch (error) {
    logger.error('Dashboard status error', error);
    reply.code(500).send({ error: 'Failed to get dashboard status' });
  }
});

app.get('/api/dashboard/control-panels', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get available control panels',
    tags: ['Human Oversight Dashboard']
  }
}, async (request, reply) => {
  try {
    const humanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const dashboard = new humanOversightDashboard();
    await dashboard.initialize();
    
    const controlPanels = dashboard.getControlPanelStatus();
    
    return {
      success: true,
      data: controlPanels
    };
  } catch (error) {
    logger.error('Control panels error', error);
    reply.code(500).send({ error: 'Failed to get control panels' });
  }
});

app.get('/api/dashboard/alert-systems', {
  preHandler: authenticateRequest,
  schema: {
    description: 'Get alert systems status',
    tags: ['Human Oversight Dashboard']
  }
}, async (request, reply) => {
  try {
    const humanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const dashboard = new humanOversightDashboard();
    await dashboard.initialize();
    
    const alertSystems = dashboard.getAlertSystemStatus();
    
    return {
      success: true,
      data: alertSystems
    };
  } catch (error) {
    logger.error('Alert systems error', error);
    reply.code(500).send({ error: 'Failed to get alert systems' });
  }
});

// Legacy endpoints for backward compatibility
app.get('/test', async (request, reply) => {
  reply.send({ 
    message: 'Orchestrall Platform is working',
    timestamp: new Date().toISOString(),
    version: config.deployment.version,
  });
});

app.get('/api/health', async (request, reply) => {
  reply.redirect('/health');
});

// Autonomous Platform Manager
let autonomousPlatformManager = null;

// Initialize and start server
async function start() {
  try {
    // Initialize services
    logger.info('Initializing Orchestrall Platform services...');
    
    // Connect to database
    await database.connect();
    logger.info('Database connected');
    
    // Connect to cache
    await cacheService.connect();
    logger.info('Cache service connected');
    
    // Register plugins
    await registerPlugins();
    logger.info('Plugins registered');
    
    // Initialize autonomous platform manager
    const AutonomousPlatformManager = require('./autonomous/autonomous-platform-manager');
    autonomousPlatformManager = new AutonomousPlatformManager();
    await autonomousPlatformManager.initialize();
    logger.info('Autonomous Platform Manager initialized');

    // Initialize Human-in-the-Loop system
    const HumanInTheLoopSystem = require('./autonomous/human-in-the-loop');
    const humanInTheLoopSystem = new HumanInTheLoopSystem();
    await humanInTheLoopSystem.initialize();
    logger.info('Human-in-the-Loop System initialized');

    // Initialize Human Oversight Dashboard
    const HumanOversightDashboard = require('./autonomous/human-oversight-dashboard');
    const humanOversightDashboard = new HumanOversightDashboard();
    await humanOversightDashboard.initialize();
    logger.info('Human Oversight Dashboard initialized');
    
    // Start monitoring
    monitoringService.startPerformanceMonitoring();
    logger.info('Monitoring started');
    
    // Start server
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    
    logger.info(`🚀 Orchestrall Platform started successfully!`);
    logger.info(`✅ Server running on ${address}`);
    logger.info(`📋 Available endpoints:`);
    logger.info(`   GET  /health - Comprehensive health check`);
    logger.info(`   GET  /metrics - Prometheus metrics`);
    logger.info(`   GET  /docs - API documentation`);
    logger.info(`   POST /auth/login - User login`);
    logger.info(`   GET  /auth/me - Get current user`);
    logger.info(`   GET  /api/agents - List agents`);
    logger.info(`   POST /api/agents/:name/execute - Execute agent`);
    logger.info(`   GET  /security/compliance - Security compliance report`);
    logger.info(`   POST /api/keys - Create API key`);
    
    logger.info(`🔐 Demo credentials:`);
    logger.info(`   Email: admin@orchestrall.com`);
    logger.info(`   Password: admin123`);
    
    logger.info(`🤖 Available agents:`);
    const agents = await agentSystem.listAgents();
    agents.forEach(agent => {
      logger.info(`   - ${agent.name}: ${agent.description}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  try {
    await app.close();
    await database.disconnect();
    await cacheService.disconnect();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  try {
    await app.close();
    await database.disconnect();
    await cacheService.disconnect();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

// Start the server
start();
