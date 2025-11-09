# Environment Variables for Railway.app Deployment

## Integration Environment (.env.integration)
```bash
# Application Configuration
NODE_ENV=integration
PORT=3000
LOG_LEVEL=debug

# Database Configuration
DATABASE_URL=${DATABASE_URL}
DATABASE_POOL_SIZE=5
DATABASE_CONNECTION_TIMEOUT=30000

# Redis Configuration
REDIS_URL=${REDIS_URL}
REDIS_MAX_CONNECTIONS=10
REDIS_CONNECTION_TIMEOUT=10000

# Authentication
JWT_SECRET=integration-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Security
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
HELMET_CSP_ENABLED=false

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
METRICS_COLLECTION_ENABLED=true

# Admin Configuration
ADMIN_EMAIL=admin@orchestrall.com
ADMIN_PASSWORD=admin123

# Plugin Configuration
PLUGIN_AUTO_LOAD=true
PLUGIN_HEALTH_CHECK_INTERVAL=60000
```

## Staging Environment (.env.staging)
```bash
# Application Configuration
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=${DATABASE_URL}
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=30000

# Redis Configuration
REDIS_URL=${REDIS_URL}
REDIS_MAX_CONNECTIONS=20
REDIS_CONNECTION_TIMEOUT=10000

# Authentication
JWT_SECRET=staging-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Security
CORS_ORIGIN=https://staging.orchestrall.com
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW=900000
HELMET_CSP_ENABLED=true

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
METRICS_COLLECTION_ENABLED=true

# Admin Configuration
ADMIN_EMAIL=admin@orchestrall.com
ADMIN_PASSWORD=staging-admin-password

# Plugin Configuration
PLUGIN_AUTO_LOAD=true
PLUGIN_HEALTH_CHECK_INTERVAL=60000
```

## Production Environment (.env.production)
```bash
# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Database Configuration
DATABASE_URL=${DATABASE_URL}
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=30000

# Redis Configuration
REDIS_URL=${REDIS_URL}
REDIS_MAX_CONNECTIONS=50
REDIS_CONNECTION_TIMEOUT=10000

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# Security
CORS_ORIGIN=https://orchestrall.com
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
HELMET_CSP_ENABLED=true

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
METRICS_COLLECTION_ENABLED=true

# Admin Configuration
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Plugin Configuration
PLUGIN_AUTO_LOAD=true
PLUGIN_HEALTH_CHECK_INTERVAL=60000

# External Services
OPENAI_API_KEY=${OPENAI_API_KEY}
SARVAM_API_KEY=${SARVAM_API_KEY}
SHOPIFY_API_KEY=${SHOPIFY_API_KEY}
SHOPIFY_API_SECRET=${SHOPIFY_API_SECRET}
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
ZOHO_CLIENT_ID=${ZOHO_CLIENT_ID}
ZOHO_CLIENT_SECRET=${ZOHO_CLIENT_SECRET}
```

## Railway.app Environment Variable Setup

### Integration Environment Variables
```bash
# Set in Railway dashboard for integration environment
NODE_ENV=integration
LOG_LEVEL=debug
DATABASE_POOL_SIZE=5
REDIS_MAX_CONNECTIONS=10
JWT_SECRET=integration-jwt-secret-key-change-in-production
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
HELMET_CSP_ENABLED=false
ADMIN_EMAIL=admin@orchestrall.com
ADMIN_PASSWORD=admin123
```

### Staging Environment Variables
```bash
# Set in Railway dashboard for staging environment
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_POOL_SIZE=10
REDIS_MAX_CONNECTIONS=20
JWT_SECRET=staging-jwt-secret-key-change-in-production
CORS_ORIGIN=https://staging.orchestrall.com
RATE_LIMIT_MAX=500
HELMET_CSP_ENABLED=true
ADMIN_EMAIL=admin@orchestrall.com
ADMIN_PASSWORD=staging-admin-password
```

### Production Environment Variables
```bash
# Set in Railway dashboard for production environment
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_POOL_SIZE=20
REDIS_MAX_CONNECTIONS=50
JWT_SECRET=<generate-strong-secret>
CORS_ORIGIN=https://orchestrall.com
RATE_LIMIT_MAX=1000
HELMET_CSP_ENABLED=true
ADMIN_EMAIL=<production-admin-email>
ADMIN_PASSWORD=<generate-strong-password>
OPENAI_API_KEY=<your-openai-key>
SARVAM_API_KEY=<your-sarvam-key>
SHOPIFY_API_KEY=<your-shopify-key>
SHOPIFY_API_SECRET=<your-shopify-secret>
RAZORPAY_KEY_ID=<your-razorpay-key>
RAZORPAY_KEY_SECRET=<your-razorpay-secret>
ZOHO_CLIENT_ID=<your-zoho-client-id>
ZOHO_CLIENT_SECRET=<your-zoho-client-secret>
```

## Security Notes

1. **JWT Secrets**: Must be unique and strong for each environment
2. **Admin Passwords**: Use strong passwords, different for each environment
3. **API Keys**: Store securely in Railway dashboard, never commit to code
4. **CORS Origins**: Restrict to specific domains in production
5. **Rate Limits**: Adjust based on expected traffic per environment
6. **CSP Headers**: Enable in staging and production for security
