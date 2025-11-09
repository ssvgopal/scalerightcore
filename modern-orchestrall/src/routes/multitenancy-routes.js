const MultiTenancyService = require('../multitenancy/multitenancy-service');

class MultiTenancyRoutes {
  constructor(app, prisma) {
    this.app = app;
    this.prisma = prisma;
    this.multitenancyService = new MultiTenancyService(prisma);
  }

  async initialize() {
    await this.multitenancyService.initialize();
    this.registerRoutes();
  }

  registerRoutes() {
    // Tenant management endpoints
    this.app.post('/api/tenants', async (request, reply) => {
      try {
        const { name, slug, tier = 'starter', customConfig = {} } = request.body;

        if (!name || !slug) {
          return reply.status(400).send({
            error: 'Missing required fields: name, slug'
          });
        }

        const result = await this.multitenancyService.createTenant({
          name,
          slug,
          tier,
          customConfig
        });

        reply.send({
          success: true,
          data: result.data,
          message: 'Tenant created successfully'
        });
      } catch (error) {
        console.error('Failed to create tenant:', error);
        reply.status(500).send({
          error: 'Failed to create tenant',
          message: error.message
        });
      }
    });

    this.app.get('/api/tenants', async (request, reply) => {
      try {
        const tenants = this.multitenancyService.getAllTenants();
        
        reply.send({
          success: true,
          data: tenants
        });
      } catch (error) {
        console.error('Failed to get tenants:', error);
        reply.status(500).send({
          error: 'Failed to get tenants',
          message: error.message
        });
      }
    });

    this.app.get('/api/tenants/:tenantId', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const config = this.multitenancyService.getTenantConfig(tenantId);

        if (!config) {
          return reply.status(404).send({
            error: 'Tenant not found'
          });
        }

        reply.send({
          success: true,
          data: config
        });
      } catch (error) {
        console.error('Failed to get tenant:', error);
        reply.status(500).send({
          error: 'Failed to get tenant',
          message: error.message
        });
      }
    });

    this.app.put('/api/tenants/:tenantId', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const updateData = request.body;

        const result = await this.multitenancyService.updateTenant(tenantId, updateData);

        reply.send({
          success: true,
          data: result.data,
          message: 'Tenant updated successfully'
        });
      } catch (error) {
        console.error('Failed to update tenant:', error);
        reply.status(500).send({
          error: 'Failed to update tenant',
          message: error.message
        });
      }
    });

    this.app.delete('/api/tenants/:tenantId', async (request, reply) => {
      try {
        const { tenantId } = request.params;

        const result = await this.multitenancyService.deleteTenant(tenantId);

        reply.send({
          success: true,
          data: result.data,
          message: 'Tenant deleted successfully'
        });
      } catch (error) {
        console.error('Failed to delete tenant:', error);
        reply.status(500).send({
          error: 'Failed to delete tenant',
          message: error.message
        });
      }
    });

    // Tenant data access endpoints
    this.app.get('/api/tenants/:tenantId/data/:model', async (request, reply) => {
      try {
        const { tenantId, model } = request.params;
        const options = request.query;

        const result = await this.multitenancyService.getTenantData(tenantId, model, options);

        reply.send({
          success: true,
          data: result.data,
          tenant: result.tenant,
          pagination: result.pagination
        });
      } catch (error) {
        console.error('Failed to get tenant data:', error);
        reply.status(500).send({
          error: 'Failed to get tenant data',
          message: error.message
        });
      }
    });

    this.app.post('/api/tenants/:tenantId/data/:model', async (request, reply) => {
      try {
        const { tenantId, model } = request.params;
        const data = request.body;

        const result = await this.multitenancyService.createTenantData(tenantId, model, data);

        reply.send({
          success: true,
          data: result.data,
          message: 'Data created successfully'
        });
      } catch (error) {
        console.error('Failed to create tenant data:', error);
        reply.status(500).send({
          error: 'Failed to create tenant data',
          message: error.message
        });
      }
    });

    this.app.put('/api/tenants/:tenantId/data/:model/:id', async (request, reply) => {
      try {
        const { tenantId, model, id } = request.params;
        const data = request.body;

        const result = await this.multitenancyService.updateTenantData(tenantId, model, id, data);

        reply.send({
          success: true,
          data: result.data,
          message: 'Data updated successfully'
        });
      } catch (error) {
        console.error('Failed to update tenant data:', error);
        reply.status(500).send({
          error: 'Failed to update tenant data',
          message: error.message
        });
      }
    });

    this.app.delete('/api/tenants/:tenantId/data/:model/:id', async (request, reply) => {
      try {
        const { tenantId, model, id } = request.params;

        const result = await this.multitenancyService.deleteTenantData(tenantId, model, id);

        reply.send({
          success: true,
          data: result.data,
          message: 'Data deleted successfully'
        });
      } catch (error) {
        console.error('Failed to delete tenant data:', error);
        reply.status(500).send({
          error: 'Failed to delete tenant data',
          message: error.message
        });
      }
    });

    // Tenant usage and analytics endpoints
    this.app.get('/api/tenants/:tenantId/usage', async (request, reply) => {
      try {
        const { tenantId } = request.params;

        const result = await this.multitenancyService.getTenantUsage(tenantId);

        reply.send({
          success: true,
          data: result.data
        });
      } catch (error) {
        console.error('Failed to get tenant usage:', error);
        reply.status(500).send({
          error: 'Failed to get tenant usage',
          message: error.message
        });
      }
    });

    this.app.get('/api/tenants/:tenantId/analytics', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { timeRange = '30d' } = request.query;

        const result = await this.multitenancyService.getTenantAnalytics(tenantId, timeRange);

        reply.send({
          success: true,
          data: result.data
        });
      } catch (error) {
        console.error('Failed to get tenant analytics:', error);
        reply.status(500).send({
          error: 'Failed to get tenant analytics',
          message: error.message
        });
      }
    });

    // Tenant migration endpoints
    this.app.post('/api/tenants/:tenantId/migrate', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { targetIsolationMode } = request.body;

        if (!targetIsolationMode) {
          return reply.status(400).send({
            error: 'Missing required field: targetIsolationMode'
          });
        }

        const result = await this.multitenancyService.migrateTenantData(tenantId, targetIsolationMode);

        reply.send({
          success: true,
          data: result,
          message: 'Tenant migration initiated'
        });
      } catch (error) {
        console.error('Failed to migrate tenant:', error);
        reply.status(500).send({
          error: 'Failed to migrate tenant',
          message: error.message
        });
      }
    });

    // Tenant isolation mode endpoints
    this.app.get('/api/tenants/:tenantId/isolation-mode', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const isolationMode = this.multitenancyService.getTenantIsolationMode(tenantId);

        reply.send({
          success: true,
          data: {
            tenantId,
            isolationMode
          }
        });
      } catch (error) {
        console.error('Failed to get tenant isolation mode:', error);
        reply.status(500).send({
          error: 'Failed to get tenant isolation mode',
          message: error.message
        });
      }
    });

    // Tenant status endpoints
    this.app.get('/api/tenants/:tenantId/status', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const isActive = this.multitenancyService.isTenantActive(tenantId);
        const config = this.multitenancyService.getTenantConfig(tenantId);

        reply.send({
          success: true,
          data: {
            tenantId,
            isActive,
            status: config ? config.status : 'unknown',
            tier: config ? config.tier : 'unknown',
            isolationMode: config ? config.isolationMode : 'unknown'
          }
        });
      } catch (error) {
        console.error('Failed to get tenant status:', error);
        reply.status(500).send({
          error: 'Failed to get tenant status',
          message: error.message
        });
      }
    });

    // Tenant lookup by slug
    this.app.get('/api/tenants/lookup/:slug', async (request, reply) => {
      try {
        const { slug } = request.params;
        const tenant = this.multitenancyService.getTenantBySlug(slug);

        if (!tenant) {
          return reply.status(404).send({
            error: 'Tenant not found'
          });
        }

        reply.send({
          success: true,
          data: tenant
        });
      } catch (error) {
        console.error('Failed to lookup tenant:', error);
        reply.status(500).send({
          error: 'Failed to lookup tenant',
          message: error.message
        });
      }
    });

    // Tenant limits check endpoint
    this.app.post('/api/tenants/:tenantId/check-limits', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { model, operation } = request.body;

        if (!model || !operation) {
          return reply.status(400).send({
            error: 'Missing required fields: model, operation'
          });
        }

        await this.multitenancyService.checkTenantLimits(tenantId, model, operation);

        reply.send({
          success: true,
          message: 'Tenant limits check passed'
        });
      } catch (error) {
        console.error('Failed to check tenant limits:', error);
        reply.status(400).send({
          error: 'Tenant limits exceeded',
          message: error.message
        });
      }
    });

    // Tenant configuration endpoints
    this.app.get('/api/tenants/:tenantId/config', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const config = this.multitenancyService.getTenantConfig(tenantId);

        if (!config) {
          return reply.status(404).send({
            error: 'Tenant not found'
          });
        }

        reply.send({
          success: true,
          data: {
            features: config.features,
            limits: config.limits,
            customConfig: config.customConfig,
            isolationMode: config.isolationMode
          }
        });
      } catch (error) {
        console.error('Failed to get tenant config:', error);
        reply.status(500).send({
          error: 'Failed to get tenant config',
          message: error.message
        });
      }
    });

    this.app.put('/api/tenants/:tenantId/config', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { customConfig } = request.body;

        const result = await this.multitenancyService.updateTenant(tenantId, { customConfig });

        reply.send({
          success: true,
          data: result.data,
          message: 'Tenant configuration updated successfully'
        });
      } catch (error) {
        console.error('Failed to update tenant config:', error);
        reply.status(500).send({
          error: 'Failed to update tenant config',
          message: error.message
        });
      }
    });

    // Tenant backup endpoints
    this.app.post('/api/tenants/:tenantId/backup', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { backupType = 'manual' } = request.body;

        await this.multitenancyService.createTenantBackup(tenantId);

        reply.send({
          success: true,
          message: 'Tenant backup created successfully'
        });
      } catch (error) {
        console.error('Failed to create tenant backup:', error);
        reply.status(500).send({
          error: 'Failed to create tenant backup',
          message: error.message
        });
      }
    });

    this.app.get('/api/tenants/:tenantId/backups', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { limit = 10, offset = 0 } = request.query;

        const backups = await this.prisma.tenantBackup.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset)
        });

        const totalCount = await this.prisma.tenantBackup.count({
          where: { tenantId }
        });

        reply.send({
          success: true,
          data: {
            backups,
            pagination: {
              total: totalCount,
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
            }
          }
        });
      } catch (error) {
        console.error('Failed to get tenant backups:', error);
        reply.status(500).send({
          error: 'Failed to get tenant backups',
          message: error.message
        });
      }
    });

    // Tenant migration status endpoints
    this.app.get('/api/tenants/:tenantId/migrations', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const { limit = 10, offset = 0 } = request.query;

        const migrations = await this.prisma.tenantMigration.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset)
        });

        const totalCount = await this.prisma.tenantMigration.count({
          where: { tenantId }
        });

        reply.send({
          success: true,
          data: {
            migrations,
            pagination: {
              total: totalCount,
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
            }
          }
        });
      } catch (error) {
        console.error('Failed to get tenant migrations:', error);
        reply.status(500).send({
          error: 'Failed to get tenant migrations',
          message: error.message
        });
      }
    });

    this.app.get('/api/tenants/:tenantId/migrations/:migrationId', async (request, reply) => {
      try {
        const { tenantId, migrationId } = request.params;

        const migration = await this.prisma.tenantMigration.findFirst({
          where: {
            id: migrationId,
            tenantId
          }
        });

        if (!migration) {
          return reply.status(404).send({
            error: 'Migration not found'
          });
        }

        reply.send({
          success: true,
          data: migration
        });
      } catch (error) {
        console.error('Failed to get migration:', error);
        reply.status(500).send({
          error: 'Failed to get migration',
          message: error.message
        });
      }
    });
  }
}

module.exports = MultiTenancyRoutes;
