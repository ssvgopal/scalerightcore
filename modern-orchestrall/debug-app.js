// debug-app.js - Debug version of app-commercial.js
require('dotenv').config();
console.log('Environment loaded');

try {
  console.log('Loading fastify...');
  const fastify = require('fastify');
  console.log('Fastify loaded');

  console.log('Loading config...');
  const config = require('./src/config');
  console.log('Config loaded:', config.server.port);

  console.log('Loading database...');
  const database = require('./src/database');
  console.log('Database module loaded');

  console.log('Loading logger...');
  const logger = require('./src/utils/logger');
  console.log('Logger loaded');

  console.log('Creating Fastify app...');
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
  console.log('Fastify app created');

  // Add basic health endpoint
  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  console.log('Starting server...');
  app.listen({ port: config.server.port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
    console.log('Server listening on', address);
  });

} catch (error) {
  console.error('Error in debug app:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
