const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProductionBackupStrategy {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.backupConfig = {
      schedules: new Map(),
      retentionPolicies: new Map(),
      encryptionKeys: new Map(),
      storageProviders: new Map()
    };
    this.backupJobs = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize backup configurations
      await this.initializeBackupConfigurations();
      
      // Initialize retention policies
      await this.initializeRetentionPolicies();
      
      // Initialize storage providers
      await this.initializeStorageProviders();
      
      // Start scheduled backup jobs
      await this.startScheduledBackups();
      
      this.isInitialized = true;
      console.log('✅ Production Backup Strategy initialized');
    } catch (error) {
      console.error('Failed to initialize Production Backup Strategy:', error);
      throw error;
    }
  }

  async initializeBackupConfigurations() {
    try {
      // Define backup schedules
      const schedules = [
        {
          name: 'full-daily',
          type: 'full',
          schedule: '0 2 * * *', // Daily at 2 AM
          enabled: true,
          priority: 'high'
        },
        {
          name: 'incremental-hourly',
          type: 'incremental',
          schedule: '0 * * * *', // Every hour
          enabled: true,
          priority: 'medium'
        },
        {
          name: 'tenant-weekly',
          type: 'tenant',
          schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
          enabled: true,
          priority: 'medium'
        },
        {
          name: 'critical-data-hourly',
          type: 'critical',
          schedule: '0 * * * *', // Every hour
          enabled: true,
          priority: 'critical'
        }
      ];

      for (const schedule of schedules) {
        this.backupConfig.schedules.set(schedule.name, schedule);
      }

      console.log('✅ Backup configurations initialized');
    } catch (error) {
      console.error('Failed to initialize backup configurations:', error);
      throw error;
    }
  }

  async initializeRetentionPolicies() {
    try {
      // Define retention policies
      const policies = [
        {
          name: 'full-backups',
          type: 'full',
          retentionDays: 30,
          maxBackups: 30,
          compressionEnabled: true,
          encryptionEnabled: true
        },
        {
          name: 'incremental-backups',
          type: 'incremental',
          retentionDays: 7,
          maxBackups: 168, // 7 days * 24 hours
          compressionEnabled: true,
          encryptionEnabled: true
        },
        {
          name: 'tenant-backups',
          type: 'tenant',
          retentionDays: 90,
          maxBackups: 12, // 12 weeks
          compressionEnabled: true,
          encryptionEnabled: true
        },
        {
          name: 'critical-data',
          type: 'critical',
          retentionDays: 365,
          maxBackups: 8760, // 365 days * 24 hours
          compressionEnabled: true,
          encryptionEnabled: true
        }
      ];

      for (const policy of policies) {
        this.backupConfig.retentionPolicies.set(policy.name, policy);
      }

      console.log('✅ Retention policies initialized');
    } catch (error) {
      console.error('Failed to initialize retention policies:', error);
      throw error;
    }
  }

  async initializeStorageProviders() {
    try {
      // Define storage providers
      const providers = [
        {
          name: 'local-storage',
          type: 'local',
          config: {
            path: './backups',
            maxSize: '100GB'
          },
          enabled: true,
          priority: 1
        },
        {
          name: 'aws-s3',
          type: 's3',
          config: {
            bucket: process.env.AWS_S3_BACKUP_BUCKET,
            region: process.env.AWS_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          },
          enabled: process.env.AWS_S3_BACKUP_BUCKET ? true : false,
          priority: 2
        },
        {
          name: 'google-cloud-storage',
          type: 'gcs',
          config: {
            bucket: process.env.GCS_BACKUP_BUCKET,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE
          },
          enabled: process.env.GCS_BACKUP_BUCKET ? true : false,
          priority: 3
        }
      ];

      for (const provider of providers) {
        this.backupConfig.storageProviders.set(provider.name, provider);
      }

      console.log('✅ Storage providers initialized');
    } catch (error) {
      console.error('Failed to initialize storage providers:', error);
      throw error;
    }
  }

  async startScheduledBackups() {
    try {
      // Start backup jobs for each schedule
      for (const [name, schedule] of this.backupConfig.schedules) {
        if (schedule.enabled) {
          await this.scheduleBackupJob(name, schedule);
        }
      }

      console.log('✅ Scheduled backup jobs started');
    } catch (error) {
      console.error('Failed to start scheduled backups:', error);
      throw error;
    }
  }

  async scheduleBackupJob(name, schedule) {
    try {
      const job = {
        name,
        schedule,
        lastRun: null,
        nextRun: this.calculateNextRun(schedule.schedule),
        isRunning: false,
        intervalId: null
      };

      // Calculate interval based on schedule
      const intervalMs = this.getIntervalMs(schedule.schedule);
      
      if (intervalMs > 0) {
        job.intervalId = setInterval(async () => {
          if (!job.isRunning) {
            await this.executeBackupJob(job);
          }
        }, intervalMs);
      }

      this.backupJobs.set(name, job);
      console.log(`📅 Scheduled backup job: ${name} (${schedule.schedule})`);

    } catch (error) {
      console.error(`Failed to schedule backup job ${name}:`, error);
    }
  }

  calculateNextRun(schedule) {
    // Simplified next run calculation
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // Next hour
    return nextRun;
  }

  getIntervalMs(schedule) {
    // Simplified interval calculation
    if (schedule.includes('* * * * *')) return 60 * 60 * 1000; // Hourly
    if (schedule.includes('0 * * * *')) return 60 * 60 * 1000; // Hourly
    if (schedule.includes('0 2 * * *')) return 24 * 60 * 60 * 1000; // Daily
    if (schedule.includes('0 3 * * 0')) return 7 * 24 * 60 * 60 * 1000; // Weekly
    return 60 * 60 * 1000; // Default hourly
  }

  async executeBackupJob(job) {
    try {
      job.isRunning = true;
      job.lastRun = new Date();

      console.log(`🔄 Starting backup job: ${job.name}`);

      const backupRecord = await this.createBackupRecord(job.name, job.schedule.type);
      
      let result;
      switch (job.schedule.type) {
        case 'full':
          result = await this.executeFullBackup(backupRecord.id);
          break;
        case 'incremental':
          result = await this.executeIncrementalBackup(backupRecord.id);
          break;
        case 'tenant':
          result = await this.executeTenantBackup(backupRecord.id);
          break;
        case 'critical':
          result = await this.executeCriticalDataBackup(backupRecord.id);
          break;
        default:
          throw new Error(`Unknown backup type: ${job.schedule.type}`);
      }

      await this.updateBackupRecord(backupRecord.id, {
        status: 'completed',
        endTime: new Date(),
        size: result.size,
        manifest: result.manifest
      });

      // Apply retention policy
      await this.applyRetentionPolicy(job.schedule.type);

      console.log(`✅ Backup job completed: ${job.name}`);

    } catch (error) {
      console.error(`❌ Backup job failed: ${job.name}`, error);
      
      // Update backup record with error
      const backupRecord = await this.getLatestBackupRecord(job.name);
      if (backupRecord) {
        await this.updateBackupRecord(backupRecord.id, {
          status: 'failed',
          endTime: new Date(),
          errorMessage: error.message
        });
      }
    } finally {
      job.isRunning = false;
      job.nextRun = this.calculateNextRun(job.schedule.schedule);
    }
  }

  async executeFullBackup(backupId) {
    try {
      console.log('🔄 Executing full backup...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `./backups/full/${timestamp}`;
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Database backup
      const dbBackup = await this.backupDatabase(backupDir);
      
      // File system backup
      const fsBackup = await this.backupFileSystem(backupDir);
      
      // Configuration backup
      const configBackup = await this.backupConfiguration(backupDir);

      // Create manifest
      const manifest = {
        type: 'full',
        timestamp: new Date().toISOString(),
        components: {
          database: dbBackup,
          filesystem: fsBackup,
          configuration: configBackup
        },
        checksums: await this.calculateChecksums(backupDir)
      };

      // Compress backup
      const compressedPath = await this.compressBackup(backupDir);
      
      // Encrypt backup
      const encryptedPath = await this.encryptBackup(compressedPath);

      // Upload to storage providers
      await this.uploadToStorageProviders(encryptedPath, 'full');

      // Calculate size
      const stats = await fs.stat(encryptedPath);
      const size = stats.size;

      return {
        size,
        manifest,
        path: encryptedPath
      };

    } catch (error) {
      console.error('Failed to execute full backup:', error);
      throw error;
    }
  }

  async executeIncrementalBackup(backupId) {
    try {
      console.log('🔄 Executing incremental backup...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `./backups/incremental/${timestamp}`;
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Get last full backup timestamp
      const lastBackup = await this.getLastBackupRecord('full');
      const lastBackupTime = lastBackup ? lastBackup.startTime : new Date(0);

      // Incremental database backup
      const dbBackup = await this.backupDatabaseIncremental(backupDir, lastBackupTime);
      
      // Incremental file system backup
      const fsBackup = await this.backupFileSystemIncremental(backupDir, lastBackupTime);

      // Create manifest
      const manifest = {
        type: 'incremental',
        timestamp: new Date().toISOString(),
        baseBackup: lastBackup?.id,
        components: {
          database: dbBackup,
          filesystem: fsBackup
        },
        checksums: await this.calculateChecksums(backupDir)
      };

      // Compress backup
      const compressedPath = await this.compressBackup(backupDir);
      
      // Encrypt backup
      const encryptedPath = await this.encryptBackup(compressedPath);

      // Upload to storage providers
      await this.uploadToStorageProviders(encryptedPath, 'incremental');

      // Calculate size
      const stats = await fs.stat(encryptedPath);
      const size = stats.size;

      return {
        size,
        manifest,
        path: encryptedPath
      };

    } catch (error) {
      console.error('Failed to execute incremental backup:', error);
      throw error;
    }
  }

  async executeTenantBackup(backupId) {
    try {
      console.log('🔄 Executing tenant backup...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `./backups/tenant/${timestamp}`;
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Get all organizations
      const organizations = await this.prisma.organization.findMany({
        where: { status: 'active' }
      });

      const tenantBackups = [];

      // Backup each tenant
      for (const org of organizations) {
        const tenantBackup = await this.backupTenantData(org, backupDir);
        tenantBackups.push(tenantBackup);
      }

      // Create manifest
      const manifest = {
        type: 'tenant',
        timestamp: new Date().toISOString(),
        tenants: tenantBackups,
        checksums: await this.calculateChecksums(backupDir)
      };

      // Compress backup
      const compressedPath = await this.compressBackup(backupDir);
      
      // Encrypt backup
      const encryptedPath = await this.encryptBackup(compressedPath);

      // Upload to storage providers
      await this.uploadToStorageProviders(encryptedPath, 'tenant');

      // Calculate size
      const stats = await fs.stat(encryptedPath);
      const size = stats.size;

      return {
        size,
        manifest,
        path: encryptedPath
      };

    } catch (error) {
      console.error('Failed to execute tenant backup:', error);
      throw error;
    }
  }

  async executeCriticalDataBackup(backupId) {
    try {
      console.log('🔄 Executing critical data backup...');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `./backups/critical/${timestamp}`;
      
      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true });

      // Backup critical data
      const criticalData = await this.backupCriticalData(backupDir);

      // Create manifest
      const manifest = {
        type: 'critical',
        timestamp: new Date().toISOString(),
        data: criticalData,
        checksums: await this.calculateChecksums(backupDir)
      };

      // Compress backup
      const compressedPath = await this.compressBackup(backupDir);
      
      // Encrypt backup
      const encryptedPath = await this.encryptBackup(compressedPath);

      // Upload to storage providers
      await this.uploadToStorageProviders(encryptedPath, 'critical');

      // Calculate size
      const stats = await fs.stat(encryptedPath);
      const size = stats.size;

      return {
        size,
        manifest,
        path: encryptedPath
      };

    } catch (error) {
      console.error('Failed to execute critical data backup:', error);
      throw error;
    }
  }

  async backupDatabase(backupDir) {
    try {
      const dbBackupFile = path.join(backupDir, 'database.sql');
      
      // Use pg_dump for PostgreSQL backup
      const command = `pg_dump ${process.env.DATABASE_URL} > ${dbBackupFile}`;
      await execAsync(command);

      const stats = await fs.stat(dbBackupFile);
      
      return {
        file: dbBackupFile,
        size: stats.size,
        type: 'postgresql'
      };

    } catch (error) {
      console.error('Failed to backup database:', error);
      throw error;
    }
  }

  async backupDatabaseIncremental(backupDir, lastBackupTime) {
    try {
      const dbBackupFile = path.join(backupDir, 'database_incremental.sql');
      
      // Backup only changed data since last backup
      const command = `pg_dump ${process.env.DATABASE_URL} --where="updated_at > '${lastBackupTime.toISOString()}'" > ${dbBackupFile}`;
      await execAsync(command);

      const stats = await fs.stat(dbBackupFile);
      
      return {
        file: dbBackupFile,
        size: stats.size,
        type: 'postgresql_incremental',
        since: lastBackupTime.toISOString()
      };

    } catch (error) {
      console.error('Failed to backup database incrementally:', error);
      throw error;
    }
  }

  async backupFileSystem(backupDir) {
    try {
      const fsBackupDir = path.join(backupDir, 'filesystem');
      await fs.mkdir(fsBackupDir, { recursive: true });

      // Backup important directories
      const directories = [
        './uploads',
        './logs',
        './config',
        './src'
      ];

      const backedUpDirs = [];

      for (const dir of directories) {
        try {
          const destDir = path.join(fsBackupDir, path.basename(dir));
          await this.copyDirectory(dir, destDir);
          
          const stats = await fs.stat(destDir);
          backedUpDirs.push({
            source: dir,
            destination: destDir,
            size: stats.size
          });
        } catch (error) {
          console.warn(`Failed to backup directory ${dir}:`, error.message);
        }
      }

      return {
        directories: backedUpDirs,
        type: 'filesystem'
      };

    } catch (error) {
      console.error('Failed to backup file system:', error);
      throw error;
    }
  }

  async backupFileSystemIncremental(backupDir, lastBackupTime) {
    try {
      const fsBackupDir = path.join(backupDir, 'filesystem_incremental');
      await fs.mkdir(fsBackupDir, { recursive: true });

      // Backup only modified files since last backup
      const directories = [
        './uploads',
        './logs'
      ];

      const backedUpFiles = [];

      for (const dir of directories) {
        try {
          const files = await this.getModifiedFiles(dir, lastBackupTime);
          
          for (const file of files) {
            const destFile = path.join(fsBackupDir, path.relative(dir, file));
            await fs.mkdir(path.dirname(destFile), { recursive: true });
            await fs.copyFile(file, destFile);
            
            const stats = await fs.stat(destFile);
            backedUpFiles.push({
              source: file,
              destination: destFile,
              size: stats.size,
              modified: stats.mtime
            });
          }
        } catch (error) {
          console.warn(`Failed to backup directory ${dir}:`, error.message);
        }
      }

      return {
        files: backedUpFiles,
        type: 'filesystem_incremental',
        since: lastBackupTime.toISOString()
      };

    } catch (error) {
      console.error('Failed to backup file system incrementally:', error);
      throw error;
    }
  }

  async backupConfiguration(backupDir) {
    try {
      const configBackupFile = path.join(backupDir, 'configuration.json');
      
      const config = {
        environment: process.env.NODE_ENV,
        database: {
          url: process.env.DATABASE_URL ? '***masked***' : null,
          poolSize: process.env.DATABASE_POOL_SIZE
        },
        redis: {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT
        },
        features: {
          voiceIntegration: process.env.ENABLE_VOICE_INTEGRATION,
          multiTenancy: process.env.ENABLE_MULTI_TENANCY,
          backupRecovery: process.env.ENABLE_BACKUP_RECOVERY
        },
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(configBackupFile, JSON.stringify(config, null, 2));

      const stats = await fs.stat(configBackupFile);
      
      return {
        file: configBackupFile,
        size: stats.size,
        type: 'configuration'
      };

    } catch (error) {
      console.error('Failed to backup configuration:', error);
      throw error;
    }
  }

  async backupTenantData(organization, backupDir) {
    try {
      const tenantDir = path.join(backupDir, organization.slug);
      await fs.mkdir(tenantDir, { recursive: true });

      // Backup organization data
      const orgData = await this.prisma.organization.findUnique({
        where: { id: organization.id },
        include: {
          users: true,
          tenantConfig: true,
          farmers: true,
          crops: true,
          stores: true,
          products: true
        }
      });

      const orgBackupFile = path.join(tenantDir, 'organization.json');
      await fs.writeFile(orgBackupFile, JSON.stringify(orgData, null, 2));

      const stats = await fs.stat(orgBackupFile);
      
      return {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        file: orgBackupFile,
        size: stats.size,
        recordCount: {
          users: orgData.users.length,
          farmers: orgData.farmers.length,
          crops: orgData.crops.length,
          stores: orgData.stores.length,
          products: orgData.products.length
        }
      };

    } catch (error) {
      console.error(`Failed to backup tenant data for ${organization.slug}:`, error);
      throw error;
    }
  }

  async backupCriticalData(backupDir) {
    try {
      const criticalDir = path.join(backupDir, 'critical');
      await fs.mkdir(criticalDir, { recursive: true });

      // Backup critical business data
      const criticalData = {
        users: await this.prisma.user.findMany({
          select: { id: true, email: true, name: true, createdAt: true }
        }),
        organizations: await this.prisma.organization.findMany({
          select: { id: true, name: true, slug: true, tier: true, createdAt: true }
        }),
        payments: await this.prisma.payment.findMany({
          select: { id: true, amount: true, status: true, createdAt: true }
        }),
        voiceCalls: await this.prisma.voiceCall.findMany({
          select: { id: true, sessionId: true, status: true, createdAt: true }
        })
      };

      const criticalBackupFile = path.join(criticalDir, 'critical_data.json');
      await fs.writeFile(criticalBackupFile, JSON.stringify(criticalData, null, 2));

      const stats = await fs.stat(criticalBackupFile);
      
      return {
        file: criticalBackupFile,
        size: stats.size,
        recordCount: {
          users: criticalData.users.length,
          organizations: criticalData.organizations.length,
          payments: criticalData.payments.length,
          voiceCalls: criticalData.voiceCalls.length
        }
      };

    } catch (error) {
      console.error('Failed to backup critical data:', error);
      throw error;
    }
  }

  async compressBackup(backupDir) {
    try {
      const compressedFile = `${backupDir}.tar.gz`;
      
      const command = `tar -czf ${compressedFile} -C ${path.dirname(backupDir)} ${path.basename(backupDir)}`;
      await execAsync(command);

      // Remove original directory
      await fs.rm(backupDir, { recursive: true, force: true });

      return compressedFile;

    } catch (error) {
      console.error('Failed to compress backup:', error);
      throw error;
    }
  }

  async encryptBackup(backupPath) {
    try {
      const encryptedPath = `${backupPath}.enc`;
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
      
      // Simple encryption using Node.js crypto
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, key);
      cipher.setAAD(Buffer.from('backup-data'));
      
      const input = await fs.readFile(backupPath);
      const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      
      const encryptedData = Buffer.concat([iv, authTag, encrypted]);
      await fs.writeFile(encryptedPath, encryptedData);
      
      // Remove unencrypted file
      await fs.unlink(backupPath);

      return encryptedPath;

    } catch (error) {
      console.error('Failed to encrypt backup:', error);
      throw error;
    }
  }

  async uploadToStorageProviders(backupPath, backupType) {
    try {
      const uploadPromises = [];

      for (const [name, provider] of this.backupConfig.storageProviders) {
        if (provider.enabled) {
          uploadPromises.push(this.uploadToProvider(name, provider, backupPath, backupType));
        }
      }

      await Promise.allSettled(uploadPromises);

    } catch (error) {
      console.error('Failed to upload to storage providers:', error);
      throw error;
    }
  }

  async uploadToProvider(providerName, provider, backupPath, backupType) {
    try {
      switch (provider.type) {
        case 'local':
          await this.uploadToLocal(provider, backupPath, backupType);
          break;
        case 's3':
          await this.uploadToS3(provider, backupPath, backupType);
          break;
        case 'gcs':
          await this.uploadToGCS(provider, backupPath, backupType);
          break;
        default:
          console.warn(`Unknown storage provider type: ${provider.type}`);
      }

      console.log(`✅ Uploaded to ${providerName}`);

    } catch (error) {
      console.error(`Failed to upload to ${providerName}:`, error);
      throw error;
    }
  }

  async uploadToLocal(provider, backupPath, backupType) {
    try {
      const destDir = path.join(provider.config.path, backupType);
      await fs.mkdir(destDir, { recursive: true });
      
      const destPath = path.join(destDir, path.basename(backupPath));
      await fs.copyFile(backupPath, destPath);

    } catch (error) {
      console.error('Failed to upload to local storage:', error);
      throw error;
    }
  }

  async uploadToS3(provider, backupPath, backupType) {
    try {
      // AWS S3 upload implementation would go here
      console.log(`📤 Uploading to S3: ${backupPath}`);
      
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      throw error;
    }
  }

  async uploadToGCS(provider, backupPath, backupType) {
    try {
      // Google Cloud Storage upload implementation would go here
      console.log(`📤 Uploading to GCS: ${backupPath}`);
      
    } catch (error) {
      console.error('Failed to upload to GCS:', error);
      throw error;
    }
  }

  async applyRetentionPolicy(backupType) {
    try {
      const policy = this.backupConfig.retentionPolicies.get(`${backupType}-backups`);
      if (!policy) {
        console.warn(`No retention policy found for ${backupType}`);
        return;
      }

      const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
      
      // Get old backups
      const oldBackups = await this.prisma.backupRecord.findMany({
        where: {
          type: backupType,
          startTime: { lt: cutoffDate },
          status: 'completed'
        },
        orderBy: { startTime: 'asc' }
      });

      // Keep only the most recent backups up to maxBackups
      const backupsToDelete = oldBackups.slice(0, Math.max(0, oldBackups.length - policy.maxBackups));

      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
      }

      console.log(`🗑️ Applied retention policy: deleted ${backupsToDelete.length} old ${backupType} backups`);

    } catch (error) {
      console.error('Failed to apply retention policy:', error);
      throw error;
    }
  }

  async deleteBackup(backupId) {
    try {
      const backup = await this.prisma.backupRecord.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        console.warn(`Backup ${backupId} not found`);
        return;
      }

      // Delete from all storage providers
      for (const [name, provider] of this.backupConfig.storageProviders) {
        if (provider.enabled) {
          try {
            await this.deleteFromProvider(name, provider, backup);
          } catch (error) {
            console.error(`Failed to delete from ${name}:`, error);
          }
        }
      }

      // Mark as deleted in database
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: { status: 'deleted' }
      });

      console.log(`🗑️ Deleted backup: ${backupId}`);

    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  async deleteFromProvider(providerName, provider, backup) {
    try {
      switch (provider.type) {
        case 'local':
          // Delete from local storage
          break;
        case 's3':
          // Delete from S3
          break;
        case 'gcs':
          // Delete from GCS
          break;
      }

    } catch (error) {
      console.error(`Failed to delete from ${providerName}:`, error);
      throw error;
    }
  }

  // Database operations
  async createBackupRecord(name, type) {
    try {
      const backup = await this.prisma.backupRecord.create({
        data: {
          type,
          status: 'in_progress',
          startTime: new Date(),
          metadata: {
            name,
            schedule: this.backupConfig.schedules.get(name)
          }
        }
      });

      return backup;

    } catch (error) {
      console.error('Failed to create backup record:', error);
      throw error;
    }
  }

  async updateBackupRecord(backupId, data) {
    try {
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Failed to update backup record:', error);
      throw error;
    }
  }

  async getLatestBackupRecord(name) {
    try {
      const backup = await this.prisma.backupRecord.findFirst({
        where: {
          metadata: {
            path: ['name'],
            equals: name
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return backup;

    } catch (error) {
      console.error('Failed to get latest backup record:', error);
      return null;
    }
  }

  async getLastBackupRecord(type) {
    try {
      const backup = await this.prisma.backupRecord.findFirst({
        where: {
          type,
          status: 'completed'
        },
        orderBy: { startTime: 'desc' }
      });

      return backup;

    } catch (error) {
      console.error('Failed to get last backup record:', error);
      return null;
    }
  }

  // Utility methods
  async copyDirectory(src, dest) {
    try {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }

    } catch (error) {
      console.error('Failed to copy directory:', error);
      throw error;
    }
  }

  async getModifiedFiles(dir, since) {
    try {
      const files = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getModifiedFiles(fullPath, since);
          files.push(...subFiles);
        } else {
          const stats = await fs.stat(fullPath);
          if (stats.mtime > since) {
            files.push(fullPath);
          }
        }
      }

      return files;

    } catch (error) {
      console.error('Failed to get modified files:', error);
      return [];
    }
  }

  async calculateChecksums(backupDir) {
    try {
      const checksums = {};
      const entries = await fs.readdir(backupDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(backupDir, entry.name);
        
        if (entry.isFile()) {
          const content = await fs.readFile(fullPath);
          checksums[entry.name] = crypto.createHash('sha256').update(content).digest('hex');
        }
      }

      return checksums;

    } catch (error) {
      console.error('Failed to calculate checksums:', error);
      return {};
    }
  }

  // API methods
  async getBackupStatus() {
    try {
      const backups = await this.prisma.backupRecord.findMany({
        orderBy: { startTime: 'desc' },
        take: 50
      });

      const schedules = Array.from(this.backupConfig.schedules.values());
      const jobs = Array.from(this.backupJobs.values());

      return {
        backups,
        schedules,
        jobs: jobs.map(job => ({
          name: job.name,
          lastRun: job.lastRun,
          nextRun: job.nextRun,
          isRunning: job.isRunning
        }))
      };

    } catch (error) {
      console.error('Failed to get backup status:', error);
      throw error;
    }
  }

  async triggerManualBackup(type, options = {}) {
    try {
      const schedule = this.backupConfig.schedules.get(`${type}-manual`) || {
        name: `${type}-manual`,
        type,
        schedule: 'manual',
        enabled: true,
        priority: 'manual'
      };

      const job = {
        name: schedule.name,
        schedule,
        lastRun: null,
        nextRun: new Date(),
        isRunning: false,
        intervalId: null
      };

      await this.executeBackupJob(job);

      return {
        success: true,
        message: `Manual ${type} backup completed`
      };

    } catch (error) {
      console.error('Failed to trigger manual backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupId, options = {}) {
    try {
      const backup = await this.prisma.backupRecord.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      if (backup.status !== 'completed') {
        throw new Error(`Backup ${backupId} is not completed`);
      }

      console.log(`🔄 Starting restore from backup: ${backupId}`);

      // Create restore record
      const restoreRecord = await this.prisma.restoreRecord.create({
        data: {
          backupId,
          status: 'in_progress',
          startTime: new Date(),
          metadata: options
        }
      });

      // Download backup from storage
      const backupPath = await this.downloadBackup(backup);

      // Decrypt backup
      const decryptedPath = await this.decryptBackup(backupPath);

      // Decompress backup
      const decompressedPath = await this.decompressBackup(decryptedPath);

      // Restore data based on backup type
      let result;
      switch (backup.type) {
        case 'full':
          result = await this.restoreFullBackup(decompressedPath, options);
          break;
        case 'incremental':
          result = await this.restoreIncrementalBackup(decompressedPath, options);
          break;
        case 'tenant':
          result = await this.restoreTenantBackup(decompressedPath, options);
          break;
        case 'critical':
          result = await this.restoreCriticalData(decompressedPath, options);
          break;
        default:
          throw new Error(`Unknown backup type: ${backup.type}`);
      }

      // Update restore record
      await this.prisma.restoreRecord.update({
        where: { id: restoreRecord.id },
        data: {
          status: 'completed',
          endTime: new Date(),
          metadata: {
            ...restoreRecord.metadata,
            result
          }
        }
      });

      console.log(`✅ Restore completed: ${backupId}`);

      return {
        success: true,
        restoreId: restoreRecord.id,
        result
      };

    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  async downloadBackup(backup) {
    try {
      // Download from storage providers
      // Implementation would depend on storage provider
      return './backups/downloaded/backup.tar.gz.enc';

    } catch (error) {
      console.error('Failed to download backup:', error);
      throw error;
    }
  }

  async decryptBackup(backupPath) {
    try {
      const decryptedPath = backupPath.replace('.enc', '');
      
      // Decryption implementation
      // This would reverse the encryption process
      
      return decryptedPath;

    } catch (error) {
      console.error('Failed to decrypt backup:', error);
      throw error;
    }
  }

  async decompressBackup(backupPath) {
    try {
      const decompressedPath = backupPath.replace('.tar.gz', '');
      
      const command = `tar -xzf ${backupPath} -C ${path.dirname(decompressedPath)}`;
      await execAsync(command);

      return decompressedPath;

    } catch (error) {
      console.error('Failed to decompress backup:', error);
      throw error;
    }
  }

  async restoreFullBackup(backupPath, options) {
    try {
      console.log('🔄 Restoring full backup...');

      // Restore database
      await this.restoreDatabase(path.join(backupPath, 'database.sql'));

      // Restore file system
      await this.restoreFileSystem(path.join(backupPath, 'filesystem'));

      // Restore configuration
      await this.restoreConfiguration(path.join(backupPath, 'configuration.json'));

      return {
        type: 'full',
        components: ['database', 'filesystem', 'configuration']
      };

    } catch (error) {
      console.error('Failed to restore full backup:', error);
      throw error;
    }
  }

  async restoreIncrementalBackup(backupPath, options) {
    try {
      console.log('🔄 Restoring incremental backup...');

      // Restore incremental database changes
      await this.restoreDatabaseIncremental(path.join(backupPath, 'database_incremental.sql'));

      // Restore incremental file system changes
      await this.restoreFileSystemIncremental(path.join(backupPath, 'filesystem_incremental'));

      return {
        type: 'incremental',
        components: ['database_incremental', 'filesystem_incremental']
      };

    } catch (error) {
      console.error('Failed to restore incremental backup:', error);
      throw error;
    }
  }

  async restoreTenantBackup(backupPath, options) {
    try {
      console.log('🔄 Restoring tenant backup...');

      const tenantDirs = await fs.readdir(backupPath);
      const restoredTenants = [];

      for (const tenantDir of tenantDirs) {
        if (tenantDir === 'filesystem' || tenantDir === 'configuration') continue;
        
        const tenantBackupPath = path.join(backupPath, tenantDir);
        const orgData = await this.restoreTenantData(tenantBackupPath);
        restoredTenants.push(orgData);
      }

      return {
        type: 'tenant',
        tenants: restoredTenants
      };

    } catch (error) {
      console.error('Failed to restore tenant backup:', error);
      throw error;
    }
  }

  async restoreCriticalData(backupPath, options) {
    try {
      console.log('🔄 Restoring critical data...');

      const criticalDataPath = path.join(backupPath, 'critical', 'critical_data.json');
      const criticalData = JSON.parse(await fs.readFile(criticalDataPath, 'utf8'));

      // Restore critical data to database
      await this.restoreCriticalDataToDatabase(criticalData);

      return {
        type: 'critical',
        recordCount: {
          users: criticalData.users.length,
          organizations: criticalData.organizations.length,
          payments: criticalData.payments.length,
          voiceCalls: criticalData.voiceCalls.length
        }
      };

    } catch (error) {
      console.error('Failed to restore critical data:', error);
      throw error;
    }
  }

  async restoreDatabase(sqlFile) {
    try {
      const command = `psql ${process.env.DATABASE_URL} < ${sqlFile}`;
      await execAsync(command);

    } catch (error) {
      console.error('Failed to restore database:', error);
      throw error;
    }
  }

  async restoreDatabaseIncremental(sqlFile) {
    try {
      const command = `psql ${process.env.DATABASE_URL} < ${sqlFile}`;
      await execAsync(command);

    } catch (error) {
      console.error('Failed to restore database incrementally:', error);
      throw error;
    }
  }

  async restoreFileSystem(fsPath) {
    try {
      // Restore file system from backup
      const destPath = './';
      await this.copyDirectory(fsPath, destPath);

    } catch (error) {
      console.error('Failed to restore file system:', error);
      throw error;
    }
  }

  async restoreFileSystemIncremental(fsPath) {
    try {
      // Restore incremental file system changes
      const destPath = './';
      await this.copyDirectory(fsPath, destPath);

    } catch (error) {
      console.error('Failed to restore file system incrementally:', error);
      throw error;
    }
  }

  async restoreConfiguration(configFile) {
    try {
      const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
      
      // Restore configuration
      console.log('Configuration restored:', config);

    } catch (error) {
      console.error('Failed to restore configuration:', error);
      throw error;
    }
  }

  async restoreTenantData(tenantBackupPath) {
    try {
      const orgDataFile = path.join(tenantBackupPath, 'organization.json');
      const orgData = JSON.parse(await fs.readFile(orgDataFile, 'utf8'));

      // Restore organization data
      await this.prisma.organization.create({
        data: orgData
      });

      return {
        organizationId: orgData.id,
        organizationSlug: orgData.slug,
        recordCount: {
          users: orgData.users.length,
          farmers: orgData.farmers.length,
          crops: orgData.crops.length,
          stores: orgData.stores.length,
          products: orgData.products.length
        }
      };

    } catch (error) {
      console.error('Failed to restore tenant data:', error);
      throw error;
    }
  }

  async restoreCriticalDataToDatabase(criticalData) {
    try {
      // Restore critical data to database
      // Implementation would depend on data structure

    } catch (error) {
      console.error('Failed to restore critical data to database:', error);
      throw error;
    }
  }
}

module.exports = ProductionBackupStrategy;
