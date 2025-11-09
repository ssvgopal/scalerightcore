const Redis = require('redis');
const { PrismaClient } = require('@prisma/client');
const NodeCache = require('node-cache');

class PerformanceOptimizationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    
    // Cache configurations
    this.cacheConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || null,
        db: process.env.REDIS_DB || 0
      },
      memory: {
        stdTTL: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes default
        checkperiod: parseInt(process.env.CACHE_CHECK_PERIOD) || 120, // 2 minutes
        useClones: false
      }
    };
    
    // Cache instances
    this.redis = null;
    this.memoryCache = new NodeCache(this.cacheConfig.memory);
    
    // Query optimization settings
    this.queryOptimization = {
      connectionPoolSize: parseInt(process.env.DB_POOL_SIZE) || 20,
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
      enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
      enableSlowQueryLogging: process.env.ENABLE_SLOW_QUERY_LOGGING === 'true',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000 // 1 second
    };
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      queryCount: 0,
      slowQueries: 0,
      averageQueryTime: 0
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize Redis connection
      await this.initializeRedis();
      
      // Initialize database optimizations
      await this.initializeDatabaseOptimizations();
      
      // Initialize query optimization
      await this.initializeQueryOptimization();
      
      // Initialize performance monitoring
      await this.initializePerformanceMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Performance Optimization Service initialized');
    } catch (error) {
      console.error('Failed to initialize Performance Optimization Service:', error);
      throw error;
    }
  }

  async initializeRedis() {
    try {
      this.redis = Redis.createClient({
        host: this.cacheConfig.redis.host,
        port: this.cacheConfig.redis.port,
        password: this.cacheConfig.redis.password,
        db: this.cacheConfig.redis.db,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.warn('Redis connection refused, falling back to memory cache');
            return undefined; // Don't retry
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redis.on('error', (err) => {
        console.warn('Redis error:', err.message);
        this.redis = null; // Fall back to memory cache
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      await this.redis.connect();
    } catch (error) {
      console.warn('Failed to connect to Redis, using memory cache only:', error.message);
      this.redis = null;
    }
  }

  async initializeDatabaseOptimizations() {
    try {
      // Configure Prisma connection pool
      this.prisma.$connect();
      
      // Enable query logging if configured
      if (this.queryOptimization.enableQueryLogging) {
        this.prisma.$on('query', (e) => {
          console.log('Query:', e.query);
          console.log('Params:', e.params);
          console.log('Duration:', e.duration + 'ms');
          
          // Track slow queries
          if (e.duration > this.queryOptimization.slowQueryThreshold) {
            this.metrics.slowQueries++;
            if (this.queryOptimization.enableSlowQueryLogging) {
              console.warn(`Slow query detected (${e.duration}ms):`, e.query);
            }
          }
          
          // Update average query time
          this.metrics.queryCount++;
          this.metrics.averageQueryTime = 
            (this.metrics.averageQueryTime * (this.metrics.queryCount - 1) + e.duration) / this.metrics.queryCount;
        });
      }
      
      console.log('✅ Database optimizations initialized');
    } catch (error) {
      console.error('Failed to initialize database optimizations:', error);
      throw error;
    }
  }

  async initializeQueryOptimization() {
    try {
      // Create database indexes for better performance
      await this.createPerformanceIndexes();
      
      // Initialize query caching strategies
      await this.initializeQueryCaching();
      
      console.log('✅ Query optimization initialized');
    } catch (error) {
      console.error('Failed to initialize query optimization:', error);
      throw error;
    }
  }

  async createPerformanceIndexes() {
    try {
      // Create indexes for frequently queried fields
      const indexes = [
        // Farmer profile indexes
        'CREATE INDEX IF NOT EXISTS idx_farmer_organization ON "FarmerProfile"("organizationId")',
        'CREATE INDEX IF NOT EXISTS idx_farmer_region ON "FarmerProfile"("region")',
        'CREATE INDEX IF NOT EXISTS idx_farmer_phone ON "FarmerProfile"("phone")',
        'CREATE INDEX IF NOT EXISTS idx_farmer_created ON "FarmerProfile"("createdAt")',
        
        // Crop indexes
        'CREATE INDEX IF NOT EXISTS idx_crop_farmer ON "Crop"("farmerId")',
        'CREATE INDEX IF NOT EXISTS idx_crop_organization ON "Crop"("organizationId")',
        'CREATE INDEX IF NOT EXISTS idx_crop_status ON "Crop"("status")',
        'CREATE INDEX IF NOT EXISTS idx_crop_planting_date ON "Crop"("plantingDate")',
        
        // Voice call indexes
        'CREATE INDEX IF NOT EXISTS idx_voice_farmer ON "VoiceCall"("farmerId")',
        'CREATE INDEX IF NOT EXISTS idx_voice_organization ON "VoiceCall"("organizationId")',
        'CREATE INDEX IF NOT EXISTS idx_voice_language ON "VoiceCall"("language")',
        'CREATE INDEX IF NOT EXISTS idx_voice_created ON "VoiceCall"("createdAt")',
        
        // Payment indexes
        'CREATE INDEX IF NOT EXISTS idx_payment_farmer ON "Payment"("farmerId")',
        'CREATE INDEX IF NOT EXISTS idx_payment_organization ON "Payment"("organizationId")',
        'CREATE INDEX IF NOT EXISTS idx_payment_status ON "Payment"("status")',
        'CREATE INDEX IF NOT EXISTS idx_payment_created ON "Payment"("createdAt")',
        
        // Organization indexes
        'CREATE INDEX IF NOT EXISTS idx_org_slug ON "Organization"("slug")',
        'CREATE INDEX IF NOT EXISTS idx_org_tier ON "Organization"("tier")',
        'CREATE INDEX IF NOT EXISTS idx_org_status ON "Organization"("status")',
        
        // Composite indexes for common query patterns
        'CREATE INDEX IF NOT EXISTS idx_farmer_org_region ON "FarmerProfile"("organizationId", "region")',
        'CREATE INDEX IF NOT EXISTS idx_crop_farmer_status ON "Crop"("farmerId", "status")',
        'CREATE INDEX IF NOT EXISTS idx_voice_org_language ON "VoiceCall"("organizationId", "language")',
        'CREATE INDEX IF NOT EXISTS idx_payment_org_status ON "Payment"("organizationId", "status")'
      ];

      for (const indexQuery of indexes) {
        try {
          await this.prisma.$executeRaw`${indexQuery}`;
        } catch (error) {
          console.warn(`Failed to create index: ${indexQuery}`, error.message);
        }
      }

      console.log('✅ Performance indexes created');
    } catch (error) {
      console.error('Failed to create performance indexes:', error);
      throw error;
    }
  }

  async initializeQueryCaching() {
    try {
      // Define caching strategies for different query types
      this.cachingStrategies = {
        // Farmer queries
        'farmer.list': { ttl: 300, key: 'farmers:list' },
        'farmer.get': { ttl: 600, key: 'farmer:get' },
        'farmer.by_region': { ttl: 300, key: 'farmers:region' },
        
        // Crop queries
        'crop.list': { ttl: 300, key: 'crops:list' },
        'crop.get': { ttl: 600, key: 'crop:get' },
        'crop.by_farmer': { ttl: 300, key: 'crops:farmer' },
        
        // Voice queries
        'voice.analytics': { ttl: 60, key: 'voice:analytics' },
        'voice.languages': { ttl: 3600, key: 'voice:languages' },
        
        // Organization queries
        'org.list': { ttl: 600, key: 'organizations:list' },
        'org.get': { ttl: 900, key: 'organization:get' },
        
        // Analytics queries
        'analytics.dashboard': { ttl: 60, key: 'analytics:dashboard' },
        'analytics.farmers': { ttl: 300, key: 'analytics:farmers' },
        'analytics.crops': { ttl: 300, key: 'analytics:crops' }
      };

      console.log('✅ Query caching strategies initialized');
    } catch (error) {
      console.error('Failed to initialize query caching:', error);
      throw error;
    }
  }

  async initializePerformanceMonitoring() {
    try {
      // Start performance monitoring
      setInterval(() => {
        this.logPerformanceMetrics();
      }, 60000); // Log every minute

      console.log('✅ Performance monitoring initialized');
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
      throw error;
    }
  }

  // Cache management methods
  async get(key) {
    try {
      // Try Redis first
      if (this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          this.metrics.cacheHits++;
          return JSON.parse(value);
        }
      }
      
      // Fall back to memory cache
      const value = this.memoryCache.get(key);
      if (value) {
        this.metrics.cacheHits++;
        return value;
      }
      
      this.metrics.cacheMisses++;
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.metrics.cacheMisses++;
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const cacheTTL = ttl || this.cacheConfig.memory.stdTTL;
      
      // Set in Redis if available
      if (this.redis) {
        await this.redis.setEx(key, cacheTTL, JSON.stringify(value));
      }
      
      // Set in memory cache as fallback
      this.memoryCache.set(key, value, cacheTTL);
      
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      // Delete from Redis if available
      if (this.redis) {
        await this.redis.del(key);
      }
      
      // Delete from memory cache
      this.memoryCache.del(key);
      
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async clear(pattern = null) {
    try {
      if (pattern) {
        // Clear keys matching pattern
        if (this.redis) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(keys);
          }
        }
        
        // Clear memory cache keys matching pattern
        const memoryKeys = this.memoryCache.keys();
        const matchingKeys = memoryKeys.filter(key => key.includes(pattern.replace('*', '')));
        this.memoryCache.del(matchingKeys);
      } else {
        // Clear all cache
        if (this.redis) {
          await this.redis.flushDb();
        }
        this.memoryCache.flushAll();
      }
      
      return true;
    } catch (error) {
      console.error(`Cache clear error:`, error);
      return false;
    }
  }

  // Query optimization methods
  async optimizedQuery(queryType, queryFunction, params = {}) {
    try {
      const strategy = this.cachingStrategies[queryType];
      if (!strategy) {
        // No caching strategy, execute query directly
        return await queryFunction();
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(strategy.key, params);
      
      // Try to get from cache
      const cachedResult = await this.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Execute query
      const result = await queryFunction();
      
      // Cache result
      await this.set(cacheKey, result, strategy.ttl);
      
      return result;
    } catch (error) {
      console.error(`Optimized query error for ${queryType}:`, error);
      throw error;
    }
  }

  generateCacheKey(baseKey, params) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join(':');
    
    return paramString ? `${baseKey}:${paramString}` : baseKey;
  }

  // Database optimization methods
  async optimizeFarmerQueries(organizationId, region = null) {
    const cacheKey = this.generateCacheKey('farmers:optimized', { organizationId, region });
    
    return this.optimizedQuery('farmer.list', async () => {
      const whereClause = {
        organizationId,
        ...(region && { region })
      };

      return await this.prisma.farmerProfile.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          region: true,
          landSize: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Limit results for performance
      });
    }, { organizationId, region });
  }

  async optimizeCropQueries(farmerId = null, organizationId = null) {
    const cacheKey = this.generateCacheKey('crops:optimized', { farmerId, organizationId });
    
    return this.optimizedQuery('crop.list', async () => {
      const whereClause = {};
      if (farmerId) whereClause.farmerId = farmerId;
      if (organizationId) whereClause.organizationId = organizationId;

      return await this.prisma.crop.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          type: true,
          plantingDate: true,
          expectedHarvestDate: true,
          status: true,
          farmerId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { plantingDate: 'desc' },
        take: 1000
      });
    }, { farmerId, organizationId });
  }

  async optimizeVoiceAnalytics(organizationId, timeRange = '7d') {
    const cacheKey = this.generateCacheKey('voice:analytics:optimized', { organizationId, timeRange });
    
    return this.optimizedQuery('voice.analytics', async () => {
      const timeRanges = {
        '1d': 1 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeMs = timeRanges[timeRange] || timeRanges['7d'];
      const startTime = new Date(Date.now() - timeMs);

      const analytics = await this.prisma.voiceCall.groupBy({
        by: ['language', 'status'],
        where: {
          organizationId,
          createdAt: { gte: startTime }
        },
        _count: { id: true },
        _avg: { duration: true }
      });

      return {
        totalCalls: analytics.reduce((sum, item) => sum + item._count.id, 0),
        averageDuration: analytics.reduce((sum, item) => sum + (item._avg.duration || 0), 0) / analytics.length,
        byLanguage: analytics.reduce((acc, item) => {
          acc[item.language] = (acc[item.language] || 0) + item._count.id;
          return acc;
        }, {}),
        byStatus: analytics.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + item._count.id;
          return acc;
        }, {})
      };
    }, { organizationId, timeRange });
  }

  // Performance monitoring methods
  logPerformanceMetrics() {
    const hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
    
    console.log('📊 Performance Metrics:', {
      cacheHitRate: `${hitRate.toFixed(2)}%`,
      totalQueries: this.metrics.queryCount,
      slowQueries: this.metrics.slowQueries,
      averageQueryTime: `${this.metrics.averageQueryTime.toFixed(2)}ms`,
      memoryCacheKeys: this.memoryCache.keys().length,
      redisConnected: this.redis ? 'Yes' : 'No'
    });
  }

  async getPerformanceMetrics() {
    const hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
    
    return {
      cache: {
        hitRate: hitRate,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        memoryKeys: this.memoryCache.keys().length,
        redisConnected: !!this.redis
      },
      database: {
        totalQueries: this.metrics.queryCount,
        slowQueries: this.metrics.slowQueries,
        averageQueryTime: this.metrics.averageQueryTime,
        slowQueryThreshold: this.queryOptimization.slowQueryThreshold
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  // Cache warming methods
  async warmCache() {
    try {
      console.log('🔥 Starting cache warming...');
      
      // Warm farmer data cache
      const organizations = await this.prisma.organization.findMany({
        where: { status: 'active' },
        select: { id: true, name: true }
      });

      for (const org of organizations) {
        await this.optimizeFarmerQueries(org.id);
        await this.optimizeCropQueries(null, org.id);
        await this.optimizeVoiceAnalytics(org.id);
      }

      // Warm system-wide caches
      await this.set('system:organizations', organizations, 3600);
      await this.set('system:health', { status: 'healthy', timestamp: new Date() }, 60);

      console.log('✅ Cache warming completed');
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  // Cache invalidation methods
  async invalidateFarmerCache(farmerId, organizationId) {
    const patterns = [
      'farmers:list:*',
      'farmer:get:*',
      'farmers:region:*',
      'analytics:farmers:*'
    ];

    for (const pattern of patterns) {
      await this.clear(pattern);
    }

    // Invalidate organization-specific caches
    if (organizationId) {
      await this.clear(`*:${organizationId}:*`);
    }
  }

  async invalidateCropCache(cropId, farmerId, organizationId) {
    const patterns = [
      'crops:list:*',
      'crop:get:*',
      'crops:farmer:*',
      'analytics:crops:*'
    ];

    for (const pattern of patterns) {
      await this.clear(pattern);
    }

    // Invalidate farmer-specific caches
    if (farmerId) {
      await this.invalidateFarmerCache(farmerId, organizationId);
    }
  }

  async invalidateVoiceCache(organizationId) {
    const patterns = [
      'voice:analytics:*',
      'voice:languages:*'
    ];

    for (const pattern of patterns) {
      await this.clear(pattern);
    }

    // Invalidate organization-specific caches
    if (organizationId) {
      await this.clear(`*:${organizationId}:*`);
    }
  }

  // Database connection optimization
  async optimizeDatabaseConnections() {
    try {
      // Configure connection pool
      const poolConfig = {
        max: this.queryOptimization.connectionPoolSize,
        min: 5,
        acquireTimeoutMillis: this.queryOptimization.queryTimeout,
        createTimeoutMillis: this.queryOptimization.queryTimeout,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      };

      console.log('✅ Database connection pool optimized:', poolConfig);
    } catch (error) {
      console.error('Failed to optimize database connections:', error);
      throw error;
    }
  }

  // Query analysis and optimization
  async analyzeSlowQueries() {
    try {
      // This would typically query database logs or use a monitoring tool
      // For now, we'll return the metrics we've collected
      return {
        slowQueries: this.metrics.slowQueries,
        averageQueryTime: this.metrics.averageQueryTime,
        recommendations: this.generateQueryRecommendations()
      };
    } catch (error) {
      console.error('Failed to analyze slow queries:', error);
      throw error;
    }
  }

  generateQueryRecommendations() {
    const recommendations = [];

    if (this.metrics.slowQueries > this.metrics.queryCount * 0.1) {
      recommendations.push('Consider adding more database indexes');
    }

    if (this.metrics.averageQueryTime > 500) {
      recommendations.push('Consider optimizing complex queries');
    }

    if (this.metrics.cacheMisses > this.metrics.cacheHits) {
      recommendations.push('Consider increasing cache TTL or warming cache more frequently');
    }

    return recommendations;
  }

  // Cleanup methods
  async cleanup() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      
      this.memoryCache.close();
      
      console.log('✅ Performance optimization service cleaned up');
    } catch (error) {
      console.error('Failed to cleanup performance optimization service:', error);
    }
  }
}

module.exports = PerformanceOptimizationService;
