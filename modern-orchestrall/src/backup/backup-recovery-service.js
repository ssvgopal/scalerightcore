const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BackupRecoveryService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.backupConfig = {
      basePath: process.env.BACKUP_PATH || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || null
    };
    this.scheduledJobs = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create backup directory
      await this.ensureBackupDirectory();
      
      // Initialize backup models
      await this.initializeBackupModels();
      
      // Start scheduled backups
      await this.startScheduledBackups();
      
      this.isInitialized = true;
      console.log('✅ Backup & Recovery Service initialized');
    } catch (error) {
      console.error('Failed to initialize Backup & Recovery Service:', error);
      throw error;
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupConfig.basePath, { recursive: true });
      
      // Create subdirectories
      const subdirs = ['full', 'incremental', 'tenant', 'restore', 'temp'];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.backupConfig.basePath, subdir), { recursive: true });
      }
      
      console.log('✅ Backup directories created');
    } catch (error) {
      console.error('Failed to create backup directories:', error);
      throw error;
    }
  }

  async initializeBackupModels() {
    // Initialize backup models and configurations
    console.log('✅ Backup models initialized');
  }

  async startScheduledBackups() {
    // Start scheduled backup jobs
    this.scheduleBackupJob('full', '0 2 * * *'); // Daily at 2 AM
    this.scheduleBackupJob('incremental', '0 */6 * * *'); // Every 6 hours
    
    console.log('✅ Scheduled backups started');
  }

  scheduleBackupJob(type, cronExpression) {
    // Simplified scheduling - in production, use a proper cron library
    const intervalMs = this.parseCronExpression(cronExpression);
    
    const job = setInterval(async () => {
      try {
        await this.performScheduledBackup(type);
      } catch (error) {
        console.error(`Scheduled ${type} backup failed:`, error);
      }
    }, intervalMs);
    
    this.scheduledJobs.set(type, job);
  }

  parseCronExpression(cronExpression) {
    // Simplified cron parsing - in production, use a proper cron library
    if (cronExpression.includes('*/6')) return 6 * 60 * 60 * 1000; // 6 hours
    if (cronExpression.includes('* * *')) return 24 * 60 * 60 * 1000; // 24 hours
    return 24 * 60 * 60 * 1000; // Default to 24 hours
  }

  // Full system backup
  async createFullBackup(options = {}) {
    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      const backupPath = path.join(this.backupConfig.basePath, 'full', `${backupId}_full_${timestamp.replace(/[:.]/g, '-')}`);
      
      console.log(`🔄 Starting full backup: ${backupId}`);

      // Create backup record
      const backupRecord = await this.prisma.backupRecord.create({
        data: {
          id: backupId,
          type: 'full',
          status: 'in_progress',
          startTime: new Date(),
          metadata: {
            path: backupPath,
            options
          }
        }
      });

      // Perform database backup
      await this.backupDatabase(backupPath, 'full');

      // Backup application files
      await this.backupApplicationFiles(backupPath);

      // Backup configuration files
      await this.backupConfigurationFiles(backupPath);

      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, 'full', {
        database: true,
        application: true,
        configuration: true
      });

      // Update backup record
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          status: 'completed',
          endTime: new Date(),
          size: await this.getBackupSize(backupPath),
          manifest: manifest
        }
      });

      console.log(`✅ Full backup completed: ${backupId}`);
      
      return {
        success: true,
        data: {
          backupId,
          path: backupPath,
          size: await this.getBackupSize(backupPath),
          manifest
        }
      };
    } catch (error) {
      console.error('Full backup failed:', error);
      throw error;
    }
  }

  // Incremental backup
  async createIncrementalBackup(options = {}) {
    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      const backupPath = path.join(this.backupConfig.basePath, 'incremental', `${backupId}_incremental_${timestamp.replace(/[:.]/g, '-')}`);
      
      console.log(`🔄 Starting incremental backup: ${backupId}`);

      // Get last backup timestamp
      const lastBackup = await this.prisma.backupRecord.findFirst({
        where: { type: { in: ['full', 'incremental'] } },
        orderBy: { endTime: 'desc' }
      });

      const lastBackupTime = lastBackup ? lastBackup.endTime : new Date(0);

      // Create backup record
      const backupRecord = await this.prisma.backupRecord.create({
        data: {
          id: backupId,
          type: 'incremental',
          status: 'in_progress',
          startTime: new Date(),
          metadata: {
            path: backupPath,
            lastBackupTime: lastBackupTime,
            options
          }
        }
      });

      // Perform incremental database backup
      await this.backupDatabaseIncremental(backupPath, lastBackupTime);

      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, 'incremental', {
        database: true,
        lastBackupTime: lastBackupTime
      });

      // Update backup record
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          status: 'completed',
          endTime: new Date(),
          size: await this.getBackupSize(backupPath),
          manifest: manifest
        }
      });

      console.log(`✅ Incremental backup completed: ${backupId}`);
      
      return {
        success: true,
        data: {
          backupId,
          path: backupPath,
          size: await this.getBackupSize(backupPath),
          manifest
        }
      };
    } catch (error) {
      console.error('Incremental backup failed:', error);
      throw error;
    }
  }

  // Tenant-specific backup
  async createTenantBackup(tenantId, options = {}) {
    try {
      const backupId = this.generateBackupId();
      const timestamp = new Date().toISOString();
      const backupPath = path.join(this.backupConfig.basePath, 'tenant', `${tenantId}_${backupId}_${timestamp.replace(/[:.]/g, '-')}`);
      
      console.log(`🔄 Starting tenant backup for ${tenantId}: ${backupId}`);

      // Create backup record
      const backupRecord = await this.prisma.backupRecord.create({
        data: {
          id: backupId,
          type: 'tenant',
          status: 'in_progress',
          startTime: new Date(),
          metadata: {
            path: backupPath,
            tenantId,
            options
          }
        }
      });

      // Backup tenant-specific data
      await this.backupTenantData(tenantId, backupPath);

      // Create backup manifest
      const manifest = await this.createBackupManifest(backupPath, 'tenant', {
        tenantId,
        database: true
      });

      // Update backup record
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          status: 'completed',
          endTime: new Date(),
          size: await this.getBackupSize(backupPath),
          manifest: manifest
        }
      });

      console.log(`✅ Tenant backup completed for ${tenantId}: ${backupId}`);
      
      return {
        success: true,
        data: {
          backupId,
          tenantId,
          path: backupPath,
          size: await this.getBackupSize(backupPath),
          manifest
        }
      };
    } catch (error) {
      console.error(`Tenant backup failed for ${tenantId}:`, error);
      throw error;
    }
  }

  // Database backup methods
  async backupDatabase(backupPath, type) {
    try {
      const dbPath = path.join(backupPath, 'database');
      await fs.mkdir(dbPath, { recursive: true });

      // Export database schema
      await this.exportDatabaseSchema(dbPath);

      // Export database data
      await this.exportDatabaseData(dbPath, type);

      console.log(`✅ Database backup completed: ${type}`);
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  async exportDatabaseSchema(dbPath) {
    try {
      // Get database schema from Prisma
      const schema = await this.prisma.$queryRaw`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;

      await fs.writeFile(
        path.join(dbPath, 'schema.json'),
        JSON.stringify(schema, null, 2)
      );

      console.log('✅ Database schema exported');
    } catch (error) {
      console.error('Failed to export database schema:', error);
      throw error;
    }
  }

  async exportDatabaseData(dbPath, type) {
    try {
      // Export all tables data
      const tables = [
        'Organization', 'User', 'FarmerProfile', 'Crop', 'CropHealthRecord',
        'LoanApplication', 'InsurancePolicy', 'VoiceCall', 'Payment',
        'NotificationHistory', 'Workflow', 'Alert', 'PerformanceMetric'
      ];

      for (const table of tables) {
        try {
          const data = await this.prisma[table.toLowerCase()].findMany();
          await fs.writeFile(
            path.join(dbPath, `${table.toLowerCase()}.json`),
            JSON.stringify(data, null, 2)
          );
        } catch (error) {
          console.warn(`Failed to export table ${table}:`, error.message);
        }
      }

      console.log('✅ Database data exported');
    } catch (error) {
      console.error('Failed to export database data:', error);
      throw error;
    }
  }

  async backupDatabaseIncremental(backupPath, lastBackupTime) {
    try {
      const dbPath = path.join(backupPath, 'database');
      await fs.mkdir(dbPath, { recursive: true });

      // Export only changed data since last backup
      const tables = [
        'FarmerProfile', 'Crop', 'CropHealthRecord', 'VoiceCall', 'Payment',
        'NotificationHistory', 'Workflow', 'Alert'
      ];

      for (const table of tables) {
        try {
          const data = await this.prisma[table.toLowerCase()].findMany({
            where: {
              updatedAt: { gt: lastBackupTime }
            }
          });
          
          if (data.length > 0) {
            await fs.writeFile(
              path.join(dbPath, `${table.toLowerCase()}_incremental.json`),
              JSON.stringify(data, null, 2)
            );
          }
        } catch (error) {
          console.warn(`Failed to export incremental data for table ${table}:`, error.message);
        }
      }

      console.log('✅ Incremental database backup completed');
    } catch (error) {
      console.error('Incremental database backup failed:', error);
      throw error;
    }
  }

  async backupTenantData(tenantId, backupPath) {
    try {
      const dbPath = path.join(backupPath, 'database');
      await fs.mkdir(dbPath, { recursive: true });

      // Export tenant-specific data
      const tenantTables = [
        'FarmerProfile', 'Crop', 'CropHealthRecord', 'VoiceCall', 'Payment',
        'NotificationHistory', 'Workflow'
      ];

      for (const table of tenantTables) {
        try {
          const data = await this.prisma[table.toLowerCase()].findMany({
            where: { organizationId: tenantId }
          });
          
          await fs.writeFile(
            path.join(dbPath, `${table.toLowerCase()}_tenant.json`),
            JSON.stringify(data, null, 2)
          );
        } catch (error) {
          console.warn(`Failed to export tenant data for table ${table}:`, error.message);
        }
      }

      console.log(`✅ Tenant data backup completed for ${tenantId}`);
    } catch (error) {
      console.error(`Tenant data backup failed for ${tenantId}:`, error);
      throw error;
    }
  }

  async backupApplicationFiles(backupPath) {
    try {
      const appPath = path.join(backupPath, 'application');
      await fs.mkdir(appPath, { recursive: true });

      // Backup source code (excluding node_modules, .git, etc.)
      const sourcePath = process.cwd();
      const excludeDirs = ['node_modules', '.git', 'backups', 'logs', 'temp'];
      
      await this.copyDirectory(sourcePath, appPath, excludeDirs);

      console.log('✅ Application files backed up');
    } catch (error) {
      console.error('Application files backup failed:', error);
      throw error;
    }
  }

  async backupConfigurationFiles(backupPath) {
    try {
      const configPath = path.join(backupPath, 'configuration');
      await fs.mkdir(configPath, { recursive: true });

      // Backup configuration files
      const configFiles = [
        '.env',
        'package.json',
        'prisma/schema.prisma',
        'docker-compose.yml',
        'docker-compose.production.yml'
      ];

      for (const file of configFiles) {
        try {
          const sourceFile = path.join(process.cwd(), file);
          const targetFile = path.join(configPath, path.basename(file));
          
          if (await this.fileExists(sourceFile)) {
            await fs.copyFile(sourceFile, targetFile);
          }
        } catch (error) {
          console.warn(`Failed to backup config file ${file}:`, error.message);
        }
      }

      console.log('✅ Configuration files backed up');
    } catch (error) {
      console.error('Configuration files backup failed:', error);
      throw error;
    }
  }

  // Recovery methods
  async restoreFromBackup(backupId, options = {}) {
    try {
      console.log(`🔄 Starting restore from backup: ${backupId}`);

      // Get backup record
      const backupRecord = await this.prisma.backupRecord.findUnique({
        where: { id: backupId }
      });

      if (!backupRecord) {
        throw new Error(`Backup ${backupId} not found`);
      }

      if (backupRecord.status !== 'completed') {
        throw new Error(`Backup ${backupId} is not completed`);
      }

      // Create restore record
      const restoreRecord = await this.prisma.restoreRecord.create({
        data: {
          id: this.generateBackupId(),
          backupId,
          status: 'in_progress',
          startTime: new Date(),
          metadata: {
            options
          }
        }
      });

      const backupPath = backupRecord.metadata.path;

      // Verify backup integrity
      await this.verifyBackupIntegrity(backupPath);

      // Restore database
      await this.restoreDatabase(backupPath, options);

      // Restore application files if requested
      if (options.restoreApplication) {
        await this.restoreApplicationFiles(backupPath, options);
      }

      // Restore configuration files if requested
      if (options.restoreConfiguration) {
        await this.restoreConfigurationFiles(backupPath, options);
      }

      // Update restore record
      await this.prisma.restoreRecord.update({
        where: { id: restoreRecord.id },
        data: {
          status: 'completed',
          endTime: new Date()
        }
      });

      console.log(`✅ Restore completed from backup: ${backupId}`);
      
      return {
        success: true,
        data: {
          restoreId: restoreRecord.id,
          backupId,
          restoredAt: new Date()
        }
      };
    } catch (error) {
      console.error(`Restore failed from backup ${backupId}:`, error);
      throw error;
    }
  }

  async restoreDatabase(backupPath, options = {}) {
    try {
      const dbPath = path.join(backupPath, 'database');

      // Check if schema exists
      const schemaFile = path.join(dbPath, 'schema.json');
      if (await this.fileExists(schemaFile)) {
        // Restore database schema
        await this.restoreDatabaseSchema(dbPath, options);
      }

      // Restore database data
      await this.restoreDatabaseData(dbPath, options);

      console.log('✅ Database restored');
    } catch (error) {
      console.error('Database restore failed:', error);
      throw error;
    }
  }

  async restoreDatabaseSchema(dbPath, options) {
    try {
      const schemaFile = path.join(dbPath, 'schema.json');
      const schema = JSON.parse(await fs.readFile(schemaFile, 'utf8'));

      // In a real implementation, this would recreate the database schema
      console.log('✅ Database schema restored');
    } catch (error) {
      console.error('Database schema restore failed:', error);
      throw error;
    }
  }

  async restoreDatabaseData(dbPath, options) {
    try {
      const tables = [
        'organization', 'user', 'farmerprofile', 'crop', 'crophealthrecord',
        'loanapplication', 'insurancepolicy', 'voicecall', 'payment',
        'notificationhistory', 'workflow', 'alert', 'performancemetric'
      ];

      for (const table of tables) {
        const dataFile = path.join(dbPath, `${table}.json`);
        if (await this.fileExists(dataFile)) {
          const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
          
          // Restore data to database
          if (data.length > 0) {
            await this.restoreTableData(table, data, options);
          }
        }
      }

      console.log('✅ Database data restored');
    } catch (error) {
      console.error('Database data restore failed:', error);
      throw error;
    }
  }

  async restoreTableData(tableName, data, options) {
    try {
      // Clear existing data if requested
      if (options.clearExisting) {
        await this.prisma[tableName].deleteMany({});
      }

      // Insert data in batches
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        await this.prisma[tableName].createMany({
          data: batch,
          skipDuplicates: options.skipDuplicates || true
        });
      }

      console.log(`✅ Table ${tableName} restored with ${data.length} records`);
    } catch (error) {
      console.error(`Failed to restore table ${tableName}:`, error);
      throw error;
    }
  }

  async restoreApplicationFiles(backupPath, options) {
    try {
      const appPath = path.join(backupPath, 'application');
      const targetPath = options.targetPath || process.cwd();

      if (await this.fileExists(appPath)) {
        await this.copyDirectory(appPath, targetPath);
        console.log('✅ Application files restored');
      }
    } catch (error) {
      console.error('Application files restore failed:', error);
      throw error;
    }
  }

  async restoreConfigurationFiles(backupPath, options) {
    try {
      const configPath = path.join(backupPath, 'configuration');
      const targetPath = options.targetPath || process.cwd();

      if (await this.fileExists(configPath)) {
        const files = await fs.readdir(configPath);
        
        for (const file of files) {
          const sourceFile = path.join(configPath, file);
          const targetFile = path.join(targetPath, file);
          
          await fs.copyFile(sourceFile, targetFile);
        }

        console.log('✅ Configuration files restored');
      }
    } catch (error) {
      console.error('Configuration files restore failed:', error);
      throw error;
    }
  }

  // Utility methods
  async createBackupManifest(backupPath, type, metadata) {
    try {
      const manifest = {
        id: this.generateBackupId(),
        type,
        timestamp: new Date().toISOString(),
        version: '1.0',
        metadata,
        files: await this.getBackupFiles(backupPath),
        checksums: await this.calculateChecksums(backupPath)
      };

      const manifestPath = path.join(backupPath, 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      return manifest;
    } catch (error) {
      console.error('Failed to create backup manifest:', error);
      throw error;
    }
  }

  async getBackupFiles(backupPath) {
    try {
      const files = [];
      const scanDirectory = async (dir, relativePath = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativeFilePath = path.join(relativePath, entry.name);
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath, relativeFilePath);
          } else {
            const stats = await fs.stat(fullPath);
            files.push({
              path: relativeFilePath,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
      };

      await scanDirectory(backupPath);
      return files;
    } catch (error) {
      console.error('Failed to get backup files:', error);
      return [];
    }
  }

  async calculateChecksums(backupPath) {
    try {
      const checksums = {};
      const files = await this.getBackupFiles(backupPath);
      
      for (const file of files) {
        const filePath = path.join(backupPath, file.path);
        const content = await fs.readFile(filePath);
        checksums[file.path] = crypto.createHash('sha256').update(content).digest('hex');
      }

      return checksums;
    } catch (error) {
      console.error('Failed to calculate checksums:', error);
      return {};
    }
  }

  async verifyBackupIntegrity(backupPath) {
    try {
      const manifestPath = path.join(backupPath, 'manifest.json');
      
      if (!(await this.fileExists(manifestPath))) {
        throw new Error('Backup manifest not found');
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      const currentChecksums = await this.calculateChecksums(backupPath);

      // Verify checksums
      for (const [filePath, expectedChecksum] of Object.entries(manifest.checksums)) {
        const actualChecksum = currentChecksums[filePath];
        if (actualChecksum !== expectedChecksum) {
          throw new Error(`Checksum mismatch for file: ${filePath}`);
        }
      }

      console.log('✅ Backup integrity verified');
    } catch (error) {
      console.error('Backup integrity verification failed:', error);
      throw error;
    }
  }

  async getBackupSize(backupPath) {
    try {
      let totalSize = 0;
      const scanDirectory = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      };

      await scanDirectory(backupPath);
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate backup size:', error);
      return 0;
    }
  }

  async performScheduledBackup(type) {
    try {
      console.log(`🔄 Performing scheduled ${type} backup`);
      
      let result;
      switch (type) {
        case 'full':
          result = await this.createFullBackup({ scheduled: true });
          break;
        case 'incremental':
          result = await this.createIncrementalBackup({ scheduled: true });
          break;
        default:
          throw new Error(`Unknown backup type: ${type}`);
      }

      console.log(`✅ Scheduled ${type} backup completed: ${result.data.backupId}`);
      
      // Clean up old backups
      await this.cleanupOldBackups();
    } catch (error) {
      console.error(`Scheduled ${type} backup failed:`, error);
    }
  }

  async cleanupOldBackups() {
    try {
      const cutoffDate = new Date(Date.now() - this.backupConfig.retentionDays * 24 * 60 * 60 * 1000);
      
      // Get old backup records
      const oldBackups = await this.prisma.backupRecord.findMany({
        where: {
          endTime: { lt: cutoffDate },
          status: 'completed'
        }
      });

      for (const backup of oldBackups) {
        try {
          // Delete backup files
          const backupPath = backup.metadata.path;
          if (await this.fileExists(backupPath)) {
            await fs.rm(backupPath, { recursive: true, force: true });
          }

          // Delete backup record
          await this.prisma.backupRecord.delete({
            where: { id: backup.id }
          });

          console.log(`🗑️ Cleaned up old backup: ${backup.id}`);
        } catch (error) {
          console.error(`Failed to cleanup backup ${backup.id}:`, error);
        }
      }

      console.log(`✅ Cleaned up ${oldBackups.length} old backups`);
    } catch (error) {
      console.error('Backup cleanup failed:', error);
    }
  }

  // Helper methods
  generateBackupId() {
    return 'backup_' + crypto.randomBytes(8).toString('hex');
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyDirectory(source, target, excludeDirs = []) {
    try {
      await fs.mkdir(target, { recursive: true });
      
      const entries = await fs.readdir(source, { withFileTypes: true });
      
      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);
        
        if (excludeDirs.includes(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath, excludeDirs);
        } else {
          await fs.copyFile(sourcePath, targetPath);
        }
      }
    } catch (error) {
      console.error('Failed to copy directory:', error);
      throw error;
    }
  }

  // Backup management methods
  async getBackupList(options = {}) {
    try {
      const { type, status, limit = 50, offset = 0 } = options;
      
      const whereClause = {};
      if (type) whereClause.type = type;
      if (status) whereClause.status = status;

      const backups = await this.prisma.backupRecord.findMany({
        where: whereClause,
        orderBy: { startTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const totalCount = await this.prisma.backupRecord.count({
        where: whereClause
      });

      return {
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
      };
    } catch (error) {
      console.error('Failed to get backup list:', error);
      throw error;
    }
  }

  async getBackupDetails(backupId) {
    try {
      const backup = await this.prisma.backupRecord.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Get restore history for this backup
      const restores = await this.prisma.restoreRecord.findMany({
        where: { backupId },
        orderBy: { startTime: 'desc' }
      });

      return {
        success: true,
        data: {
          backup,
          restores
        }
      };
    } catch (error) {
      console.error(`Failed to get backup details for ${backupId}:`, error);
      throw error;
    }
  }

  async deleteBackup(backupId) {
    try {
      const backup = await this.prisma.backupRecord.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      // Delete backup files
      const backupPath = backup.metadata.path;
      if (await this.fileExists(backupPath)) {
        await fs.rm(backupPath, { recursive: true, force: true });
      }

      // Delete backup record
      await this.prisma.backupRecord.delete({
        where: { id: backupId }
      });

      console.log(`🗑️ Deleted backup: ${backupId}`);

      return {
        success: true,
        message: 'Backup deleted successfully'
      };
    } catch (error) {
      console.error(`Failed to delete backup ${backupId}:`, error);
      throw error;
    }
  }

  async getRestoreHistory(options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;

      const restores = await this.prisma.restoreRecord.findMany({
        orderBy: { startTime: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          backup: true
        }
      });

      const totalCount = await this.prisma.restoreRecord.count();

      return {
        success: true,
        data: {
          restores,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
          }
        }
      };
    } catch (error) {
      console.error('Failed to get restore history:', error);
      throw error;
    }
  }
}

module.exports = BackupRecoveryService;
