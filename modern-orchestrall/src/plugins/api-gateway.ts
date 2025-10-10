import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { config } from '../core/config';
import { logger } from '../utils/logger';

declare module 'fastify' {
  interface FastifyInstance {
    apiGateway: APIGateway;
  }
}

interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  service: string;
  rateLimit?: {
    window: number;
    max: number;
  };
  auth?: boolean;
  featureFlag?: string;
}

interface ServiceRegistry {
  [serviceName: string]: {
    baseUrl: string;
    healthCheck: string;
    timeout: number;
  };
}

class APIGateway {
  private routes: Map<string, RouteConfig> = new Map();
  private services: ServiceRegistry;
  private circuitBreakers: Map<string, { failures: number; lastFailure: number }> = new Map();

  constructor() {
    this.services = {
      'auth-service': {
        baseUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        healthCheck: '/health',
        timeout: 5000,
      },
      'user-service': {
        baseUrl: process.env.USER_SERVICE_URL || 'http://localhost:3002',
        healthCheck: '/health',
        timeout: 5000,
      },
      'organization-service': {
        baseUrl: process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3003',
        healthCheck: '/health',
        timeout: 5000,
      },
      'plugin-service': {
        baseUrl: process.env.PLUGIN_SERVICE_URL || 'http://localhost:3004',
        healthCheck: '/health',
        timeout: 5000,
      },
      'workflow-service': {
        baseUrl: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3005',
        healthCheck: '/health',
        timeout: 5000,
      },
    };

    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Define API routes and their target services
    const routeConfigs: RouteConfig[] = [
      // Auth routes
      { path: '/auth/*', method: 'POST', service: 'auth-service', auth: false },
      { path: '/auth/me', method: 'GET', service: 'auth-service', auth: true },
      { path: '/auth/logout', method: 'POST', service: 'auth-service', auth: true },

      // User routes
      { path: '/users', method: 'GET', service: 'user-service', auth: true, rateLimit: { window: 60000, max: 100 } },
      { path: '/users/:id', method: 'GET', service: 'user-service', auth: true },

      // Organization routes
      { path: '/organizations', method: 'GET', service: 'organization-service', auth: true },
      { path: '/organizations/:id', method: 'GET', service: 'organization-service', auth: true },

      // Plugin routes
      { path: '/plugins', method: 'GET', service: 'plugin-service', auth: true, featureFlag: 'crm-integration' },
      { path: '/plugins/:id', method: 'GET', service: 'plugin-service', auth: true },

      // Workflow routes
      { path: '/workflows', method: 'GET', service: 'workflow-service', auth: true, featureFlag: 'workflow-automation' },
      { path: '/workflows/:id/execute', method: 'POST', service: 'workflow-service', auth: true },
    ];

    routeConfigs.forEach(route => {
      const key = `${route.method}:${route.path}`;
      this.routes.set(key, route);
    });
  }

  async routeRequest(
    method: string,
    path: string,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const routeKey = `${method}:${path}`;
    const route = this.routes.get(routeKey);

    if (!route) {
      reply.code(404).send({ error: 'Route not found' });
      return;
    }

    // Check feature flag if required
    if (route.featureFlag && request.featureFlags) {
      if (!request.featureFlags.get(route.featureFlag)) {
        reply.code(403).send({ error: 'Feature not enabled' });
        return;
      }
    }

    // Check authentication if required
    if (route.auth && !request.user) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    // Check rate limiting if configured
    if (route.rateLimit) {
      const rateLimitKey = `${request.user?.id || request.ip}:${route.path}`;
      // In a real implementation, this would check Redis or similar
    }

    // Check circuit breaker
    if (this.isCircuitOpen(route.service)) {
      reply.code(503).send({ error: 'Service temporarily unavailable' });
      return;
    }

    try {
      // Route to appropriate service
      await this.proxyToService(route, request, reply);
    } catch (error) {
      logger.error(`API Gateway error for ${routeKey}:`, error);

      // Record circuit breaker failure
      this.recordFailure(route.service);

      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  private isCircuitOpen(serviceName: string): boolean {
    const circuit = this.circuitBreakers.get(serviceName);
    if (!circuit) return false;

    // Circuit opens after 5 failures within 60 seconds
    const threshold = 5;
    const window = 60000; // 60 seconds

    if (circuit.failures >= threshold) {
      const timeSinceLastFailure = Date.now() - circuit.lastFailure;
      if (timeSinceLastFailure < window) {
        return true;
      } else {
        // Reset circuit breaker after window expires
        this.circuitBreakers.delete(serviceName);
      }
    }

    return false;
  }

  private recordFailure(serviceName: string): void {
    const circuit = this.circuitBreakers.get(serviceName) || { failures: 0, lastFailure: 0 };
    circuit.failures++;
    circuit.lastFailure = Date.now();
    this.circuitBreakers.set(serviceName, circuit);
  }

  private async proxyToService(
    route: RouteConfig,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const service = this.services[route.service];
    if (!service) {
      throw new Error(`Service '${route.service}' not configured`);
    }

    // In a real implementation, this would proxy to the actual service
    // For now, return mock response
    reply.send({
      message: `Request routed to ${route.service}`,
      path: route.path,
      method: route.method,
      service: route.service,
    });
  }

  async healthCheck(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const [serviceName, service] of Object.entries(this.services)) {
      try {
        // In a real implementation, this would check actual service health
        results[serviceName] = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        results[serviceName] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return results;
  }

  getRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }

  getServices(): ServiceRegistry {
    return { ...this.services };
  }
}

export const apiGatewayPlugin = fp(async (fastify: FastifyInstance) => {
  const apiGateway = new APIGateway();

  // Add to fastify instance
  fastify.decorate('apiGateway', apiGateway);

  // API Gateway health endpoint
  fastify.get('/api/v2/gateway/health', async (request, reply) => {
    const health = await apiGateway.healthCheck();
    return {
      success: true,
      data: health,
    };
  });

  // API Gateway routes endpoint
  fastify.get('/api/v2/gateway/routes', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            path: z.string(),
            method: z.string(),
            service: z.string(),
            auth: z.boolean().optional(),
            featureFlag: z.string().optional(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const routes = apiGateway.getRoutes();
    return {
      success: true,
      data: routes.map(route => ({
        path: route.path,
        method: route.method,
        service: route.service,
        auth: route.auth,
        featureFlag: route.featureFlag,
      })),
    };
  });

  // API Gateway services endpoint
  fastify.get('/api/v2/gateway/services', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.record(z.object({
            baseUrl: z.string(),
            healthCheck: z.string(),
            timeout: z.number(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    return {
      success: true,
      data: apiGateway.getServices(),
    };
  });

  logger.info('API Gateway plugin registered');
});
