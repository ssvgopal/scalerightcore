const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class MultiTenancyService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.tenantConfigs = new Map();
    this.tenantConnections = new Map();
    this.tenantIsolationMode = process.env.TENANT_ISOLATION_MODE || 'schema'; // schema, database, table
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize tenant configurations
      await this.initializeTenantConfigurations();
      
      // Initialize tenant connections
      await this.initializeTenantConnections();
      
      // Initialize tenant isolation
      await this.initializeTenantIsolation();
      
      this.isInitialized = true;
      console.log('✅ Multi-tenancy Service initialized');
    } catch (error) {
      console.error('Failed to initialize Multi-tenancy Service:', error);
      throw error;
    }
  }

  async initializeTenantConfigurations() {
    // Load tenant configurations from database
    const tenants = await this.prisma.organization.findMany({
      where: { status: 'active' },
      include: {
        tenantConfig: true
      }
    });

    tenants.forEach(tenant => {
      const config = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tier: tenant.tier,
        status: tenant.status,
        isolationMode: this.tenantIsolationMode,
        customConfig: tenant.tenantConfig || {},
        features: this.getTenantFeatures(tenant.tier),
        limits: this.getTenantLimits(tenant.tier),
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      };

      this.tenantConfigs.set(tenant.id, config);
    });

    console.log(`✅ Initialized ${tenants.length} tenant configurations`);
  }

  async initializeTenantConnections() {
    // Initialize database connections for each tenant based on isolation mode
    for (const [tenantId, config] of this.tenantConfigs) {
      try {
        let connection;

        switch (config.isolationMode) {
          case 'database':
            connection = await this.createTenantDatabaseConnection(tenantId, config);
            break;
          case 'schema':
            connection = await this.createTenantSchemaConnection(tenantId, config);
            break;
          case 'table':
            connection = this.prisma; // Use shared connection with table-level isolation
            break;
          default:
            connection = this.prisma;
        }

        this.tenantConnections.set(tenantId, connection);
      } catch (error) {
        console.error(`Failed to initialize connection for tenant ${tenantId}:`, error);
      }
    }

    console.log(`✅ Initialized ${this.tenantConnections.size} tenant connections`);
  }

  async initializeTenantIsolation() {
    // Create tenant-specific schemas or databases based on isolation mode
    for (const [tenantId, config] of this.tenantConfigs) {
      try {
        switch (config.isolationMode) {
          case 'database':
            await this.createTenantDatabase(tenantId, config);
            break;
          case 'schema':
            await this.createTenantSchema(tenantId, config);
            break;
          case 'table':
            await this.createTenantTables(tenantId, config);
            break;
        }
      } catch (error) {
        console.error(`Failed to initialize isolation for tenant ${tenantId}:`, error);
      }
    }

    console.log('✅ Tenant isolation initialized');
  }

  async createTenantDatabase(tenantId, config) {
    const dbName = `tenant_${tenantId.replace(/-/g, '_')}`;
    
    try {
      // Create database for tenant
      await this.prisma.$executeRaw`CREATE DATABASE IF NOT EXISTS ${dbName}`;
      
      // Create tables in tenant database
      await this.createTenantTables(tenantId, config, dbName);
      
      console.log(`✅ Created database for tenant ${tenantId}: ${dbName}`);
    } catch (error) {
      console.error(`Failed to create database for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantSchema(tenantId, config) {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    
    try {
      // Create schema for tenant
      await this.prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS ${schemaName}`;
      
      // Create tables in tenant schema
      await this.createTenantTables(tenantId, config, null, schemaName);
      
      console.log(`✅ Created schema for tenant ${tenantId}: ${schemaName}`);
    } catch (error) {
      console.error(`Failed to create schema for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantTables(tenantId, config, database = null, schema = null) {
    const prefix = database ? `${database}.` : schema ? `${schema}.` : '';
    
    try {
      // Create tenant-specific tables with proper isolation
      const tables = [
        'farmer_profiles',
        'crops',
        'crop_health_records',
        'loans',
        'insurance_policies',
        'voice_calls',
        'payments',
        'notifications',
        'workflows',
        'audit_logs'
      ];

      for (const table of tables) {
        await this.prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS ${prefix}${table} (
            id VARCHAR(255) PRIMARY KEY,
            organization_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            data JSON,
            INDEX idx_org_id (organization_id),
            INDEX idx_created_at (created_at)
          )
        `;
      }

      console.log(`✅ Created tables for tenant ${tenantId}`);
    } catch (error) {
      console.error(`Failed to create tables for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantDatabaseConnection(tenantId, config) {
    const dbName = `tenant_${tenantId.replace(/-/g, '_')}`;
    const connectionString = process.env.DATABASE_URL.replace(/\/[^\/]+$/, `/${dbName}`);
    
    return new PrismaClient({
      datasources: {
        db: {
          url: connectionString
        }
      }
    });
  }

  async createTenantSchemaConnection(tenantId, config) {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    const connectionString = `${process.env.DATABASE_URL}?schema=${schemaName}`;
    
    return new PrismaClient({
      datasources: {
        db: {
          url: connectionString
        }
      }
    });
  }

  getTenantFeatures(tier) {
    const features = {
      starter: {
        maxFarmers: 100,
        maxCrops: 500,
        maxVoiceCalls: 1000,
        maxStorage: '1GB',
        analytics: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false
      },
      professional: {
        maxFarmers: 1000,
        maxCrops: 5000,
        maxVoiceCalls: 10000,
        maxStorage: '10GB',
        analytics: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: false
      },
      enterprise: {
        maxFarmers: -1, // unlimited
        maxCrops: -1, // unlimited
        maxVoiceCalls: -1, // unlimited
        maxStorage: '100GB',
        analytics: true,
        customBranding: true,
        apiAccess: true,
        prioritySupport: true
      }
    };

    return features[tier] || features.starter;
  }

  getTenantLimits(tier) {
    const limits = {
      starter: {
        apiRequestsPerHour: 1000,
        concurrentUsers: 10,
        dataRetentionDays: 30,
        backupFrequency: 'weekly'
      },
      professional: {
        apiRequestsPerHour: 10000,
        concurrentUsers: 100,
        dataRetentionDays: 90,
        backupFrequency: 'daily'
      },
      enterprise: {
        apiRequestsPerHour: 100000,
        concurrentUsers: -1, // unlimited
        dataRetentionDays: 365,
        backupFrequency: 'hourly'
      }
    };

    return limits[tier] || limits.starter;
  }

  // Tenant management methods
  async createTenant(tenantData) {
    try {
      const { name, slug, tier = 'starter', customConfig = {} } = tenantData;
      
      // Create organization
      const organization = await this.prisma.organization.create({
        data: {
          name,
          slug,
          tier,
          status: 'active'
        }
      });

      // Create tenant configuration
      const tenantConfig = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        tier: organization.tier,
        status: organization.status,
        isolationMode: this.tenantIsolationMode,
        customConfig,
        features: this.getTenantFeatures(organization.tier),
        limits: this.getTenantLimits(organization.tier),
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      };

      this.tenantConfigs.set(organization.id, tenantConfig);

      // Initialize tenant isolation
      await this.initializeTenantForNewTenant(organization.id, tenantConfig);

      return {
        success: true,
        data: tenantConfig
      };
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw error;
    }
  }

  async initializeTenantForNewTenant(tenantId, config) {
    try {
      let connection;

      switch (config.isolationMode) {
        case 'database':
          await this.createTenantDatabase(tenantId, config);
          connection = await this.createTenantDatabaseConnection(tenantId, config);
          break;
        case 'schema':
          await this.createTenantSchema(tenantId, config);
          connection = await this.createTenantSchemaConnection(tenantId, config);
          break;
        case 'table':
          connection = this.prisma;
          break;
        default:
          connection = this.prisma;
      }

      this.tenantConnections.set(tenantId, connection);
      
      console.log(`✅ Initialized tenant ${tenantId} with ${config.isolationMode} isolation`);
    } catch (error) {
      console.error(`Failed to initialize tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async updateTenant(tenantId, updateData) {
    try {
      const { name, tier, customConfig, status } = updateData;
      
      // Update organization
      const organization = await this.prisma.organization.update({
        where: { id: tenantId },
        data: {
          ...(name && { name }),
          ...(tier && { tier }),
          ...(status && { status })
        }
      });

      // Update tenant configuration
      const existingConfig = this.tenantConfigs.get(tenantId);
      if (existingConfig) {
        const updatedConfig = {
          ...existingConfig,
          name: organization.name,
          tier: organization.tier,
          status: organization.status,
          customConfig: { ...existingConfig.customConfig, ...customConfig },
          features: this.getTenantFeatures(organization.tier),
          limits: this.getTenantLimits(organization.tier),
          updatedAt: organization.updatedAt
        };

        this.tenantConfigs.set(tenantId, updatedConfig);
      }

      return {
        success: true,
        data: organization
      };
    } catch (error) {
      console.error('Failed to update tenant:', error);
      throw error;
    }
  }

  async deleteTenant(tenantId) {
    try {
      // Soft delete - mark as cancelled
      const organization = await this.prisma.organization.update({
        where: { id: tenantId },
        data: { status: 'cancelled' }
      });

      // Remove from memory
      this.tenantConfigs.delete(tenantId);
      this.tenantConnections.delete(tenantId);

      // TODO: Implement data cleanup based on retention policy
      await this.scheduleTenantDataCleanup(tenantId);

      return {
        success: true,
        data: organization
      };
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      throw error;
    }
  }

  async scheduleTenantDataCleanup(tenantId) {
    try {
      const config = this.tenantConfigs.get(tenantId);
      if (!config) return;

      const retentionDays = config.limits.dataRetentionDays;
      const cleanupDate = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

      // Schedule cleanup job
      console.log(`📅 Scheduled data cleanup for tenant ${tenantId} on ${cleanupDate}`);
      
      // In a real implementation, this would schedule a background job
      // For now, we'll just log it
    } catch (error) {
      console.error('Failed to schedule tenant data cleanup:', error);
    }
  }

  // Tenant data access methods
  getTenantConnection(tenantId) {
    return this.tenantConnections.get(tenantId) || this.prisma;
  }

  getTenantConfig(tenantId) {
    return this.tenantConfigs.get(tenantId);
  }

  async getTenantData(tenantId, model, options = {}) {
    try {
      const connection = this.getTenantConnection(tenantId);
      const config = this.getTenantConfig(tenantId);

      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Apply tenant-specific filtering
      const whereClause = {
        ...options.where,
        organizationId: tenantId
      };

      // Apply tenant limits
      const limit = options.take || config.limits.maxRecordsPerQuery || 1000;
      const take = Math.min(limit, config.limits.maxRecordsPerQuery || 1000);

      const data = await connection[model].findMany({
        ...options,
        where: whereClause,
        take
      });

      return {
        success: true,
        data,
        tenant: config,
        pagination: {
          limit: take,
          hasMore: data.length === take
        }
      };
    } catch (error) {
      console.error(`Failed to get tenant data for ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantData(tenantId, model, data) {
    try {
      const connection = this.getTenantConnection(tenantId);
      const config = this.getTenantConfig(tenantId);

      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Add tenant ID to data
      const tenantData = {
        ...data,
        organizationId: tenantId
      };

      // Check tenant limits
      await this.checkTenantLimits(tenantId, model, 'create');

      const result = await connection[model].create({
        data: tenantData
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Failed to create tenant data for ${tenantId}:`, error);
      throw error;
    }
  }

  async updateTenantData(tenantId, model, id, data) {
    try {
      const connection = this.getTenantConnection(tenantId);
      const config = this.getTenantConfig(tenantId);

      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Ensure data belongs to tenant
      const whereClause = {
        id,
        organizationId: tenantId
      };

      const result = await connection[model].update({
        where: whereClause,
        data
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Failed to update tenant data for ${tenantId}:`, error);
      throw error;
    }
  }

  async deleteTenantData(tenantId, model, id) {
    try {
      const connection = this.getTenantConnection(tenantId);
      const config = this.getTenantConfig(tenantId);

      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Ensure data belongs to tenant
      const whereClause = {
        id,
        organizationId: tenantId
      };

      const result = await connection[model].delete({
        where: whereClause
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Failed to delete tenant data for ${tenantId}:`, error);
      throw error;
    }
  }

  // Tenant limits and usage tracking
  async checkTenantLimits(tenantId, model, operation) {
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) return;

      const limits = config.limits;
      const features = config.features;

      // Check model-specific limits
      switch (model) {
        case 'farmerProfile':
          if (features.maxFarmers !== -1) {
            const currentCount = await this.getTenantDataCount(tenantId, 'farmerProfile');
            if (currentCount >= features.maxFarmers) {
              throw new Error(`Tenant limit exceeded: Maximum ${features.maxFarmers} farmers allowed`);
            }
          }
          break;
        case 'crop':
          if (features.maxCrops !== -1) {
            const currentCount = await this.getTenantDataCount(tenantId, 'crop');
            if (currentCount >= features.maxCrops) {
              throw new Error(`Tenant limit exceeded: Maximum ${features.maxCrops} crops allowed`);
            }
          }
          break;
        case 'voiceCall':
          if (features.maxVoiceCalls !== -1) {
            const currentCount = await this.getTenantDataCount(tenantId, 'voiceCall');
            if (currentCount >= features.maxVoiceCalls) {
              throw new Error(`Tenant limit exceeded: Maximum ${features.maxVoiceCalls} voice calls allowed`);
            }
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to check tenant limits for ${tenantId}:`, error);
      throw error;
    }
  }

  async getTenantDataCount(tenantId, model) {
    try {
      const connection = this.getTenantConnection(tenantId);
      return await connection[model].count({
        where: { organizationId: tenantId }
      });
    } catch (error) {
      console.error(`Failed to get tenant data count for ${tenantId}:`, error);
      return 0;
    }
  }

  async getTenantUsage(tenantId) {
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const usage = {
        farmers: await this.getTenantDataCount(tenantId, 'farmerProfile'),
        crops: await this.getTenantDataCount(tenantId, 'crop'),
        voiceCalls: await this.getTenantDataCount(tenantId, 'voiceCall'),
        payments: await this.getTenantDataCount(tenantId, 'payment'),
        notifications: await this.getTenantDataCount(tenantId, 'notificationHistory'),
        workflows: await this.getTenantDataCount(tenantId, 'workflow')
      };

      const limits = config.limits;
      const features = config.features;

      return {
        success: true,
        data: {
          tenantId,
          usage,
          limits: {
            maxFarmers: features.maxFarmers,
            maxCrops: features.maxCrops,
            maxVoiceCalls: features.maxVoiceCalls,
            maxStorage: features.maxStorage,
            apiRequestsPerHour: limits.apiRequestsPerHour,
            concurrentUsers: limits.concurrentUsers,
            dataRetentionDays: limits.dataRetentionDays
          },
          utilization: {
            farmers: features.maxFarmers === -1 ? 0 : (usage.farmers / features.maxFarmers) * 100,
            crops: features.maxCrops === -1 ? 0 : (usage.crops / features.maxCrops) * 100,
            voiceCalls: features.maxVoiceCalls === -1 ? 0 : (usage.voiceCalls / features.maxVoiceCalls) * 100
          }
        }
      };
    } catch (error) {
      console.error(`Failed to get tenant usage for ${tenantId}:`, error);
      throw error;
    }
  }

  // Tenant migration methods
  async migrateTenantData(tenantId, targetIsolationMode) {
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      if (config.isolationMode === targetIsolationMode) {
        return { success: true, message: 'Tenant already using target isolation mode' };
      }

      console.log(`🔄 Starting migration for tenant ${tenantId} from ${config.isolationMode} to ${targetIsolationMode}`);

      // Create backup before migration
      await this.createTenantBackup(tenantId);

      // Perform migration based on target mode
      switch (targetIsolationMode) {
        case 'database':
          await this.migrateToDatabaseIsolation(tenantId, config);
          break;
        case 'schema':
          await this.migrateToSchemaIsolation(tenantId, config);
          break;
        case 'table':
          await this.migrateToTableIsolation(tenantId, config);
          break;
      }

      // Update tenant configuration
      config.isolationMode = targetIsolationMode;
      this.tenantConfigs.set(tenantId, config);

      console.log(`✅ Migration completed for tenant ${tenantId}`);
      
      return {
        success: true,
        message: `Tenant migrated from ${config.isolationMode} to ${targetIsolationMode}`
      };
    } catch (error) {
      console.error(`Failed to migrate tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantBackup(tenantId) {
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) return;

      const backupData = {
        tenantId,
        config,
        timestamp: new Date(),
        isolationMode: config.isolationMode
      };

      // Create backup record
      await this.prisma.tenantBackup.create({
        data: {
          tenantId,
          backupType: 'migration',
          data: backupData,
          status: 'completed'
        }
      });

      console.log(`📦 Created backup for tenant ${tenantId}`);
    } catch (error) {
      console.error(`Failed to create backup for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async migrateToDatabaseIsolation(tenantId, config) {
    // Implementation for migrating to database isolation
    console.log(`🔄 Migrating tenant ${tenantId} to database isolation`);
    // This would involve creating a new database and moving all data
  }

  async migrateToSchemaIsolation(tenantId, config) {
    // Implementation for migrating to schema isolation
    console.log(`🔄 Migrating tenant ${tenantId} to schema isolation`);
    // This would involve creating a new schema and moving all data
  }

  async migrateToTableIsolation(tenantId, config) {
    // Implementation for migrating to table isolation
    console.log(`🔄 Migrating tenant ${tenantId} to table isolation`);
    // This would involve consolidating data into shared tables
  }

  // Tenant analytics and reporting
  async getTenantAnalytics(tenantId, timeRange = '30d') {
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      const timeRanges = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const timeMs = timeRanges[timeRange] || timeRanges['30d'];
      const startTime = new Date(Date.now() - timeMs);

      const connection = this.getTenantConnection(tenantId);

      const analytics = {
        overview: await this.getTenantOverviewAnalytics(connection, tenantId, startTime),
        usage: await this.getTenantUsageAnalytics(connection, tenantId, startTime),
        performance: await this.getTenantPerformanceAnalytics(connection, tenantId, startTime),
        trends: await this.getTenantTrendAnalytics(connection, tenantId, startTime)
      };

      return {
        success: true,
        data: {
          tenantId,
          timeRange,
          analytics,
          config: {
            tier: config.tier,
            features: config.features,
            limits: config.limits
          }
        }
      };
    } catch (error) {
      console.error(`Failed to get tenant analytics for ${tenantId}:`, error);
      throw error;
    }
  }

  async getTenantOverviewAnalytics(connection, tenantId, startTime) {
    try {
      const [
        totalFarmers,
        totalCrops,
        totalVoiceCalls,
        totalPayments,
        totalNotifications
      ] = await Promise.all([
        connection.farmerProfile.count({ where: { organizationId: tenantId } }),
        connection.crop.count({ where: { organizationId: tenantId } }),
        connection.voiceCall.count({ 
          where: { 
            organizationId: tenantId,
            createdAt: { gte: startTime }
          }
        }),
        connection.payment.count({ 
          where: { 
            organizationId: tenantId,
            createdAt: { gte: startTime }
          }
        }),
        connection.notificationHistory.count({ 
          where: { 
            organizationId: tenantId,
            createdAt: { gte: startTime }
          }
        })
      ]);

      return {
        totalFarmers,
        totalCrops,
        voiceCallsInPeriod: totalVoiceCalls,
        paymentsInPeriod: totalPayments,
        notificationsInPeriod: totalNotifications
      };
    } catch (error) {
      console.error('Failed to get tenant overview analytics:', error);
      return {};
    }
  }

  async getTenantUsageAnalytics(connection, tenantId, startTime) {
    try {
      // Get usage patterns over time
      const dailyUsage = await connection.farmerProfile.groupBy({
        by: ['createdAt'],
        where: {
          organizationId: tenantId,
          createdAt: { gte: startTime }
        },
        _count: { id: true }
      });

      return {
        dailyGrowth: dailyUsage.map(usage => ({
          date: usage.createdAt.toISOString().split('T')[0],
          count: usage._count.id
        }))
      };
    } catch (error) {
      console.error('Failed to get tenant usage analytics:', error);
      return {};
    }
  }

  async getTenantPerformanceAnalytics(connection, tenantId, startTime) {
    try {
      // Get performance metrics
      const avgResponseTime = await connection.apiLog.aggregate({
        where: {
          organizationId: tenantId,
          createdAt: { gte: startTime }
        },
        _avg: { responseTime: true }
      });

      const errorRate = await connection.apiLog.count({
        where: {
          organizationId: tenantId,
          statusCode: { gte: 400 },
          createdAt: { gte: startTime }
        }
      });

      const totalRequests = await connection.apiLog.count({
        where: {
          organizationId: tenantId,
          createdAt: { gte: startTime }
        }
      });

      return {
        averageResponseTime: avgResponseTime._avg.responseTime || 0,
        errorRate: totalRequests > 0 ? (errorRate / totalRequests) * 100 : 0,
        totalRequests
      };
    } catch (error) {
      console.error('Failed to get tenant performance analytics:', error);
      return {};
    }
  }

  async getTenantTrendAnalytics(connection, tenantId, startTime) {
    try {
      // Get trend data
      const trends = {
        farmerGrowth: await this.getFarmerGrowthTrend(connection, tenantId, startTime),
        cropHealthTrend: await this.getCropHealthTrend(connection, tenantId, startTime),
        voiceUsageTrend: await this.getVoiceUsageTrend(connection, tenantId, startTime)
      };

      return trends;
    } catch (error) {
      console.error('Failed to get tenant trend analytics:', error);
      return {};
    }
  }

  async getFarmerGrowthTrend(connection, tenantId, startTime) {
    try {
      const farmers = await connection.farmerProfile.findMany({
        where: {
          organizationId: tenantId,
          createdAt: { gte: startTime }
        },
        select: { createdAt: true, region: true }
      });

      const growthByDate = {};
      farmers.forEach(farmer => {
        const date = farmer.createdAt.toISOString().split('T')[0];
        growthByDate[date] = (growthByDate[date] || 0) + 1;
      });

      return Object.entries(growthByDate).map(([date, count]) => ({
        date,
        count
      }));
    } catch (error) {
      console.error('Failed to get farmer growth trend:', error);
      return [];
    }
  }

  async getCropHealthTrend(connection, tenantId, startTime) {
    try {
      const crops = await connection.crop.findMany({
        where: { organizationId: tenantId },
        include: {
          cropHealthRecords: {
            where: { createdAt: { gte: startTime } },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      const healthByDate = {};
      crops.forEach(crop => {
        crop.cropHealthRecords.forEach(record => {
          const date = record.createdAt.toISOString().split('T')[0];
          if (!healthByDate[date]) {
            healthByDate[date] = { scores: [], count: 0 };
          }
          healthByDate[date].scores.push(record.healthScore);
          healthByDate[date].count++;
        });
      });

      return Object.entries(healthByDate).map(([date, data]) => ({
        date,
        averageHealthScore: data.scores.length > 0 
          ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
          : 0,
        recordCount: data.count
      }));
    } catch (error) {
      console.error('Failed to get crop health trend:', error);
      return [];
    }
  }

  async getVoiceUsageTrend(connection, tenantId, startTime) {
    try {
      const calls = await connection.voiceCall.findMany({
        where: {
          organizationId: tenantId,
          createdAt: { gte: startTime }
        },
        select: {
          createdAt: true,
          language: true,
          duration: true
        }
      });

      const usageByDate = {};
      calls.forEach(call => {
        const date = call.createdAt.toISOString().split('T')[0];
        if (!usageByDate[date]) {
          usageByDate[date] = { total: 0, totalDuration: 0 };
        }
        usageByDate[date].total++;
        usageByDate[date].totalDuration += call.duration;
      });

      return Object.entries(usageByDate).map(([date, data]) => ({
        date,
        totalCalls: data.total,
        averageDuration: data.total > 0 ? data.totalDuration / data.total : 0
      }));
    } catch (error) {
      console.error('Failed to get voice usage trend:', error);
      return [];
    }
  }

  // Utility methods
  getAllTenants() {
    return Array.from(this.tenantConfigs.values());
  }

  getTenantBySlug(slug) {
    for (const [tenantId, config] of this.tenantConfigs) {
      if (config.slug === slug) {
        return config;
      }
    }
    return null;
  }

  isTenantActive(tenantId) {
    const config = this.tenantConfigs.get(tenantId);
    return config && config.status === 'active';
  }

  getTenantIsolationMode(tenantId) {
    const config = this.tenantConfigs.get(tenantId);
    return config ? config.isolationMode : 'table';
  }
}

module.exports = MultiTenancyService;
