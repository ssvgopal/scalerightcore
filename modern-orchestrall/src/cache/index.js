// src/cache/index.js - Redis Caching System
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour
  }

  async connect() {
    try {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      // Add event listeners
      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.redis.ping();
      
      logger.info('Redis cache service initialized', {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      });

      return this.redis;
    } catch (error) {
      logger.error('Redis connection failed', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  async healthCheck() {
    try {
      if (!this.redis) {
        throw new Error('Redis not initialized');
      }
      
      const start = Date.now();
      await this.redis.ping();
      const duration = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime: duration,
        connected: this.isConnected,
      };
    } catch (error) {
      logger.error('Redis health check failed', error);
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false,
      };
    }
  }

  // Basic cache operations
  async get(key) {
    try {
      if (!this.isConnected) return null;
      
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) return false;
      
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  async expire(key, ttl) {
    try {
      if (!this.isConnected) return false;
      
      await this.redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Cache expire error', { key, error: error.message });
      return false;
    }
  }

  // Advanced cache operations
  async mget(keys) {
    try {
      if (!this.isConnected) return [];
      
      const values = await this.redis.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Cache mget error', { keys, error: error.message });
      return [];
    }
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) return false;
      
      const pipeline = this.redis.pipeline();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serialized = JSON.stringify(value);
        pipeline.setex(key, ttl, serialized);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error', { error: error.message });
      return false;
    }
  }

  // Pattern-based operations
  async keys(pattern) {
    try {
      if (!this.isConnected) return [];
      
      const keys = await this.redis.keys(pattern);
      return keys;
    } catch (error) {
      logger.error('Cache keys error', { pattern, error: error.message });
      return [];
    }
  }

  async flushPattern(pattern) {
    try {
      if (!this.isConnected) return false;
      
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error('Cache flush pattern error', { pattern, error: error.message });
      return false;
    }
  }

  // Cache with fallback function
  async getOrSet(key, fallbackFn, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value !== null) {
        logger.debug('Cache hit', { key });
        return value;
      }
      
      // Cache miss, execute fallback function
      logger.debug('Cache miss, executing fallback', { key });
      value = await fallbackFn();
      
      // Store in cache
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error: error.message });
      // If cache fails, still try to execute fallback
      return await fallbackFn();
    }
  }

  // Agent-specific caching
  async cacheAgentExecution(agentName, input, result, ttl = 1800) {
    const key = `agent:${agentName}:${this.hashInput(input)}`;
    return this.set(key, result, ttl);
  }

  async getCachedAgentExecution(agentName, input) {
    const key = `agent:${agentName}:${this.hashInput(input)}`;
    return this.get(key);
  }

  // User session caching
  async cacheUserSession(userId, sessionData, ttl = 86400) {
    const key = `session:${userId}`;
    return this.set(key, sessionData, ttl);
  }

  async getUserSession(userId) {
    const key = `session:${userId}`;
    return this.get(key);
  }

  async invalidateUserSession(userId) {
    const key = `session:${userId}`;
    return this.del(key);
  }

  // Rate limiting
  async incrementRateLimit(key, window = 3600) {
    try {
      if (!this.isConnected) return 0;
      
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, window);
      
      const results = await pipeline.exec();
      return results[0][1];
    } catch (error) {
      logger.error('Rate limit increment error', { key, error: error.message });
      return 0;
    }
  }

  async getRateLimit(key) {
    try {
      if (!this.isConnected) return 0;
      
      const count = await this.redis.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      logger.error('Rate limit get error', { key, error: error.message });
      return 0;
    }
  }

  // Utility functions
  hashInput(input) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(input)).digest('hex');
  }

  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  // Cache statistics
  async getStats() {
    try {
      if (!this.isConnected) return null;
      
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.isConnected,
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
      };
    } catch (error) {
      logger.error('Cache stats error', error);
      return null;
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, disconnecting Redis...');
  await cacheService.disconnect();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, disconnecting Redis...');
  await cacheService.disconnect();
});

module.exports = cacheService;
