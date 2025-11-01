// src/config.js - Complete Configuration for Orchestrall Platform
module.exports = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/orchestrall',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'orchestrall',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'orchestrall-super-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  },

  // AI Configuration
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },

  // S3 Configuration
  s3: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    sareeBucket: process.env.S3_SAREE_BUCKET || 'orchestrall-saree-demo',
    assetBaseUrl: process.env.ASSET_BASE_URL || 'https://d3.amazonaws.com/orchestrall-saree-demo',
    signedUrlTtl: parseInt(process.env.SIGNED_URL_TTL || '3600'), // 1 hour
  },

  // Demo Saree Configuration
  demo: {
    replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
    videoProvider: process.env.VIDEO_PROVIDER || 'luma', // 'luma', 'runway', 'pika'
    lumaApiKey: process.env.LUMA_API_KEY || '',
    runwayApiKey: process.env.RUNWAY_API_KEY || '',
    pikaApiKey: process.env.PIKA_API_KEY || '',
    depthProvider: process.env.DEPTH_PROVIDER || 'local', // 'local', 'cloud'
  },

  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf'],
  },

  // Monitoring Configuration
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  },

  // Deployment Configuration
  deployment: {
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.DEPLOYMENT_REGION || 'us-east-1',
  },

  // Feature Flags
  features: {
    enableAgentCaching: process.env.ENABLE_AGENT_CACHING !== 'false',
    enableWorkflowEngine: process.env.ENABLE_WORKFLOW_ENGINE !== 'false',
    enablePluginSystem: process.env.ENABLE_PLUGIN_SYSTEM !== 'false',
    enableAdvancedSecurity: process.env.ENABLE_ADVANCED_SECURITY !== 'false',
  },
};
