const ZohoCRMService = require('./zoho-service');

class CRMSyncService {
  constructor(prisma) {
    this.prisma = prisma;
    this.zoho = new ZohoCRMService();
    this.syncJobs = new Map();
  }

  async startLeadSyncJob(organizationId, options = {}) {
    const jobId = `lead_sync_${organizationId}_${Date.now()}`;
    
    const job = {
      id: jobId,
      organizationId,
      status: 'running',
      startedAt: new Date(),
      options: {
        batchSize: options.batchSize || 50,
        syncDirection: options.syncDirection || 'bidirectional', // local_to_zoho, zoho_to_local, bidirectional
        conflictResolution: options.conflictResolution || 'prefer_zoho',
        ...options
      },
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        conflicts: 0
      },
      results: {
        created: [],
        updated: [],
        conflicts: [],
        errors: []
      }
    };

    this.syncJobs.set(jobId, job);

    // Start sync process in background
    this.performLeadSync(jobId).catch(error => {
      console.error(`Lead sync job ${jobId} failed:`, error);
      const job = this.syncJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
      }
    });

    return {
      success: true,
      jobId,
      message: 'Lead sync job started'
    };
  }

  async performLeadSync(jobId) {
    const job = this.syncJobs.get(jobId);
    if (!job) {
      throw new Error('Sync job not found');
    }

    try {
      // Get local leads
      const localLeads = await this.prisma.lead.findMany({
        where: { organizationId: job.organizationId },
        take: job.options.batchSize
      });

      job.progress.total = localLeads.length;

      // Sync based on direction
      switch (job.options.syncDirection) {
        case 'local_to_zoho':
          await this.syncLocalToZoho(job, localLeads);
          break;
        case 'zoho_to_local':
          await this.syncZohoToLocal(job);
          break;
        case 'bidirectional':
          await this.syncBidirectional(job, localLeads);
          break;
      }

      job.status = 'completed';
      job.completedAt = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      throw error;
    }
  }

  async syncLocalToZoho(job, localLeads) {
    for (const lead of localLeads) {
      try {
        job.progress.processed++;

        // Check if lead exists in Zoho
        const zohoSearch = await this.zoho.searchLeads({ Email: lead.email });
        
        if (zohoSearch.success && zohoSearch.leads.length > 0) {
          // Update existing lead
          const zohoLead = zohoSearch.leads[0];
          const updateData = this.mapLocalToZoho(lead);
          
          const updateResult = await this.zoho.updateLead(zohoLead.id, updateData);
          
          if (updateResult.success) {
            job.progress.successful++;
            job.results.updated.push({
              localId: lead.id,
              zohoId: zohoLead.id,
              email: lead.email
            });
          } else {
            job.progress.failed++;
            job.results.errors.push({
              localId: lead.id,
              email: lead.email,
              error: updateResult.error
            });
          }
        } else {
          // Create new lead
          const createData = this.mapLocalToZoho(lead);
          const createResult = await this.zoho.createLead(createData);
          
          if (createResult.success) {
            job.progress.successful++;
            job.results.created.push({
              localId: lead.id,
              zohoId: createResult.leadId,
              email: lead.email
            });

            // Update local lead with Zoho ID
            await this.prisma.lead.update({
              where: { id: lead.id },
              data: { zohoLeadId: createResult.leadId }
            });
          } else {
            job.progress.failed++;
            job.results.errors.push({
              localId: lead.id,
              email: lead.email,
              error: createResult.error
            });
          }
        }
      } catch (error) {
        job.progress.failed++;
        job.results.errors.push({
          localId: lead.id,
          email: lead.email,
          error: error.message
        });
      }
    }
  }

  async syncZohoToLocal(job) {
    // This would fetch leads from Zoho and sync to local database
    // Implementation depends on Zoho API pagination and filtering
    console.log('Zoho to local sync not fully implemented yet');
  }

  async syncBidirectional(job, localLeads) {
    // Perform both directions and resolve conflicts
    await this.syncLocalToZoho(job, localLeads);
    // Additional bidirectional logic would go here
  }

  mapLocalToZoho(localLead) {
    return {
      First_Name: localLead.firstName,
      Last_Name: localLead.lastName,
      Email: localLead.email,
      Phone: localLead.phone,
      Company: localLead.company,
      Lead_Source: localLead.source || 'Website',
      Lead_Status: localLead.status || 'Not Contacted',
      Industry: localLead.industry,
      Description: localLead.description,
      // Add custom fields mapping as needed
    };
  }

  mapZohoToLocal(zohoLead) {
    return {
      firstName: zohoLead.First_Name,
      lastName: zohoLead.Last_Name,
      email: zohoLead.Email,
      phone: zohoLead.Phone,
      company: zohoLead.Company,
      source: zohoLead.Lead_Source,
      status: zohoLead.Lead_Status,
      industry: zohoLead.Industry,
      description: zohoLead.Description,
      zohoLeadId: zohoLead.id,
      // Add custom fields mapping as needed
    };
  }

  async resolveLeadConflict(localLead, zohoLead, conflictFields) {
    try {
      const resolution = await this.zoho.resolveConflict(
        localLead,
        zohoLead,
        conflictFields
      );

      if (resolution.success) {
        // Update both local and Zoho with resolved data
        await this.prisma.lead.update({
          where: { id: localLead.id },
          data: resolution.resolution
        });

        await this.zoho.updateLead(zohoLead.id, resolution.resolution);

        return {
          success: true,
          resolution: resolution.resolution,
          conflicts: resolution.conflicts
        };
      }

      return resolution;
    } catch (error) {
      console.error('Lead conflict resolution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getSyncJobStatus(jobId) {
    const job = this.syncJobs.get(jobId);
    if (!job) {
      return {
        success: false,
        error: 'Sync job not found'
      };
    }

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        results: job.results,
        error: job.error
      }
    };
  }

  async getAllSyncJobs(organizationId) {
    const jobs = Array.from(this.syncJobs.values())
      .filter(job => job.organizationId === organizationId)
      .map(job => ({
        id: job.id,
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

  async cancelSyncJob(jobId) {
    const job = this.syncJobs.get(jobId);
    if (!job) {
      return {
        success: false,
        error: 'Sync job not found'
      };
    }

    if (job.status === 'running') {
      job.status = 'cancelled';
      job.completedAt = new Date();
    }

    return {
      success: true,
      message: 'Sync job cancelled'
    };
  }

  async getSyncMetrics(organizationId, startDate, endDate) {
    try {
      const jobs = Array.from(this.syncJobs.values())
        .filter(job => 
          job.organizationId === organizationId &&
          job.startedAt >= new Date(startDate) &&
          job.startedAt <= new Date(endDate)
        );

      const metrics = {
        totalJobs: jobs.length,
        completedJobs: jobs.filter(j => j.status === 'completed').length,
        failedJobs: jobs.filter(j => j.status === 'failed').length,
        runningJobs: jobs.filter(j => j.status === 'running').length,
        totalLeadsProcessed: jobs.reduce((sum, j) => sum + j.progress.processed, 0),
        totalLeadsSuccessful: jobs.reduce((sum, j) => sum + j.progress.successful, 0),
        totalLeadsFailed: jobs.reduce((sum, j) => sum + j.progress.failed, 0),
        averageSuccessRate: jobs.length > 0 
          ? jobs.reduce((sum, j) => sum + (j.progress.successful / Math.max(j.progress.processed, 1)), 0) / jobs.length
          : 0
      };

      return {
        success: true,
        metrics
      };
    } catch (error) {
      console.error('Sync metrics failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CRMSyncService;
