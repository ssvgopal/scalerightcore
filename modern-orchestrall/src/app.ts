// src/app.ts
import fastify, { FastifyInstance } from 'fastify';
import { config } from './core/config';
import { Logger } from './core/monitoring/logger';
import { authRoutes } from './routes/auth';
import { agentRoutes } from './routes/agents';
import { healthRoutes } from './routes/health';

export class OrchestrallApp {
  private app: FastifyInstance;
  private logger: Logger;

  constructor() {
    this.app = fastify({
      logger: false, // We'll use our own logger
      trustProxy: true
    });

    this.logger = new Logger();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    // CORS configuration
    this.app.register(require('@fastify/cors'), {
      origin: config.server.cors.origin,
      credentials: config.server.cors.credentials
    });

    // Request logging
    this.app.addHook('onRequest', async (request, reply) => {
      this.logger.info(`Request: ${request.method} ${request.url}`, {
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
    });

    // Response logging
    this.app.addHook('onResponse', async (request, reply) => {
      this.logger.info(`Response: ${reply.statusCode}`, {
        method: request.method,
        url: request.url,
        duration: reply.getResponseTime()
      });
    });
  }

  private setupRoutes() {
    // Register route modules
    this.app.register(authRoutes, { prefix: '/api/auth' });
    this.app.register(agentRoutes, { prefix: '/api' });
    this.app.register(healthRoutes, { prefix: '/api' });
  }

  private setupErrorHandling() {
    // Global error handler
    this.app.setErrorHandler((error, request, reply) => {
      this.logger.error('Unhandled error', error, {
        method: request.method,
        url: request.url,
        stack: error.stack
      });

      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  async start(): Promise<void> {
    try {
      await this.app.listen({
        port: config.server.port,
        host: config.server.host
      });

      this.logger.info(`Server started successfully`, {
        port: config.server.port,
        host: config.server.host,
        environment: process.env.NODE_ENV || 'development'
      });

      console.log(`🚀 Orchestrall MVP Server running on http://${config.server.host}:${config.server.port}`);
      console.log(`📚 API Documentation available at http://${config.server.host}:${config.server.port}/api/health`);

    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Shutting down server');
    await this.app.close();
  }

  getApp(): FastifyInstance {
    return this.app;
  }
}
