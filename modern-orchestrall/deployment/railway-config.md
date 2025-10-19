# Railway.app Deployment Configuration

## Environment-Specific Configurations

### Integration Environment
- **Purpose**: Development testing and feature validation
- **Database**: Shared PostgreSQL instance
- **Redis**: Shared Redis instance
- **Logging**: Debug level
- **Auto-deploy**: On every push to `develop` branch

### Staging Environment
- **Purpose**: Pre-production testing and client demos
- **Database**: Dedicated PostgreSQL instance
- **Redis**: Dedicated Redis instance
- **Logging**: Info level
- **Auto-deploy**: On every push to `staging` branch

### Production Environment
- **Purpose**: Live production deployment
- **Database**: High-availability PostgreSQL cluster
- **Redis**: High-availability Redis cluster
- **Logging**: Warn level
- **Auto-deploy**: On every push to `main` branch

## Required Environment Variables

### Database Configuration
```bash
DATABASE_URL=postgresql://username:password@host:port/database
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=30000
```

### Redis Configuration
```bash
REDIS_URL=redis://username:password@host:port
REDIS_MAX_CONNECTIONS=50
REDIS_CONNECTION_TIMEOUT=10000
```

### Application Configuration
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
```

### Security Configuration
```bash
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
HELMET_CSP_ENABLED=true
```

### Monitoring Configuration
```bash
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
METRICS_COLLECTION_ENABLED=true
```

## Deployment Commands

### Integration Deployment
```bash
railway login
railway link --environment integration
railway up --environment integration
```

### Staging Deployment
```bash
railway login
railway link --environment staging
railway up --environment staging
```

### Production Deployment
```bash
railway login
railway link --environment production
railway up --environment production
```

## Health Check Endpoints

- **Basic Health**: `/health`
- **Database Health**: `/health/database`
- **Redis Health**: `/health/redis`
- **Full System**: `/health/full`

## Monitoring and Alerts

- **Uptime Monitoring**: Railway built-in monitoring
- **Error Tracking**: Railway logs and metrics
- **Performance Monitoring**: Railway performance dashboard
- **Custom Metrics**: Prometheus metrics endpoint

## Backup Strategy

- **Database Backups**: Automatic daily backups (Railway managed)
- **Configuration Backups**: Git repository
- **Log Retention**: 30 days (Railway managed)
- **Disaster Recovery**: Railway automatic failover
