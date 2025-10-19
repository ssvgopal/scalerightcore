// src/database/auto-setup.js - Zero-config database initialization
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

class DatabaseAutoSetup {
  constructor() {
    this.prisma = new PrismaClient();
    this.maxRetries = 5;
    this.retryDelay = 2000;
  }

  async initialize() {
    try {
      logger.info('Starting database auto-setup...');
      
      // Test connection
      await this.testConnection();
      
      // Run migrations
      await this.runMigrations();
      
      // Seed initial data
      await this.seedInitialData();
      
      logger.info('Database auto-setup completed successfully');
      return true;
    } catch (error) {
      logger.error('Database auto-setup failed:', error.message);
      return false;
    }
  }

  async testConnection() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.prisma.$connect();
        logger.info(`Database connection successful (attempt ${attempt})`);
        return;
      } catch (error) {
        logger.warn(`Database connection attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to connect to database after ${this.maxRetries} attempts`);
        }
        
        await this.delay(this.retryDelay);
      }
    }
  }

  async runMigrations() {
    try {
      logger.info('Running database migrations...');
      
      // Check if migrations are needed
      const migrationStatus = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        );
      `;
      
      if (!migrationStatus[0].exists) {
        logger.info('No migrations table found, database is fresh');
        return;
      }
      
      logger.info('Database migrations up to date');
    } catch (error) {
      logger.warn('Migration check failed, continuing with fresh database:', error.message);
    }
  }

  async seedInitialData() {
    try {
      logger.info('Seeding initial data...');
      
      // Check if system organization exists
      const systemOrg = await this.prisma.organization.findFirst({
        where: { slug: 'system' }
      });
      
      if (!systemOrg) {
        // Create system organization
        await this.prisma.organization.create({
          data: {
            name: 'System',
            slug: 'system',
            tier: 'enterprise',
            status: 'active',
            metadata: {
              type: 'system',
              description: 'System organization for platform operations'
            }
          }
        });
        logger.info('System organization created');
      }
      
      // Check if demo organizations exist
      const demoOrgs = await this.prisma.organization.findMany({
        where: { slug: { in: ['kankatala', 'kisaansay'] } }
      });
      
      if (demoOrgs.length === 0) {
        // Create demo organizations
        await this.prisma.organization.createMany({
          data: [
            {
              name: 'Kankatala',
              slug: 'kankatala',
              tier: 'premium',
              status: 'active',
              metadata: {
                type: 'client',
                industry: 'retail',
                description: 'Multi-store retail platform'
              }
            },
            {
              name: 'Kisaansay',
              slug: 'kisaansay',
              tier: 'premium',
              status: 'active',
              metadata: {
                type: 'client',
                industry: 'agritech',
                description: 'Farmer-focused agritech platform'
              }
            }
          ]
        });
        logger.info('Demo organizations created');
      }
      
      // Create admin user if none exists
      const adminUser = await this.prisma.user.findFirst({
        where: { email: 'admin@orchestrall.com' }
      });
      
      if (!adminUser) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await this.prisma.user.create({
          data: {
            email: 'admin@orchestrall.com',
            name: 'System Administrator',
            password: hashedPassword,
            status: 'active',
            organizationId: systemOrg?.id || (await this.prisma.organization.findFirst({ where: { slug: 'system' } })).id,
            metadata: {
              role: 'admin',
              permissions: ['all'],
              lastLoginAt: new Date()
            }
          }
        });
        logger.info('Admin user created (email: admin@orchestrall.com, password: admin123)');
      }
      
      logger.info('Initial data seeding completed');
    } catch (error) {
      logger.error('Data seeding failed:', error.message);
      throw error;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    try {
      await this.prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error.message);
    }
  }
}

module.exports = DatabaseAutoSetup;
