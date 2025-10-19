// Test app-commercial.js startup step by step
require('dotenv').config();
console.log('Starting app-commercial.js test...');

try {
  console.log('1. Loading fastify...');
  const fastify = require('fastify');
  
  console.log('2. Loading config...');
  const config = require('./src/config');
  
  console.log('3. Loading logger...');
  const logger = require('./src/utils/logger');
  
  console.log('4. Loading database...');
  const database = require('./src/database');
  
  console.log('5. Loading auth service...');
  const authService = require('./src/auth');
  
  console.log('6. Loading agent system...');
  const agentSystem = require('./src/agents');
  
  console.log('7. Loading cache service...');
  const cacheService = require('./src/cache');
  
  console.log('8. Loading monitoring service...');
  const monitoringService = require('./src/monitoring');
  
  console.log('9. Loading security service...');
  const securityService = require('./src/security');
  
  console.log('10. Creating Fastify app...');
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
  
  console.log('11. All components loaded successfully!');
  console.log('App creation completed without errors.');
  
} catch(e) {
  console.error('Error at step:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
}
