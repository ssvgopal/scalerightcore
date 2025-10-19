// src/core/database/ConnectionManager.js - Multi-tenant Database Connection Management
const { PrismaClient } = require('@prisma/client');
const logger = require('../../utils/logger');

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.defaultConnection = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing Connection Manager...');
      
      // Initialize default connection
      this.defaultConnection = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      });

      await this.defaultConnection.$connect();
      logger.info('Default database connection established');

      // Initialize demo organization connection
      await this.initializeDemoConnections();

      this.isInitialized = true;
      logger.info('Connection Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Connection Manager', error);
      throw error;
    }
  }

  async initializeDemoConnections() {
    try {
      // Create demo organizations if they don't exist
      const demoOrgs = [
        {
          id: 'kankatala-demo',
          name: 'Kankatala Silks (Demo)',
          slug: 'kankatala-demo',
          tier: 'enterprise'
        },
        {
          id: 'kisaansay-demo',
          name: 'Kisaansay AgriTech (Demo)',
          slug: 'kisaansay-demo',
          tier: 'enterprise'
        }
      ];

      for (const orgData of demoOrgs) {
        try {
          await this.defaultConnection.organization.upsert({
            where: { id: orgData.id },
            update: orgData,
            create: orgData
          });
          logger.info(`Demo organization created/updated: ${orgData.name}`);
        } catch (error) {
          logger.error(`Failed to create demo organization ${orgData.name}`, error);
        }
      }

    } catch (error) {
      logger.error('Failed to initialize demo connections', error);
    }
  }

  async getConnection(organizationId = 'default') {
    try {
      if (!this.isInitialized) {
        throw new Error('Connection Manager not initialized');
      }

      // Return default connection for demo/development
      if (organizationId === 'default' || organizationId === 'demo') {
        return this.defaultConnection;
      }

      // Check if we have a cached connection for this organization
      if (this.connections.has(organizationId)) {
        return this.connections.get(organizationId);
      }

      // For production, create organization-specific connection
      if (process.env.NODE_ENV === 'production') {
        return await this.createOrganizationConnection(organizationId);
      }

      // For development/demo, use default connection with organization context
      return this.defaultConnection;

    } catch (error) {
      logger.error(`Failed to get connection for organization ${organizationId}`, error);
      throw error;
    }
  }

  async createOrganizationConnection(organizationId) {
    try {
      // In production, each organization gets its own database
      const orgDatabaseUrl = `${process.env.DATABASE_URL}_${organizationId}`;
      
      const connection = new PrismaClient({
        datasources: {
          db: {
            url: orgDatabaseUrl
          }
        }
      });

      await connection.$connect();
      this.connections.set(organizationId, connection);
      
      logger.info(`Created dedicated connection for organization: ${organizationId}`);
      return connection;

    } catch (error) {
      logger.error(`Failed to create connection for organization ${organizationId}`, error);
      throw error;
    }
  }

  async getOrganizationContext(organizationId) {
    try {
      const connection = await this.getConnection(organizationId);
      
      // Add organization context to all queries
      return {
        prisma: connection,
        organizationId,
        isProduction: process.env.NODE_ENV === 'production',
        isDemo: organizationId === 'demo' || organizationId === 'default'
      };

    } catch (error) {
      logger.error(`Failed to get organization context for ${organizationId}`, error);
      throw error;
    }
  }

  async executeWithContext(organizationId, operation) {
    try {
      const context = await this.getOrganizationContext(organizationId);
      return await operation(context);

    } catch (error) {
      logger.error(`Failed to execute operation for organization ${organizationId}`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const healthStatus = {
        isInitialized: this.isInitialized,
        defaultConnection: false,
        organizationConnections: 0,
        timestamp: new Date().toISOString()
      };

      // Check default connection
      if (this.defaultConnection) {
        try {
          await this.defaultConnection.$queryRaw`SELECT 1`;
          healthStatus.defaultConnection = true;
        } catch (error) {
          logger.error('Default connection health check failed', error);
        }
      }

      // Check organization connections
      for (const [orgId, connection] of this.connections) {
        try {
          await connection.$queryRaw`SELECT 1`;
          healthStatus.organizationConnections++;
        } catch (error) {
          logger.error(`Organization connection health check failed for ${orgId}`, error);
        }
      }

      return healthStatus;

    } catch (error) {
      logger.error('Connection Manager health check failed', error);
      return {
        isInitialized: false,
        defaultConnection: false,
        organizationConnections: 0,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async closeConnection(organizationId) {
    try {
      if (organizationId === 'default' || organizationId === 'demo') {
        return; // Don't close default connection
      }

      const connection = this.connections.get(organizationId);
      if (connection) {
        await connection.$disconnect();
        this.connections.delete(organizationId);
        logger.info(`Closed connection for organization: ${organizationId}`);
      }

    } catch (error) {
      logger.error(`Failed to close connection for organization ${organizationId}`, error);
    }
  }

  async closeAllConnections() {
    try {
      logger.info('Closing all database connections...');

      // Close organization connections
      for (const [orgId, connection] of this.connections) {
        try {
          await connection.$disconnect();
          logger.info(`Closed connection for organization: ${orgId}`);
        } catch (error) {
          logger.error(`Failed to close connection for ${orgId}`, error);
        }
      }

      this.connections.clear();

      // Close default connection
      if (this.defaultConnection) {
        await this.defaultConnection.$disconnect();
        logger.info('Closed default database connection');
      }

      this.isInitialized = false;
      logger.info('All database connections closed');

    } catch (error) {
      logger.error('Failed to close all connections', error);
      throw error;
    }
  }

  // Utility methods
  getConnectionCount() {
    return this.connections.size;
  }

  getConnectedOrganizations() {
    return Array.from(this.connections.keys());
  }

  isOrganizationConnected(organizationId) {
    return this.connections.has(organizationId);
  }
}

module.exports = ConnectionManager;
