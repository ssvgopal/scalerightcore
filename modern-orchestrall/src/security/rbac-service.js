const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class RBACService {
  constructor() {
    this.roles = {
      'super_admin': {
        permissions: ['*'],
        description: 'Full system access'
      },
      'admin': {
        permissions: [
          'users:read', 'users:write', 'users:delete',
          'organizations:read', 'organizations:write',
          'workflows:read', 'workflows:write', 'workflows:delete',
          'agents:read', 'agents:write', 'agents:delete',
          'audit:read',
          'agricultural:read', 'agricultural:write', 'agricultural:delete'
        ],
        description: 'Organization administrator'
      },
      'manager': {
        permissions: [
          'users:read',
          'workflows:read', 'workflows:write',
          'agents:read', 'agents:write',
          'agricultural:read', 'agricultural:write'
        ],
        description: 'Team manager'
      },
      'farmer': {
        permissions: [
          'agricultural:read', 'agricultural:write',
          'crops:read', 'crops:write',
          'weather:read',
          'market:read',
          'financial:read', 'financial:write'
        ],
        description: 'Farmer user'
      },
      'analyst': {
        permissions: [
          'agricultural:read',
          'crops:read',
          'weather:read',
          'market:read',
          'financial:read',
          'analytics:read'
        ],
        description: 'Data analyst'
      },
      'viewer': {
        permissions: [
          'agricultural:read',
          'crops:read',
          'weather:read',
          'market:read'
        ],
        description: 'Read-only access'
      }
    };
  }

  // Initialize default roles in database
  async initializeRoles() {
    try {
      for (const [roleName, roleData] of Object.entries(this.roles)) {
        await prisma.role.upsert({
          where: { name: roleName },
          update: {
            permissions: roleData.permissions,
            description: roleData.description
          },
          create: {
            name: roleName,
            permissions: roleData.permissions,
            description: roleData.description
          }
        });
      }
      console.log('✅ Default roles initialized');
    } catch (error) {
      console.error('❌ Failed to initialize roles:', error);
      throw error;
    }
  }

  // Check if user has permission
  async hasPermission(userId, permission) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
      });

      if (!user) return false;

      // Check if user has super admin role
      const hasSuperAdmin = user.roles.some(role => role.name === 'super_admin');
      if (hasSuperAdmin) return true;

      // Check specific permissions
      const userPermissions = user.roles.flatMap(role => role.permissions);
      return userPermissions.includes(permission) || userPermissions.includes('*');
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  // Check if user has any of the required permissions
  async hasAnyPermission(userId, permissions) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
      });

      if (!user) return false;

      // Check if user has super admin role
      const hasSuperAdmin = user.roles.some(role => role.name === 'super_admin');
      if (hasSuperAdmin) return true;

      // Check specific permissions
      const userPermissions = user.roles.flatMap(role => role.permissions);
      return permissions.some(permission => 
        userPermissions.includes(permission) || userPermissions.includes('*')
      );
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  // Check if user has all required permissions
  async hasAllPermissions(userId, permissions) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
      });

      if (!user) return false;

      // Check if user has super admin role
      const hasSuperAdmin = user.roles.some(role => role.name === 'super_admin');
      if (hasSuperAdmin) return true;

      // Check specific permissions
      const userPermissions = user.roles.flatMap(role => role.permissions);
      return permissions.every(permission => 
        userPermissions.includes(permission) || userPermissions.includes('*')
      );
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  // Assign role to user
  async assignRole(userId, roleName) {
    try {
      const role = await prisma.role.findUnique({
        where: { name: roleName }
      });

      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }

      // Check if user already has this role
      const existingRole = await prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id
          }
        }
      });

      if (existingRole) {
        return { success: true, message: 'User already has this role' };
      }

      await prisma.userRole.create({
        data: {
          userId,
          roleId: role.id
        }
      });

      return { success: true, message: 'Role assigned successfully' };
    } catch (error) {
      console.error('Role assignment error:', error);
      throw error;
    }
  }

  // Remove role from user
  async removeRole(userId, roleName) {
    try {
      const role = await prisma.role.findUnique({
        where: { name: roleName }
      });

      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }

      await prisma.userRole.deleteMany({
        where: {
          userId,
          roleId: role.id
        }
      });

      return { success: true, message: 'Role removed successfully' };
    } catch (error) {
      console.error('Role removal error:', error);
      throw error;
    }
  }

  // Get user roles
  async getUserRoles(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true }
      });

      if (!user) return [];

      return user.roles.map(role => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions,
        description: role.description
      }));
    } catch (error) {
      console.error('Get user roles error:', error);
      return [];
    }
  }

  // Get user permissions
  async getUserPermissions(userId) {
    try {
      const roles = await this.getUserRoles(userId);
      const permissions = new Set();

      roles.forEach(role => {
        role.permissions.forEach(permission => {
          permissions.add(permission);
        });
      });

      return Array.from(permissions);
    } catch (error) {
      console.error('Get user permissions error:', error);
      return [];
    }
  }

  // Create custom role
  async createRole(name, permissions, description) {
    try {
      const role = await prisma.role.create({
        data: {
          name,
          permissions,
          description
        }
      });

      return { success: true, role };
    } catch (error) {
      console.error('Create role error:', error);
      throw error;
    }
  }

  // Update role permissions
  async updateRolePermissions(roleName, permissions) {
    try {
      const role = await prisma.role.update({
        where: { name: roleName },
        data: { permissions }
      });

      return { success: true, role };
    } catch (error) {
      console.error('Update role permissions error:', error);
      throw error;
    }
  }

  // Get all roles
  async getAllRoles() {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' }
      });

      return roles;
    } catch (error) {
      console.error('Get all roles error:', error);
      return [];
    }
  }

  // Check organization access
  async hasOrganizationAccess(userId, organizationId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true }
      });

      if (!user) return false;

      // Super admin has access to all organizations
      const roles = await this.getUserRoles(userId);
      const hasSuperAdmin = roles.some(role => role.name === 'super_admin');
      if (hasSuperAdmin) return true;

      // Check if user belongs to the organization
      return user.organizationId === organizationId;
    } catch (error) {
      console.error('Organization access check error:', error);
      return false;
    }
  }

  // Get accessible organizations for user
  async getAccessibleOrganizations(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true }
      });

      if (!user) return [];

      // Super admin has access to all organizations
      const roles = await this.getUserRoles(userId);
      const hasSuperAdmin = roles.some(role => role.name === 'super_admin');
      
      if (hasSuperAdmin) {
        const organizations = await prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            tier: true,
            status: true
          }
        });
        return organizations;
      }

      // Regular user has access only to their organization
      return [{
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
        tier: user.organization.tier,
        status: user.organization.status
      }];
    } catch (error) {
      console.error('Get accessible organizations error:', error);
      return [];
    }
  }
}

module.exports = RBACService;