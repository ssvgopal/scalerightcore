import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  Logger,
  Database,
  ServiceError,
  ValidationError,
  NotFoundError,
  ApiResponse,
  ServiceHealth,
  User
} from '@orchestrall/shared';

const logger = new Logger('auth-service');

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Initialize Prisma
const prisma = new PrismaClient();

// Register JWT plugin
fastify.register(import('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
});

// Request/Response schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  organizationName: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Types
interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  organizationName: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Utility functions
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function generateTokens(user: User) {
  const accessToken = fastify.jwt.sign({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    roles: user.roles || ['user'],
    permissions: user.permissions || ['read'],
  });

  const refreshToken = fastify.jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Routes
fastify.post('/login', {
  schema: {
    body: loginSchema,
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.object({
          accessToken: z.string(),
          refreshToken: z.string(),
          user: z.any(),
        }),
      }),
    },
  },
}, async (request, reply) => {
  try {
    const { email, password } = request.body as LoginRequest;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      throw new ValidationError('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password || '');
    if (!isValidPassword) {
      throw new ValidationError('Invalid credentials');
    }

    // Generate tokens
    const tokens = await generateTokens(user);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: {
        ...tokens,
        user,
      },
    };

    logger.info('User logged in', { userId: user.id, email: user.email });
    return response;
  } catch (error) {
    logger.error('Login error', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ServiceError('Login failed', 'LOGIN_ERROR');
  }
});

fastify.post('/register', {
  schema: {
    body: registerSchema,
    response: {
      201: z.object({
        success: z.boolean(),
        data: z.object({
          accessToken: z.string(),
          refreshToken: z.string(),
          user: z.any(),
        }),
      }),
    },
  },
}, async (request, reply) => {
  try {
    const { email, password, name, organizationName } = request.body as RegisterRequest;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError('User already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create organization first
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
        tier: 'starter',
      },
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        organizationId: organization.id,
        roles: ['admin'],
        permissions: ['read', 'write', 'admin'],
      },
      include: { organization: true },
    });

    // Generate tokens
    const tokens = await generateTokens(user);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: {
        ...tokens,
        user,
      },
    };

    logger.info('User registered', {
      userId: user.id,
      email: user.email,
      organizationId: organization.id
    });

    return reply.code(201).send(response);
  } catch (error) {
    logger.error('Registration error', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ServiceError('Registration failed', 'REGISTRATION_ERROR');
  }
});

fastify.post('/refresh', {
  schema: {
    body: refreshTokenSchema,
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.object({
          accessToken: z.string(),
          refreshToken: z.string(),
        }),
      }),
    },
  },
}, async (request, reply) => {
  try {
    const { refreshToken } = request.body;

    // Verify refresh token
    const decoded = fastify.jwt.verify(refreshToken);

    if (decoded.type !== 'refresh') {
      throw new ValidationError('Invalid refresh token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new tokens
    const tokens = await generateTokens(user);

    const response: ApiResponse<{ accessToken: string; refreshToken: string }> = {
      success: true,
      data: tokens,
    };

    return response;
  } catch (error) {
    logger.error('Token refresh error', error);
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new ServiceError('Token refresh failed', 'TOKEN_REFRESH_ERROR');
  }
});

fastify.get('/me', {
  schema: {
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: { organization: true },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const response: ApiResponse<User> = {
      success: true,
      data: user,
    };

    return response;
  } catch (error) {
    logger.error('Get user error', error);
    throw error;
  }
});

// Health check
fastify.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    const health: ServiceHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: { status: 'up' },
      },
    };

    return health;
  } catch (error) {
    logger.error('Health check failed', error);

    const health: ServiceHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: { status: 'down' },
      },
    };

    return reply.code(503).send(health);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  await prisma.$disconnect();
  await fastify.close();

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT || '3001'),
      host: process.env.HOST || '0.0.0.0',
    });

    logger.info(`Auth service listening on port ${process.env.PORT || 3001}`);
  } catch (err) {
    logger.error('Failed to start auth service', err);
    process.exit(1);
  }
};

start();
