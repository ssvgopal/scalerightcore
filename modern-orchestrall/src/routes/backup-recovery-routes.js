const BackupRecoveryService = require('../backup/backup-recovery-service');

class BackupRecoveryRoutes {
  constructor(app, prisma) {
    this.app = app;
    this.prisma = prisma;
    this.backupRecoveryService = new BackupRecoveryService(prisma);
  }

  async initialize() {
    await this.backupRecoveryService.initialize();
    this.registerRoutes();
  }

  registerRoutes() {
    // Backup creation endpoints
    this.app.post('/api/backup/full', async (request, reply) => {
      try {
        const options = request.body || {};
        const result = await this.backupRecoveryService.createFullBackup(options);
        
        reply.send({
          success: true,
          data: result.data,
          message: 'Full backup created successfully'
        });
      } catch (error) {
        console.error('Failed to create full backup:', error);
        reply.status(500).send({
          error: 'Failed to create full backup',
          message: error.message
        });
      }
    });

    this.app.post('/api/backup/incremental', async (request, reply) => {
      try {
        const options = request.body || {};
        const result = await this.backupRecoveryService.createIncrementalBackup(options);
        
        reply.send({
          success: true,
          data: result.data,
          message: 'Incremental backup created successfully'
        });
      } catch (error) {
        console.error('Failed to create incremental backup:', error);
        reply.status(500).send({
          error: 'Failed to create incremental backup',
          message: error.message
        });
      }
    });

    this.app.post('/api/backup/tenant/:tenantId', async (request, reply) => {
      try {
        const { tenantId } = request.params;
        const options = request.body || {};
        const result = await this.backupRecoveryService.createTenantBackup(tenantId, options);
        
        reply.send({
          success: true,
          data: result.data,
          message: `Tenant backup created successfully for ${tenantId}`
        });
      } catch (error) {
        console.error(`Failed to create tenant backup for ${tenantId}:`, error);
        reply.status(500).send({
          error: 'Failed to create tenant backup',
          message: error.message
        });
      }
    });

    // Backup management endpoints
    this.app.get('/api/backup', async (request, reply) => {
      try {
        const { type, status, limit = 50, offset = 0 } = request.query;
        const result = await this.backupRecoveryService.getBackupList({
          type,
          status,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        
        reply.send({
          success: true,
          data: result.data
        });
      } catch (error) {
        console.error('Failed to get backup list:', error);
        reply.status(500).send({
          error: 'Failed to get backup list',
          message: error.message
        });
      }
    });

    this.app.get('/api/backup/:backupId', async (request, reply) => {
      try {
        const { backupId } = request.params;
        const result = await this.backupRecoveryService.getBackupDetails(backupId);
        
        reply.send({
          success: true,
          data: result.data
        });
      } catch (error) {
        console.error(`Failed to get backup details for ${backupId}:`, error);
        reply.status(500).send({
          error: 'Failed to get backup details',
          message: error.message
        });
      }
    });

    this.app.delete('/api/backup/:backupId', async (request, reply) => {
      try {
        const { backupId } = request.params;
        const result = await this.backupRecoveryService.deleteBackup(backupId);
        
        reply.send({
          success: true,
          message: result.message
        });
      } catch (error) {
        console.error(`Failed to delete backup ${backupId}:`, error);
        reply.status(500).send({
          error: 'Failed to delete backup',
          message: error.message
        });
      }
    });

    // Restore endpoints
    this.app.post('/api/restore/:backupId', async (request, reply) => {
      try {
        const { backupId } = request.params;
        const options = request.body || {};
        const result = await this.backupRecoveryService.restoreFromBackup(backupId, options);
        
        reply.send({
          success: true,
          data: result.data,
          message: 'Restore initiated successfully'
        });
      } catch (error) {
        console.error(`Failed to restore from backup ${backupId}:`, error);
        reply.status(500).send({
          error: 'Failed to restore from backup',
          message: error.message
        });
      }
    });

    this.app.get('/api/restore/history', async (request, reply) => {
      try {
        const { limit = 50, offset = 0 } = request.query;
        const result = await this.backupRecoveryService.getRestoreHistory({
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
        
        reply.send({
          success: true,
          data: result.data
        });
      } catch (error) {
        console.error('Failed to get restore history:', error);
        reply.status(500).send({
          error: 'Failed to get restore history',
          message: error.message
        });
      }
    });

    // Backup verification endpoint
    this.app.post('/api/backup/:backupId/verify', async (request, reply) => {
      try {
        const { backupId } = request.params;
        
        // Get backup record
        const backup = await this.prisma.backupRecord.findUnique({
          where: { id: backupId }
        });

        if (!backup) {
          return reply.status(404).send({
            error: 'Backup not found'
          });
        }

        // Verify backup integrity
        await this.backupRecoveryService.verifyBackupIntegrity(backup.metadata.path);
        
        reply.send({
          success: true,
          message: 'Backup integrity verified successfully'
        });
      } catch (error) {
        console.error(`Failed to verify backup ${backupId}:`, error);
        reply.status(500).send({
          error: 'Backup verification failed',
          message: error.message
        });
      }
    });

    // Backup statistics endpoint
    this.app.get('/api/backup/stats', async (request, reply) => {
      try {
        const stats = await this.prisma.backupRecord.groupBy({
          by: ['type', 'status'],
          _count: {
            id: true
          },
          _sum: {
            size: true
          }
        });

        const totalBackups = await this.prisma.backupRecord.count();
        const totalSize = await this.prisma.backupRecord.aggregate({
          _sum: {
            size: true
          }
        });

        const recentBackups = await this.prisma.backupRecord.findMany({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        reply.send({
          success: true,
          data: {
            totalBackups,
            totalSize: totalSize._sum.size || 0,
            byTypeAndStatus: stats.map(stat => ({
              type: stat.type,
              status: stat.status,
              count: stat._count.id,
              totalSize: stat._sum.size || 0
            })),
            recentBackups: recentBackups.map(backup => ({
              id: backup.id,
              type: backup.type,
              status: backup.status,
              startTime: backup.startTime,
              endTime: backup.endTime,
              size: backup.size
            }))
          }
        });
      } catch (error) {
        console.error('Failed to get backup stats:', error);
        reply.status(500).send({
          error: 'Failed to get backup statistics',
          message: error.message
        });
      }
    });

    // Backup configuration endpoint
    this.app.get('/api/backup/config', async (request, reply) => {
      try {
        const config = {
          basePath: this.backupRecoveryService.backupConfig.basePath,
          retentionDays: this.backupRecoveryService.backupConfig.retentionDays,
          compressionEnabled: this.backupRecoveryService.backupConfig.compressionEnabled,
          encryptionEnabled: this.backupRecoveryService.backupConfig.encryptionEnabled,
          scheduledJobs: Array.from(this.backupRecoveryService.scheduledJobs.keys())
        };
        
        reply.send({
          success: true,
          data: config
        });
      } catch (error) {
        console.error('Failed to get backup config:', error);
        reply.status(500).send({
          error: 'Failed to get backup configuration',
          message: error.message
        });
      }
    });

    // Manual cleanup endpoint
    this.app.post('/api/backup/cleanup', async (request, reply) => {
      try {
        await this.backupRecoveryService.cleanupOldBackups();
        
        reply.send({
          success: true,
          message: 'Backup cleanup completed successfully'
        });
      } catch (error) {
        console.error('Failed to cleanup backups:', error);
        reply.status(500).send({
          error: 'Failed to cleanup backups',
          message: error.message
        });
      }
    });

    // Backup health check endpoint
    this.app.get('/api/backup/health', async (request, reply) => {
      try {
        const recentBackup = await this.prisma.backupRecord.findFirst({
          where: {
            status: 'completed',
            type: 'full'
          },
          orderBy: { endTime: 'desc' }
        });

        const lastIncrementalBackup = await this.prisma.backupRecord.findFirst({
          where: {
            status: 'completed',
            type: 'incremental'
          },
          orderBy: { endTime: 'desc' }
        });

        const health = {
          status: 'healthy',
          lastFullBackup: recentBackup ? {
            id: recentBackup.id,
            endTime: recentBackup.endTime,
            size: recentBackup.size,
            ageHours: recentBackup.endTime ? 
              Math.floor((Date.now() - recentBackup.endTime.getTime()) / (1000 * 60 * 60)) : null
          } : null,
          lastIncrementalBackup: lastIncrementalBackup ? {
            id: lastIncrementalBackup.id,
            endTime: lastIncrementalBackup.endTime,
            size: lastIncrementalBackup.size,
            ageHours: lastIncrementalBackup.endTime ? 
              Math.floor((Date.now() - lastIncrementalBackup.endTime.getTime()) / (1000 * 60 * 60)) : null
          } : null,
          warnings: []
        };

        // Check for warnings
        if (!recentBackup) {
          health.warnings.push('No full backup found');
          health.status = 'warning';
        } else if (recentBackup.endTime) {
          const ageHours = Math.floor((Date.now() - recentBackup.endTime.getTime()) / (1000 * 60 * 60));
          if (ageHours > 48) {
            health.warnings.push(`Last full backup is ${ageHours} hours old`);
            health.status = 'warning';
          }
        }

        if (!lastIncrementalBackup) {
          health.warnings.push('No incremental backup found');
        } else if (lastIncrementalBackup.endTime) {
          const ageHours = Math.floor((Date.now() - lastIncrementalBackup.endTime.getTime()) / (1000 * 60 * 60));
          if (ageHours > 12) {
            health.warnings.push(`Last incremental backup is ${ageHours} hours old`);
            health.status = 'warning';
          }
        }

        reply.send({
          success: true,
          data: health
        });
      } catch (error) {
        console.error('Failed to get backup health:', error);
        reply.status(500).send({
          error: 'Failed to get backup health',
          message: error.message
        });
      }
    });
  }
}

module.exports = BackupRecoveryRoutes;
