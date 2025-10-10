import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { externalAPIsPlugin } from './plugins/external-apis';

const server = Fastify({
  logger: logger,
  ajv: {
    customOptions: {
      removeAdditional: true,
      useDefaults: true,
      coerceTypes: true,
      strict: false,
    },
  },
});

// Register compilers for Zod validation
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Register security and utility plugins
await server.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

await server.register(cors, {
  origin: config.cors.origin,
  credentials: true,
});

await server.register(rateLimit, {
  max: 1000,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    // Use organization ID for rate limiting if available
    return req.headers['x-organization-id'] as string || req.ip;
  },
});

// Register core plugins
await server.register(authPlugin);
await server.register(featureFlagPlugin);
await server.register(agentRuntimePlugin);
await server.register(apiGatewayPlugin);

// Register external APIs plugin
await server.register(externalAPIsPlugin, {
  config: {
    enableRateLimiting: true,
    corsOrigins: config.cors.origin,
    apiKeyRequired: true,
    maxRequestSize: '10mb',
  },
});

// Health check endpoint
server.get('/health', {
  schema: {
    response: {
      200: z.object({
        status: z.string(),
        timestamp: z.string(),
        version: z.string(),
        uptime: z.number(),
      }),
    },
  },
}, async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.version,
    uptime: process.uptime(),
  };
});

// API versioning endpoint
server.get('/api/v2', {
  schema: {
    response: {
      200: z.object({
        message: z.string(),
        version: z.string(),
        features: z.array(z.string()),
      }),
    },
  },
}, async (request, reply) => {
  return {
    message: 'Orchestrall API v2',
    version: config.version,
    features: [
      'microservices',
      'agentic-ai',
      'hybrid-deployment',
      'feature-flags',
      'multi-tenancy',
    ],
  };
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  await server.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handler
server.setErrorHandler(errorHandler);

// Start server
const start = async () => {
  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(`Server listening on ${config.host}:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Version: ${config.version}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
