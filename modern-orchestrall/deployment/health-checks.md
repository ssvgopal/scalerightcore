# Railway.app Health Check Implementation

## Enhanced Health Check Endpoints

### Basic Health Check (`/health`)
```javascript
app.get('/health', async (request, reply) => {
  try {
    // Test database connection
    await database.client.$queryRaw`SELECT 1`;
    
    // Test Redis connection
    await cacheService.ping();
    
    reply.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    reply.code(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
```

### Database Health Check (`/health/database`)
```javascript
app.get('/health/database', async (request, reply) => {
  try {
    const start = Date.now();
    await database.client.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    reply.send({
      status: 'healthy',
      service: 'database',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    reply.code(503).send({
      status: 'unhealthy',
      service: 'database',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Redis Health Check (`/health/redis`)
```javascript
app.get('/health/redis', async (request, reply) => {
  try {
    const start = Date.now();
    await cacheService.ping();
    const responseTime = Date.now() - start;
    
    reply.send({
      status: 'healthy',
      service: 'redis',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Redis health check failed:', error);
    reply.code(503).send({
      status: 'unhealthy',
      service: 'redis',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Full System Health Check (`/health/full`)
```javascript
app.get('/health/full', async (request, reply) => {
  const healthChecks = {
    database: { status: 'unknown', responseTime: null, error: null },
    redis: { status: 'unknown', responseTime: null, error: null },
    plugins: { status: 'unknown', count: 0, errors: [] },
    memory: { status: 'unknown', usage: null, limit: null },
    disk: { status: 'unknown', usage: null, limit: null }
  };
  
  let overallStatus = 'healthy';
  
  try {
    // Database check
    const dbStart = Date.now();
    await database.client.$queryRaw`SELECT 1`;
    healthChecks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    healthChecks.database = {
      status: 'unhealthy',
      error: error.message
    };
    overallStatus = 'unhealthy';
  }
  
  try {
    // Redis check
    const redisStart = Date.now();
    await cacheService.ping();
    healthChecks.redis = {
      status: 'healthy',
      responseTime: Date.now() - redisStart
    };
  } catch (error) {
    healthChecks.redis = {
      status: 'unhealthy',
      error: error.message
    };
    overallStatus = 'unhealthy';
  }
  
  try {
    // Plugin health check
    const pluginHealth = await pluginEngine.runHealthChecks();
    healthChecks.plugins = {
      status: 'healthy',
      count: pluginHealth.size,
      errors: Array.from(pluginHealth.values()).filter(p => p.error)
    };
  } catch (error) {
    healthChecks.plugins = {
      status: 'unhealthy',
      error: error.message
    };
    overallStatus = 'unhealthy';
  }
  
  // Memory usage check
  const memUsage = process.memoryUsage();
  healthChecks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
    usage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    limit: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
  };
  
  if (healthChecks.memory.status === 'warning') {
    overallStatus = 'warning';
  }
  
  reply.send({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: healthChecks
  });
});
```

## Railway.app Health Check Configuration

### railway.json Health Check Settings
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Environment-Specific Health Check Intervals

#### Integration Environment
- **Health Check Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retry Count**: 3
- **Restart Policy**: On failure

#### Staging Environment
- **Health Check Interval**: 30 seconds
- **Timeout**: 15 seconds
- **Retry Count**: 3
- **Restart Policy**: On failure

#### Production Environment
- **Health Check Interval**: 30 seconds
- **Timeout**: 30 seconds
- **Retry Count**: 5
- **Restart Policy**: On failure

## Monitoring and Alerting

### Railway Built-in Monitoring
- **Uptime Monitoring**: Automatic uptime checks
- **Error Tracking**: Automatic error detection and alerting
- **Performance Monitoring**: Response time and throughput metrics
- **Resource Monitoring**: CPU, memory, and disk usage

### Custom Health Check Monitoring
```javascript
// Health check middleware
app.addHook('onRequest', async (request, reply) => {
  // Skip health checks for health endpoints
  if (request.url.startsWith('/health')) {
    return;
  }
  
  // Check if system is healthy before processing requests
  try {
    await database.client.$queryRaw`SELECT 1`;
  } catch (error) {
    reply.code(503).send({
      status: 'unhealthy',
      error: 'Database unavailable'
    });
    return;
  }
});
```

### Health Check Metrics
```javascript
// Prometheus metrics for health checks
const prometheus = require('prom-client');

const healthCheckCounter = new prometheus.Counter({
  name: 'health_check_total',
  help: 'Total number of health checks',
  labelNames: ['endpoint', 'status']
});

const healthCheckDuration = new prometheus.Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks in seconds',
  labelNames: ['endpoint']
});

// Add metrics to health check endpoints
app.get('/health', async (request, reply) => {
  const start = Date.now();
  
  try {
    // ... health check logic ...
    
    healthCheckCounter.inc({ endpoint: 'basic', status: 'success' });
    healthCheckDuration.observe({ endpoint: 'basic' }, (Date.now() - start) / 1000);
    
    reply.send({ status: 'healthy' });
  } catch (error) {
    healthCheckCounter.inc({ endpoint: 'basic', status: 'failure' });
    healthCheckDuration.observe({ endpoint: 'basic' }, (Date.now() - start) / 1000);
    
    reply.code(503).send({ status: 'unhealthy', error: error.message });
  }
});
```

## Health Check Best Practices

### 1. Fast Response Times
- Keep health checks under 1 second
- Use simple queries (SELECT 1)
- Avoid complex operations

### 2. Comprehensive Coverage
- Check all critical dependencies
- Include database, cache, and external services
- Monitor resource usage

### 3. Proper Error Handling
- Return appropriate HTTP status codes
- Include error details for debugging
- Log health check failures

### 4. Monitoring Integration
- Use Prometheus metrics
- Set up alerts for failures
- Track response times and success rates

### 5. Environment-Specific Configuration
- Different timeouts for different environments
- Appropriate retry counts
- Proper restart policies
