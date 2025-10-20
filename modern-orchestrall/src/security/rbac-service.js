const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class RBACService {
  constructor(prisma) {
    this.prisma = prisma;
    this.rateLimiters = new Map();
    this.apiKeys = new Map();
  }

  async createRole(roleData) {
    try {
      const {
        name,
        description,
        permissions = [],
        organizationId,
        isSystemRole = false
      } = roleData;

      const role = await this.prisma.role.create({
        data: {
          name,
          description,
          permissions,
          organizationId,
          isSystemRole,
          createdAt: new Date()
        }
      });

      return {
        success: true,
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystemRole: role.isSystemRole
        }
      };
    } catch (error) {
      console.error('Role creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async assignRoleToUser(userId, roleId, organizationId) {
    try {
      const userRole = await this.prisma.userRole.create({
        data: {
          userId,
          roleId,
          organizationId,
          assignedAt: new Date(),
          assignedBy: 'system' // In production, this would be the current user
        }
      });

      return {
        success: true,
        userRole: {
          id: userRole.id,
          userId: userRole.userId,
          roleId: userRole.roleId,
          organizationId: userRole.organizationId,
          assignedAt: userRole.assignedAt
        }
      };
    } catch (error) {
      console.error('Role assignment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserRoles(userId, organizationId) {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          userId,
          organizationId
        },
        include: {
          role: true
        }
      });

      const roles = userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        permissions: ur.role.permissions,
        assignedAt: ur.assignedAt
      }));

      return {
        success: true,
        roles
      };
    } catch (error) {
      console.error('User roles fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkPermission(userId, organizationId, permission, resource = null) {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          userId,
          organizationId
        },
        include: {
          role: true
        }
      });

      for (const userRole of userRoles) {
        const role = userRole.role;
        
        // Check if role has the permission
        if (role.permissions.includes(permission)) {
          return {
            success: true,
            allowed: true,
            role: role.name,
            permission
          };
        }

        // Check for wildcard permissions
        if (role.permissions.includes('*') || role.permissions.includes(`${permission.split('.')[0]}.*`)) {
          return {
            success: true,
            allowed: true,
            role: role.name,
            permission
          };
        }
      }

      return {
        success: true,
        allowed: false,
        permission
      };
    } catch (error) {
      console.error('Permission check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createAPIKey(apiKeyData) {
    try {
      const {
        name,
        description,
        organizationId,
        permissions = [],
        expiresAt = null,
        rateLimit = null
      } = apiKeyData;

      // Generate API key
      const keyValue = crypto.randomBytes(32).toString('hex');
      const hashedKey = await bcrypt.hash(keyValue, 10);

      const apiKey = await this.prisma.apiKey.create({
        data: {
          name,
          description,
          organizationId,
          keyHash: hashedKey,
          permissions,
          expiresAt,
          rateLimit,
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: null
        }
      });

      // Store in memory for quick access
      this.apiKeys.set(apiKey.id, {
        id: apiKey.id,
        name: apiKey.name,
        organizationId: apiKey.organizationId,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive
      });

      return {
        success: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: keyValue, // Only returned once
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt,
          rateLimit: apiKey.rateLimit
        }
      };
    } catch (error) {
      console.error('API key creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateAPIKey(keyValue) {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: {
          isActive: true
        }
      });

      for (const apiKey of apiKeys) {
        const isValid = await bcrypt.compare(keyValue, apiKey.keyHash);
        if (isValid) {
          // Check if key is expired
          if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
            return {
              success: false,
              error: 'API key expired'
            };
          }

          // Update last used timestamp
          await this.prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
          });

          return {
            success: true,
            apiKey: {
              id: apiKey.id,
              name: apiKey.name,
              organizationId: apiKey.organizationId,
              permissions: apiKey.permissions,
              rateLimit: apiKey.rateLimit,
              expiresAt: apiKey.expiresAt
            }
          };
        }
      }

      return {
        success: false,
        error: 'Invalid API key'
      };
    } catch (error) {
      console.error('API key validation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkRateLimit(apiKeyId, endpoint) {
    try {
      const apiKey = this.apiKeys.get(apiKeyId);
      if (!apiKey || !apiKey.rateLimit) {
        return {
          success: true,
          allowed: true
        };
      }

      const rateLimitKey = `${apiKeyId}:${endpoint}`;
      const now = Date.now();
      const windowMs = apiKey.rateLimit.windowMs || 60000; // 1 minute default
      const maxRequests = apiKey.rateLimit.maxRequests || 100;

      if (!this.rateLimiters.has(rateLimitKey)) {
        this.rateLimiters.set(rateLimitKey, {
          requests: [],
          windowStart: now
        });
      }

      const limiter = this.rateLimiters.get(rateLimitKey);
      
      // Clean old requests outside the window
      limiter.requests = limiter.requests.filter(
        timestamp => now - timestamp < windowMs
      );

      // Check if limit exceeded
      if (limiter.requests.length >= maxRequests) {
        return {
          success: true,
          allowed: false,
          limit: maxRequests,
          remaining: 0,
          resetTime: limiter.requests[0] + windowMs
        };
      }

      // Add current request
      limiter.requests.push(now);

      return {
        success: true,
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - limiter.requests.length,
        resetTime: now + windowMs
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async revokeAPIKey(apiKeyId) {
    try {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          isActive: false,
          revokedAt: new Date()
        }
      });

      // Remove from memory
      this.apiKeys.delete(apiKeyId);

      return {
        success: true,
        message: 'API key revoked successfully'
      };
    } catch (error) {
      console.error('API key revocation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAPIKeys(organizationId) {
    try {
      const apiKeys = await this.prisma.apiKey.findMany({
        where: {
          organizationId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          description: true,
          permissions: true,
          expiresAt: true,
          rateLimit: true,
          createdAt: true,
          lastUsedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        apiKeys
      };
    } catch (error) {
      console.error('API keys fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createScope(scopeData) {
    try {
      const {
        name,
        description,
        permissions = [],
        organizationId
      } = scopeData;

      const scope = await this.prisma.scope.create({
        data: {
          name,
          description,
          permissions,
          organizationId,
          createdAt: new Date()
        }
      });

      return {
        success: true,
        scope: {
          id: scope.id,
          name: scope.name,
          description: scope.description,
          permissions: scope.permissions
        }
      };
    } catch (error) {
      console.error('Scope creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async assignScopeToRole(roleId, scopeId) {
    try {
      const roleScope = await this.prisma.roleScope.create({
        data: {
          roleId,
          scopeId,
          assignedAt: new Date()
        }
      });

      return {
        success: true,
        roleScope: {
          id: roleScope.id,
          roleId: roleScope.roleId,
          scopeId: roleScope.scopeId,
          assignedAt: roleScope.assignedAt
        }
      };
    } catch (error) {
      console.error('Scope assignment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getRoleScopes(roleId) {
    try {
      const roleScopes = await this.prisma.roleScope.findMany({
        where: { roleId },
        include: {
          scope: true
        }
      });

      const scopes = roleScopes.map(rs => ({
        id: rs.scope.id,
        name: rs.scope.name,
        description: rs.scope.description,
        permissions: rs.scope.permissions,
        assignedAt: rs.assignedAt
      }));

      return {
        success: true,
        scopes
      };
    } catch (error) {
      console.error('Role scopes fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateJWTToken(userId, organizationId, permissions = []) {
    try {
      const payload = {
        userId,
        organizationId,
        permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET || 'default-secret');

      return {
        success: true,
        token,
        expiresIn: 24 * 60 * 60
      };
    } catch (error) {
      console.error('JWT token generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateJWTToken(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      
      return {
        success: true,
        payload: {
          userId: payload.userId,
          organizationId: payload.organizationId,
          permissions: payload.permissions,
          iat: payload.iat,
          exp: payload.exp
        }
      };
    } catch (error) {
      console.error('JWT token validation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RBACService;
