// src/config/index.js - Environment Configuration
require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/orchestrall_dev',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'orchestrall_dev',
    username: process.env.DB_USERNAME || 'username',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },

  // AI Configuration
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    agentRuntime: process.env.AGENT_RUNTIME || 'openai',
    defaultModel: process.env.DEFAULT_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  },

  // Feature Flags Configuration
  featureFlags: {
    provider: process.env.FEATURE_FLAGS_PROVIDER || 'local',
    unleashUrl: process.env.UNLEASH_URL || 'http://unleash:4242/api',
    unleashApiToken: process.env.UNLEASH_API_TOKEN || '',
  },

  // Monitoring Configuration
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
  },

  // Deployment Configuration
  deployment: {
    type: process.env.DEPLOYMENT_TYPE || 'development',
    region: process.env.DEPLOYMENT_REGION || 'us-east-1',
    version: process.env.npm_package_version || '2.0.0',
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : ['image/*', 'text/*', 'application/json'],
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },

  // PatientFlow domain configuration
  patientflow: {
    defaultOrganizationId: process.env.PATIENTFLOW_ORGANIZATION_ID || '',
    session: {
      ttlSeconds: parseInt(process.env.PATIENTFLOW_SESSION_TTL || '900', 10),
    },
    messaging: {
      dedupeTtlSeconds: parseInt(process.env.PATIENTFLOW_DEDUPE_TTL || '86400', 10),
      retryWindowSeconds: parseInt(process.env.PATIENTFLOW_RETRY_WINDOW || '900', 10),
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      whatsappFromNumber: process.env.TWILIO_WHATSAPP_FROM_NUMBER || '',
      enableSignatureValidation: process.env.TWILIO_VALIDATE_SIGNATURE !== 'false',
      statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || '',
    },
  },
};

// Validation
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
];

if (config.server.nodeEnv === 'production') {
  requiredEnvVars.push('OPENAI_API_KEY');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.warn(`⚠️  Missing required environment variables: ${missingEnvVars.join(', ')}`);
  if (config.server.nodeEnv === 'production') {
    console.error('❌ Cannot start in production without required environment variables');
    process.exit(1);
  }
}

module.exports = config;
