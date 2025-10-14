// src/database/index.js - Database Connection and Prisma Client
const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: config.database.url,
          },
        },
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'error',
          },
          {
            emit: 'event',
            level: 'info',
          },
          {
            emit: 'event',
            level: 'warn',
          },
        ],
      });

      // Add query logging
      this.prisma.$on('query', (e) => {
        logger.database('query', 'prisma', e.duration, {
          query: e.query,
          params: e.params,
        });
      });

      this.prisma.$on('error', (e) => {
        logger.error('Prisma Error', e);
      });

      this.prisma.$on('info', (e) => {
        logger.info('Prisma Info', e);
      });

      this.prisma.$on('warn', (e) => {
        logger.warn('Prisma Warning', e);
      });

      // Test connection
      await this.prisma.$connect();
      await this.prisma.$queryRaw`SELECT 1`;
      
      this.isConnected = true;
      logger.info('Database connected successfully', {
        url: config.database.url.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
      });

      return this.prisma;
    } catch (error) {
      logger.error('Database connection failed', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  async healthCheck() {
    try {
      if (!this.prisma) {
        throw new Error('Database not initialized');
      }
      
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime: duration,
        connected: this.isConnected,
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false,
      };
    }
  }

  // Get Prisma client instance
  get client() {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // Transaction helper
  async transaction(callback) {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    
    return this.prisma.$transaction(callback);
  }

  // Raw query helper
  async rawQuery(query, ...params) {
    if (!this.prisma) {
      throw new Error('Database not connected. Call connect() first.');
    }
    
    return this.prisma.$queryRawUnsafe(query, ...params);
  }
}

// Create singleton instance
const database = new Database();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, disconnecting database...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, disconnecting database...');
  await database.disconnect();
  process.exit(0);
});

module.exports = database;
