import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

// Configuration schema
const configSchema = z.object({
  // Server configuration
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),

  // Database configuration
  database: z.object({
    url: z.string(),
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('orchestrall'),
    username: z.string(),
    password: z.string(),
    ssl: z.coerce.boolean().default(false),
    maxConnections: z.coerce.number().default(20),
  }),

  // Redis configuration
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),

  // Security configuration
  jwt: z.object({
    secret: z.string(),
    expiresIn: z.string().default('24h'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  // CORS configuration
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string())]).default('*'),
    credentials: z.coerce.boolean().default(true),
  }),

  // Feature flags
  featureFlags: z.object({
    provider: z.enum(['unleash', 'flagsmith', 'local']).default('local'),
    url: z.string().optional(),
    apiKey: z.string().optional(),
    refreshInterval: z.coerce.number().default(30000),
  }),

  // Agent runtime configuration
  agents: z.object({
    runtime: z.enum(['langgraph', 'autogen', 'crewai', 'custom']).default('custom'),
    memory: z.object({
      provider: z.enum(['redis', 'vector', 'local']).default('redis'),
      vectorDb: z.object({
        provider: z.enum(['pinecone', 'weaviate', 'chroma']).default('pinecone'),
        apiKey: z.string().optional(),
        indexName: z.string().default('orchestrall-agents'),
      }),
    }),
    tools: z.object({
      enabled: z.array(z.string()).default([]),
      timeout: z.coerce.number().default(30000),
    }),
  }),

  // Deployment configuration
  deployment: z.object({
    type: z.enum(['self-hosted', 'hybrid', 'cloud-native']).default('self-hosted'),
    region: z.string().default('us-east-1'),
    environment: z.string().default('development'),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    file: z.object({
      enabled: z.coerce.boolean().default(true),
      path: z.string().default('./logs'),
      maxSize: z.string().default('10m'),
      maxFiles: z.coerce.number().default(5),
    }),
  }),

  // Version
  version: z.string().default('2.0.0'),
});

// Parse and validate configuration
function createConfig(): z.infer<typeof configSchema> {
  const rawConfig = {
    // Server
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,

    // Database
    database: {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL,
      maxConnections: process.env.DB_MAX_CONNECTIONS,
    },

    // Redis
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },

    // Security
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    },

    // CORS
    cors: {
      origin: process.env.CORS_ORIGIN || process.env.NODE_ENV === 'production' ? false : true,
      credentials: process.env.CORS_CREDENTIALS,
    },

    // Feature flags
    featureFlags: {
      provider: process.env.FEATURE_FLAGS_PROVIDER,
      url: process.env.FEATURE_FLAGS_URL,
      apiKey: process.env.FEATURE_FLAGS_API_KEY,
      refreshInterval: process.env.FEATURE_FLAGS_REFRESH_INTERVAL,
    },

    // Agents
    agents: {
      runtime: process.env.AGENT_RUNTIME,
      memory: {
        provider: process.env.AGENT_MEMORY_PROVIDER,
        vectorDb: {
          provider: process.env.VECTOR_DB_PROVIDER,
          apiKey: process.env.VECTOR_DB_API_KEY,
          indexName: process.env.VECTOR_DB_INDEX_NAME,
        },
      },
      tools: {
        enabled: process.env.AGENT_TOOLS?.split(',') || [],
        timeout: process.env.AGENT_TOOLS_TIMEOUT,
      },
    },

    // Deployment
    deployment: {
      type: process.env.DEPLOYMENT_TYPE,
      region: process.env.DEPLOYMENT_REGION,
      environment: process.env.DEPLOYMENT_ENVIRONMENT,
    },

    // Logging
    logging: {
      level: process.env.LOG_LEVEL,
      format: process.env.LOG_FORMAT,
      file: {
        enabled: process.env.LOG_FILE_ENABLED,
        path: process.env.LOG_FILE_PATH,
        maxSize: process.env.LOG_FILE_MAX_SIZE,
        maxFiles: process.env.LOG_FILE_MAX_FILES,
      },
    },

    // Version
    version: process.env.npm_package_version || '2.0.0',
  };

  return configSchema.parse(rawConfig);
}

// Export validated configuration
export const config = createConfig();

// Export type for use in other modules
export type Config = z.infer<typeof configSchema>;
