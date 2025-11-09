// Test server startup step by step
require('dotenv').config();
console.log('=== TESTING SERVER STARTUP ===');

async function testStartup() {
  try {
    console.log('1. Loading components...');
    const fastify = require('fastify');
    const config = require('./src/config');
    const logger = require('./src/utils/logger');
    const database = require('./src/database');
    const cacheService = require('./src/cache');
    const monitoringService = require('./src/monitoring');
    const securityService = require('./src/security');
    
    console.log('2. Creating Fastify app...');
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
    
    console.log('3. Connecting to database...');
    await database.connect();
    console.log('4. Database connected');
    
    console.log('5. Connecting to cache...');
    await cacheService.connect();
    console.log('6. Cache connected');
    
    console.log('7. Starting monitoring...');
    monitoringService.startPerformanceMonitoring();
    console.log('8. Monitoring started');
    
    console.log('9. Starting server...');
    console.log(`   Port: ${config.server.port}`);
    console.log(`   Host: ${config.server.host}`);
    
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    
    console.log('10. ✅ SERVER STARTED SUCCESSFULLY!');
    console.log(`    Address: ${address}`);
    
  } catch (error) {
    console.error('❌ STARTUP FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testStartup();
