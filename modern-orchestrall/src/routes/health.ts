// src/routes/health.ts
import { FastifyInstance } from 'fastify';

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
    authentication: 'available' | 'unavailable';
    agents: 'available' | 'unavailable';
  };
}

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async (request, reply) => {
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0-mvp',
      services: {
        database: 'connected', // For MVP, assume connected
        authentication: 'available',
        agents: 'available'
      }
    };

    reply.send(healthCheck);
  });

  // Readiness check for Kubernetes
  fastify.get('/ready', async (request, reply) => {
    // Check if core services are ready
    const ready = true; // For MVP, assume ready

    if (ready) {
      reply.code(200).send({ status: 'ready' });
    } else {
      reply.code(503).send({ status: 'not ready' });
    }
  });

  // Liveness check for Kubernetes
  fastify.get('/live', async (request, reply) => {
    // Check if application is alive
    reply.code(200).send({ status: 'alive' });
  });
}
