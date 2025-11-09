// src/auth/index.js - Authentication System
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('../database');

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

class AuthService {
  constructor() {
    this.prisma = null;
  }

  async initialize() {
    this.prisma = database.client;
  }

  // Hash password
  async hashPassword(password) {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  // Verify password
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT tokens
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles || ['user'],
      permissions: user.permissions || ['read'],
    };

    const accessToken = jwt.sign(payload, config.security.jwtSecret, {
      expiresIn: config.security.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, config.security.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Validate input
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      if (!user) {
        logger.securityEvent('login_attempt', { email, success: false, reason: 'user_not_found' });
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password || '');
      if (!isValidPassword) {
        logger.securityEvent('login_attempt', { email, success: false, reason: 'invalid_password' });
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      logger.securityEvent('login_success', { userId: user.id, email: user.email });

      return {
        success: true,
        data: {
          ...tokens,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
            organization: user.organization,
            status: user.status,
            roles: user.roles || ['user'],
            permissions: user.permissions || ['read'],
          },
        },
      };
    } catch (error) {
      logger.error('Login error', { email, error: error.message });
      throw error;
    }
  }

  // Register user
  async register(email, password, name, organizationName) {
    try {
      // Validate input
      const validation = registerSchema.safeParse({ email, password, name, organizationName });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create organization first
      const organization = await this.prisma.organization.create({
        data: {
          name: organizationName,
          slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
          tier: 'starter',
          status: 'active',
        },
      });

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPassword,
          organizationId: organization.id,
          status: 'active',
        },
        include: { organization: true },
      });

      // Generate tokens
      const tokens = this.generateTokens(user);

      logger.securityEvent('user_registration', { 
        userId: user.id, 
        email: user.email, 
        organizationId: organization.id 
      });

      return {
        success: true,
        data: {
          ...tokens,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
            organization: user.organization,
            status: user.status,
            roles: ['admin'],
            permissions: ['read', 'write', 'admin'],
          },
        },
      };
    } catch (error) {
      logger.error('Registration error', { email, error: error.message });
      throw error;
    }
  }

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      // Validate input
      const validation = refreshTokenSchema.safeParse({ refreshToken });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Verify refresh token
      const decoded = this.verifyToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id },
        include: { organization: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      logger.securityEvent('token_refresh', { userId: user.id });

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      logger.error('Token refresh error', { error: error.message });
      throw error;
    }
  }

  // Get current user
  async getCurrentUser(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          organizationId: user.organizationId,
          organization: user.organization,
          status: user.status,
          roles: user.roles || ['user'],
          permissions: user.permissions || ['read'],
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      logger.error('Get current user error', { userId, error: error.message });
      throw error;
    }
  }

  // Middleware for JWT authentication
  authenticateToken() {
    return async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return reply.code(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Access token required',
            },
          });
        }

        const decoded = this.verifyToken(token);
        
        // Get user from database
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.id },
          include: { organization: true },
        });

        if (!user) {
          return reply.code(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User not found',
            },
          });
        }

        // Add user to request
        request.user = {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          roles: user.roles || ['user'],
          permissions: user.permissions || ['read'],
        };

        return;
      } catch (error) {
        logger.securityEvent('auth_failure', { error: error.message });
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token',
          },
        });
      }
    };
  }

  // Check user permissions
  hasPermission(userPermissions, requiredPermission) {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
  }

  // Check user roles
  hasRole(userRoles, requiredRole) {
    return userRoles.includes(requiredRole) || userRoles.includes('admin');
  }
}

// Create singleton instance
const authService = new AuthService();

module.exports = authService;
