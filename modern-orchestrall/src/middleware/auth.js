const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class AuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  }

  // Verify JWT token
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        
        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: { organization: true }
        });

        if (!user || user.status !== 'active') {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
          });
        }

        // Add user info to request
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          organization: user.organization,
          roles: decoded.roles || []
        };

        next();
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        } else if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        } else {
          throw jwtError;
        }
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  }

  // Verify API key
  async verifyApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required',
          code: 'MISSING_API_KEY'
        });
      }

      const keyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { organization: true, user: true }
      });

      if (!keyRecord || keyRecord.revoked || 
          (keyRecord.expiresAt && keyRecord.expiresAt < new Date())) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired API key',
          code: 'INVALID_API_KEY'
        });
      }

      // Check rate limit
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      if (keyRecord.lastUsedAt && keyRecord.lastUsedAt > oneHourAgo) {
        if (keyRecord.usageCount >= keyRecord.rateLimit) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED'
          });
        }
      }

      // Update usage tracking
      await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: {
          lastUsedAt: now,
          usageCount: keyRecord.usageCount + 1
        }
      });

      // Add API key info to request
      req.apiKey = {
        id: keyRecord.id,
        name: keyRecord.name,
        permissions: keyRecord.permissions,
        organizationId: keyRecord.organizationId,
        organization: keyRecord.organization,
        userId: keyRecord.userId,
        user: keyRecord.user
      };

      next();
    } catch (error) {
      console.error('API key middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'API key verification failed',
        code: 'API_KEY_ERROR'
      });
    }
  }

  // Role-based access control
  requireRole(requiredRoles) {
    return (req, res, next) => {
      try {
        const userRoles = req.user?.roles || [];
        const apiKeyPermissions = req.apiKey?.permissions || [];
        
        // Check if user has required role
        const hasUserRole = requiredRoles.some(role => userRoles.includes(role));
        
        // Check if API key has required permission
        const hasApiPermission = requiredRoles.some(role => 
          apiKeyPermissions.includes(role) || apiKeyPermissions.includes('*')
        );

        if (!hasUserRole && !hasApiPermission) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: requiredRoles
          });
        }

        next();
      } catch (error) {
        console.error('RBAC middleware error:', error);
        return res.status(500).json({
          success: false,
          error: 'Authorization check failed',
          code: 'RBAC_ERROR'
        });
      }
    };
  }

  // Organization access control
  requireOrganizationAccess(req, res, next) {
    try {
      const userOrgId = req.user?.organizationId;
      const apiKeyOrgId = req.apiKey?.organizationId;
      const requestedOrgId = req.params.organizationId || req.body.organizationId;

      if (!userOrgId && !apiKeyOrgId) {
        return res.status(401).json({
          success: false,
          error: 'Organization access required',
          code: 'MISSING_ORG_ACCESS'
        });
      }

      const hasAccess = (userOrgId && userOrgId === requestedOrgId) ||
                       (apiKeyOrgId && apiKeyOrgId === requestedOrgId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to organization',
          code: 'ORG_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Organization access middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Organization access check failed',
        code: 'ORG_ACCESS_ERROR'
      });
    }
  }

  // Rate limiting middleware
  createRateLimit(maxRequests = 100, windowMs = 60 * 60 * 1000) {
    const requests = new Map();

    return (req, res, next) => {
      try {
        const identifier = req.user?.id || req.apiKey?.id || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        for (const [key, data] of requests.entries()) {
          if (data.windowStart < windowStart) {
            requests.delete(key);
          }
        }

        // Get or create request data
        let requestData = requests.get(identifier);
        if (!requestData) {
          requestData = {
            count: 0,
            windowStart: now
          };
          requests.set(identifier, requestData);
        }

        // Reset window if needed
        if (requestData.windowStart < windowStart) {
          requestData.count = 0;
          requestData.windowStart = now;
        }

        // Check rate limit
        if (requestData.count >= maxRequests) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((requestData.windowStart + windowMs - now) / 1000)
          });
        }

        // Increment counter
        requestData.count++;

        // Add rate limit info to response headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': maxRequests - requestData.count,
          'X-RateLimit-Reset': new Date(requestData.windowStart + windowMs).toISOString()
        });

        next();
      } catch (error) {
        console.error('Rate limit middleware error:', error);
        next(); // Continue on error to avoid blocking requests
      }
    };
  }

  // Audit logging middleware
  auditLog(action, resource) {
    return async (req, res, next) => {
      try {
        const originalSend = res.send;
        
        res.send = function(data) {
          // Log after response is sent
          setImmediate(async () => {
            try {
              await prisma.auditLog.create({
                data: {
                  organizationId: req.user?.organizationId || req.apiKey?.organizationId,
                  userId: req.user?.id,
                  action,
                  resource,
                  resourceId: req.params.id || req.body.id,
                  details: {
                    method: req.method,
                    url: req.url,
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip || req.connection.remoteAddress,
                    statusCode: res.statusCode,
                    responseSize: data ? data.length : 0
                  },
                  ipAddress: req.ip || req.connection.remoteAddress,
                  userAgent: req.headers['user-agent'],
                  sessionId: req.headers['x-session-id']
                }
              });
            } catch (logError) {
              console.error('Audit log error:', logError);
            }
          });
          
          originalSend.call(this, data);
        };

        next();
      } catch (error) {
        console.error('Audit log middleware error:', error);
        next(); // Continue on error
      }
    };
  }
}

module.exports = AuthMiddleware;
