import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../core/config';
import { logger } from '../utils/logger';
import { AuthenticationError, AuthorizationError } from '../middleware/error-handler';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      organizationId: string;
      roles: string[];
      permissions: string[];
    };
    organization?: {
      id: string;
      name: string;
      tier: string;
      features: string[];
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      organizationId: string;
      roles: string[];
      permissions: string[];
      iat?: number;
      exp?: number;
    };
  }
}

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // JWT verification decorator
  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  });

  // Organization context decorator
  fastify.decorate('getOrganization', async (request: FastifyRequest) => {
    if (!request.user?.organizationId) {
      throw new AuthenticationError('No organization context');
    }

    // In a real implementation, this would fetch from database
    // For now, return mock organization data
    request.organization = {
      id: request.user.organizationId,
      name: 'Default Organization',
      tier: 'enterprise',
      features: ['crm', 'analytics', 'agents'],
    };
  });

  // Authorization decorator
  fastify.decorate('authorize', async (request: FastifyRequest, permissions: string[]) => {
    if (!request.user?.permissions) {
      throw new AuthorizationError('No permissions found');
    }

    const hasPermission = permissions.some(permission =>
      request.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new AuthorizationError(`Missing required permission: ${permissions.join(', ')}`);
    }
  });

  // Login endpoint
  fastify.post('/auth/login', {
    schema: {
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string(),
              organizationId: z.string(),
              roles: z.array(z.string()),
              permissions: z.array(z.string()),
            }),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    // In a real implementation, this would validate against database
    // For now, return mock successful login
    if (email === 'admin@example.com' && password === 'password123') {
      const payload = {
        id: 'user_123',
        email,
        organizationId: 'org_456',
        roles: ['admin', 'user'],
        permissions: ['read', 'write', 'admin'],
      };

      const accessToken = fastify.jwt.sign(payload);
      const refreshToken = fastify.jwt.sign(payload, {
        expiresIn: config.jwt.refreshExpiresIn,
      });

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: payload,
        },
      };
    }

    throw new AuthenticationError('Invalid credentials');
  });

  // Refresh token endpoint
  fastify.post('/auth/refresh', {
    schema: {
      body: z.object({
        refreshToken: z.string(),
      }),
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
    const { refreshToken } = request.body;

    try {
      const decoded = fastify.jwt.verify(refreshToken);

      const newPayload = {
        id: decoded.id,
        email: decoded.email,
        organizationId: decoded.organizationId,
        roles: decoded.roles,
        permissions: decoded.permissions,
      };

      const accessToken = fastify.jwt.sign(newPayload);
      const newRefreshToken = fastify.jwt.sign(newPayload, {
        expiresIn: config.jwt.refreshExpiresIn,
      });

      return {
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      };
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  });

  // Logout endpoint
  fastify.post('/auth/logout', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    // In a real implementation, you might invalidate tokens in Redis/database
    return {
      success: true,
      message: 'Logged out successfully',
    };
  });

  // Get current user endpoint
  fastify.get('/auth/me', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
            organizationId: z.string(),
            roles: z.array(z.string()),
            permissions: z.array(z.string()),
            organization: z.object({
              id: z.string(),
              name: z.string(),
              tier: z.string(),
              features: z.array(z.string()),
            }),
          }),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    await fastify.getOrganization(request);

    return {
      success: true,
      data: {
        ...request.user!,
        organization: request.organization!,
      },
    };
  });

  logger.info('Authentication plugin registered');
});
