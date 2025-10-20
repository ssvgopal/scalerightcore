class MultiTenancyService {
  constructor(prisma) {
    this.prisma = prisma;
    this.tenantTiers = new Map();
    this.migrationJobs = new Map();
    this.sloMetrics = new Map();
  }

  async initializeTenantTiers() {
    try {
      const tiers = [
        {
          id: 'free',
          name: 'Free Tier',
          limits: {
            maxUsers: 5,
            maxStorage: 1024 * 1024 * 1024, // 1GB
            maxApiCalls: 1000,
            maxConcurrentRequests: 10,
            slaUptime: 99.0,
            responseTimeP95: 2000, // 2 seconds
            supportLevel: 'community'
          },
          features: ['basic_crud', 'basic_analytics']
        },
        {
          id: 'professional',
          name: 'Professional Tier',
          limits: {
            maxUsers: 50,
            maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
            maxApiCalls: 10000,
            maxConcurrentRequests: 100,
            slaUptime: 99.5,
            responseTimeP95: 1000, // 1 second
            supportLevel: 'email'
          },
          features: ['basic_crud', 'advanced_analytics', 'integrations', 'custom_dashboards']
        },
        {
          id: 'enterprise',
          name: 'Enterprise Tier',
          limits: {
            maxUsers: -1, // unlimited
            maxStorage: -1, // unlimited
            maxApiCalls: -1, // unlimited
            maxConcurrentRequests: 1000,
            slaUptime: 99.9,
            responseTimeP95: 500, // 500ms
            supportLevel: 'dedicated'
          },
          features: ['basic_crud', 'advanced_analytics', 'integrations', 'custom_dashboards', 'white_label', 'sso', 'audit_logs']
        }
      ];

      tiers.forEach(tier => {
        this.tenantTiers.set(tier.id, tier);
      });

      return {
        success: true,
        tiers: tiers.map(tier => ({
          id: tier.id,
          name: tier.name,
          limits: tier.limits,
          features: tier.features
        }))
      };
    } catch (error) {
      console.error('Tenant tiers initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async assignTenantTier(organizationId, tierId) {
    try {
      const tier = this.tenantTiers.get(tierId);
      if (!tier) {
        return {
          success: false,
          error: 'Invalid tier ID'
        };
      }

      // Update organization tier
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          tier: tierId,
          tierAssignedAt: new Date(),
          tierLimits: tier.limits,
          tierFeatures: tier.features
        }
      });

      return {
        success: true,
        message: `Organization ${organizationId} assigned to ${tier.name}`,
        tier: {
          id: tier.id,
          name: tier.name,
          limits: tier.limits,
          features: tier.features
        }
      };
    } catch (error) {
      console.error('Tenant tier assignment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkTenantLimits(organizationId, resourceType, currentUsage) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      const tier = this.tenantTiers.get(organization.tier);
      if (!tier) {
        return {
          success: false,
          error: 'Invalid tier configuration'
        };
      }

      const limit = tier.limits[resourceType];
      if (limit === -1) {
        return {
          success: true,
          withinLimit: true,
          limit: 'unlimited',
          currentUsage,
          remaining: 'unlimited'
        };
      }

      const withinLimit = currentUsage <= limit;
      const remaining = Math.max(0, limit - currentUsage);

      return {
        success: true,
        withinLimit,
        limit,
        currentUsage,
        remaining,
        tier: tier.id
      };
    } catch (error) {
      console.error('Tenant limits check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async startTenantMigration(organizationId, targetTier, migrationOptions = {}) {
    try {
      const jobId = `migration_${organizationId}_${Date.now()}`;
      
      const job = {
        id: jobId,
        organizationId,
        sourceTier: null,
        targetTier,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        options: {
          preserveData: migrationOptions.preserveData !== false,
          migrateUsers: migrationOptions.migrateUsers !== false,
          migrateSettings: migrationOptions.migrateSettings !== false,
          ...migrationOptions
        },
        progress: {
          totalSteps: 0,
          completedSteps: 0,
          currentStep: null
        },
        results: {
          migrated: [],
          errors: [],
          warnings: []
        }
      };

      this.migrationJobs.set(jobId, job);

      // Start migration process in background
      this.performTenantMigration(jobId).catch(error => {
        console.error(`Tenant migration job ${jobId} failed:`, error);
        const job = this.migrationJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.error = error.message;
          job.completedAt = new Date();
        }
      });

      return {
        success: true,
        jobId,
        message: 'Tenant migration job started'
      };
    } catch (error) {
      console.error('Tenant migration start failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performTenantMigration(jobId) {
    const job = this.migrationJobs.get(jobId);
    if (!job) {
      throw new Error('Migration job not found');
    }

    try {
      job.status = 'running';
      job.startedAt = new Date();
      job.progress.totalSteps = 5;
      job.progress.currentStep = 'Initializing migration';

      // Step 1: Backup current data
      job.progress.currentStep = 'Backing up current data';
      const backupResult = await this.backupTenantData(job.organizationId);
      if (!backupResult.success) {
        throw new Error(`Backup failed: ${backupResult.error}`);
      }
      job.progress.completedSteps++;

      // Step 2: Update tier assignment
      job.progress.currentStep = 'Updating tier assignment';
      const tierResult = await this.assignTenantTier(job.organizationId, job.targetTier);
      if (!tierResult.success) {
        throw new Error(`Tier assignment failed: ${tierResult.error}`);
      }
      job.progress.completedSteps++;

      // Step 3: Migrate settings
      if (job.options.migrateSettings) {
        job.progress.currentStep = 'Migrating settings';
        const settingsResult = await this.migrateTenantSettings(job.organizationId, job.targetTier);
        if (!settingsResult.success) {
          job.results.warnings.push(`Settings migration warning: ${settingsResult.error}`);
        }
      }
      job.progress.completedSteps++;

      // Step 4: Migrate users
      if (job.options.migrateUsers) {
        job.progress.currentStep = 'Migrating users';
        const usersResult = await this.migrateTenantUsers(job.organizationId, job.targetTier);
        if (!usersResult.success) {
          job.results.warnings.push(`Users migration warning: ${usersResult.error}`);
        }
      }
      job.progress.completedSteps++;

      // Step 5: Validate migration
      job.progress.currentStep = 'Validating migration';
      const validationResult = await this.validateTenantMigration(job.organizationId, job.targetTier);
      if (!validationResult.success) {
        job.results.warnings.push(`Validation warning: ${validationResult.error}`);
      }
      job.progress.completedSteps++;

      job.status = 'completed';
      job.completedAt = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      throw error;
    }
  }

  async backupTenantData(organizationId) {
    try {
      // This would create a comprehensive backup of all tenant data
      const backupData = {
        organizationId,
        timestamp: new Date(),
        users: await this.prisma.user.findMany({ where: { organizationId } }),
        products: await this.prisma.product.findMany({ where: { organizationId } }),
        orders: await this.prisma.order.findMany({ where: { organizationId } }),
        settings: await this.prisma.organization.findUnique({ where: { id: organizationId } })
      };

      // In production, this would be stored in a backup storage system
      console.log(`Backup created for organization ${organizationId}`);

      return {
        success: true,
        backupId: `backup_${organizationId}_${Date.now()}`,
        dataSize: JSON.stringify(backupData).length
      };
    } catch (error) {
      console.error('Tenant data backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async migrateTenantSettings(organizationId, targetTier) {
    try {
      const tier = this.tenantTiers.get(targetTier);
      if (!tier) {
        throw new Error('Invalid target tier');
      }

      // Update organization settings based on tier
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          tier: targetTier,
          tierLimits: tier.limits,
          tierFeatures: tier.features,
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        message: 'Settings migrated successfully'
      };
    } catch (error) {
      console.error('Settings migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async migrateTenantUsers(organizationId, targetTier) {
    try {
      const tier = this.tenantTiers.get(targetTier);
      if (!tier) {
        throw new Error('Invalid target tier');
      }

      // Check if user count exceeds new tier limits
      const userCount = await this.prisma.user.count({
        where: { organizationId }
      });

      if (tier.limits.maxUsers !== -1 && userCount > tier.limits.maxUsers) {
        return {
          success: false,
          error: `User count (${userCount}) exceeds tier limit (${tier.limits.maxUsers})`
        };
      }

      return {
        success: true,
        message: 'Users migration completed',
        userCount
      };
    } catch (error) {
      console.error('Users migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateTenantMigration(organizationId, targetTier) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization || organization.tier !== targetTier) {
        return {
          success: false,
          error: 'Tier assignment validation failed'
        };
      }

      return {
        success: true,
        message: 'Migration validation passed',
        tier: organization.tier
      };
    } catch (error) {
      console.error('Migration validation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async exportTenantData(organizationId, exportOptions = {}) {
    try {
      const {
        includeUsers = true,
        includeProducts = true,
        includeOrders = true,
        includeSettings = true,
        format = 'json'
      } = exportOptions;

      const exportData = {};

      if (includeUsers) {
        exportData.users = await this.prisma.user.findMany({
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            lastLoginAt: true
          }
        });
      }

      if (includeProducts) {
        exportData.products = await this.prisma.product.findMany({
          where: { organizationId },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            sku: true,
            category: true,
            createdAt: true,
            updatedAt: true
          }
        });
      }

      if (includeOrders) {
        exportData.orders = await this.prisma.order.findMany({
          where: { organizationId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    sku: true
                  }
                }
              }
            }
          }
        });
      }

      if (includeSettings) {
        exportData.settings = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            tier: true,
            tierLimits: true,
            tierFeatures: true,
            createdAt: true,
            updatedAt: true
          }
        });
      }

      exportData.exportMetadata = {
        organizationId,
        exportedAt: new Date(),
        format,
        version: '1.0'
      };

      return {
        success: true,
        data: exportData,
        size: JSON.stringify(exportData).length,
        format
      };
    } catch (error) {
      console.error('Tenant data export failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMigrationJobStatus(jobId) {
    const job = this.migrationJobs.get(jobId);
    if (!job) {
      return {
        success: false,
        error: 'Migration job not found'
      };
    }

    return {
      success: true,
      job: {
        id: job.id,
        organizationId: job.organizationId,
        sourceTier: job.sourceTier,
        targetTier: job.targetTier,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        results: job.results,
        error: job.error
      }
    };
  }

  async getAllMigrationJobs(organizationId) {
    const jobs = Array.from(this.migrationJobs.values())
      .filter(job => job.organizationId === organizationId)
      .map(job => ({
        id: job.id,
        sourceTier: job.sourceTier,
        targetTier: job.targetTier,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress
      }));

    return {
      success: true,
      jobs
    };
  }

  async getSLOMetrics(organizationId, timeRange = '24h') {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      const tier = this.tenantTiers.get(organization.tier);
      if (!tier) {
        return {
          success: false,
          error: 'Invalid tier configuration'
        };
      }

      // Mock SLO metrics - in production, these would come from monitoring systems
      const sloMetrics = {
        uptime: {
          target: tier.limits.slaUptime,
          actual: 99.95,
          status: tier.limits.slaUptime <= 99.95 ? 'met' : 'breach'
        },
        responseTime: {
          target: tier.limits.responseTimeP95,
          actual: 800,
          status: 800 <= tier.limits.responseTimeP95 ? 'met' : 'breach'
        },
        apiCalls: {
          limit: tier.limits.maxApiCalls,
          used: 500,
          remaining: tier.limits.maxApiCalls === -1 ? 'unlimited' : tier.limits.maxApiCalls - 500
        },
        concurrentRequests: {
          limit: tier.limits.maxConcurrentRequests,
          current: 5,
          status: 5 <= tier.limits.maxConcurrentRequests ? 'within_limit' : 'exceeded'
        }
      };

      return {
        success: true,
        sloMetrics,
        tier: tier.id,
        timeRange
      };
    } catch (error) {
      console.error('SLO metrics fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MultiTenancyService;
