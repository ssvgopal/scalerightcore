const ObservabilityService = require('../observability/observability-service');

class ObservabilityRoutes {
  constructor(app, prisma) {
    this.app = app;
    this.prisma = prisma;
    this.observabilityService = new ObservabilityService(prisma);
  }

  async initialize() {
    await this.observabilityService.initialize();
    this.registerRoutes();
  }

  registerRoutes() {
    // Prometheus metrics endpoint
    this.app.get('/metrics', async (request, reply) => {
      try {
        const metrics = await this.observabilityService.getPrometheusMetrics();
        reply.type('text/plain').send(metrics);
      } catch (error) {
        console.error('Failed to get Prometheus metrics:', error);
        reply.status(500).send('Failed to get metrics');
      }
    });

    // System health endpoint
    this.app.get('/api/observability/health', async (request, reply) => {
      try {
        const { organizationId } = request.query;
        const health = await this.observabilityService.getSystemHealth(organizationId);
        
        reply.send({
          success: true,
          data: health
        });
      } catch (error) {
        console.error('Failed to get system health:', error);
        reply.status(500).send({
          error: 'Failed to get system health',
          message: error.message
        });
      }
    });

    // Key metrics endpoint
    this.app.get('/api/observability/metrics', async (request, reply) => {
      try {
        const { organizationId } = request.query;
        const metrics = await this.observabilityService.getKeyMetrics(organizationId);
        
        reply.send({
          success: true,
          data: metrics
        });
      } catch (error) {
        console.error('Failed to get key metrics:', error);
        reply.status(500).send({
          error: 'Failed to get key metrics',
          message: error.message
        });
      }
    });

    // Performance metrics endpoint
    this.app.get('/api/observability/performance', async (request, reply) => {
      try {
        const { organizationId, timeRange = '24h' } = request.query;
        const performance = await this.observabilityService.getPerformanceMetrics(organizationId, timeRange);
        
        reply.send({
          success: true,
          data: performance
        });
      } catch (error) {
        console.error('Failed to get performance metrics:', error);
        reply.status(500).send({
          error: 'Failed to get performance metrics',
          message: error.message
        });
      }
    });

    // Business metrics endpoint
    this.app.get('/api/observability/business', async (request, reply) => {
      try {
        const { organizationId, timeRange = '30d' } = request.query;
        const businessMetrics = await this.observabilityService.getBusinessMetrics(organizationId, timeRange);
        
        reply.send({
          success: true,
          data: businessMetrics
        });
      } catch (error) {
        console.error('Failed to get business metrics:', error);
        reply.status(500).send({
          error: 'Failed to get business metrics',
          message: error.message
        });
      }
    });

    // Active alerts endpoint
    this.app.get('/api/observability/alerts', async (request, reply) => {
      try {
        const { organizationId, status = 'active', limit = 50 } = request.query;
        
        const alerts = await this.prisma.alert.findMany({
          where: {
            status,
            ...(organizationId && { 
              metadata: {
                path: ['organizationId'],
                equals: organizationId
              }
            })
          },
          orderBy: { triggeredAt: 'desc' },
          take: parseInt(limit)
        });
        
        reply.send({
          success: true,
          data: alerts
        });
      } catch (error) {
        console.error('Failed to get alerts:', error);
        reply.status(500).send({
          error: 'Failed to get alerts',
          message: error.message
        });
      }
    });

    // Acknowledge alert endpoint
    this.app.post('/api/observability/alerts/:alertId/acknowledge', async (request, reply) => {
      try {
        const { alertId } = request.params;
        const { acknowledgedBy } = request.body;
        
        const alert = await this.prisma.alert.update({
          where: { id: alertId },
          data: {
            status: 'acknowledged',
            acknowledgedAt: new Date(),
            acknowledgedBy
          }
        });
        
        reply.send({
          success: true,
          data: alert,
          message: 'Alert acknowledged successfully'
        });
      } catch (error) {
        console.error('Failed to acknowledge alert:', error);
        reply.status(500).send({
          error: 'Failed to acknowledge alert',
          message: error.message
        });
      }
    });

    // Resolve alert endpoint
    this.app.post('/api/observability/alerts/:alertId/resolve', async (request, reply) => {
      try {
        const { alertId } = request.params;
        
        const alert = await this.prisma.alert.update({
          where: { id: alertId },
          data: {
            status: 'resolved',
            resolvedAt: new Date()
          }
        });
        
        reply.send({
          success: true,
          data: alert,
          message: 'Alert resolved successfully'
        });
      } catch (error) {
        console.error('Failed to resolve alert:', error);
        reply.status(500).send({
          error: 'Failed to resolve alert',
          message: error.message
        });
      }
    });

    // Grafana dashboard configuration endpoint
    this.app.get('/api/observability/grafana/dashboard', async (request, reply) => {
      try {
        const dashboardConfig = this.observabilityService.getGrafanaDashboardConfig();
        
        reply.send({
          success: true,
          data: dashboardConfig
        });
      } catch (error) {
        console.error('Failed to get Grafana dashboard config:', error);
        reply.status(500).send({
          error: 'Failed to get Grafana dashboard config',
          message: error.message
        });
      }
    });

    // System metrics recording endpoint (for testing)
    this.app.post('/api/observability/metrics/record', async (request, reply) => {
      try {
        const { 
          type, 
          organizationId = 'default',
          ...metricData 
        } = request.body;
        
        switch (type) {
          case 'http_request':
            this.observabilityService.recordHttpRequest(
              metricData.method,
              metricData.route,
              metricData.statusCode,
              metricData.duration,
              organizationId
            );
            break;
            
          case 'database_query':
            this.observabilityService.recordDatabaseQuery(
              metricData.queryType,
              metricData.duration,
              organizationId
            );
            break;
            
          case 'farmer_registration':
            this.observabilityService.recordFarmerRegistration(
              organizationId,
              metricData.region
            );
            break;
            
          case 'crop_monitoring':
            this.observabilityService.recordCropMonitoring(
              organizationId,
              metricData.cropType,
              metricData.status
            );
            break;
            
          case 'voice_call':
            this.observabilityService.recordVoiceCall(
              organizationId,
              metricData.language,
              metricData.status,
              metricData.duration
            );
            break;
            
          case 'payment':
            this.observabilityService.recordPayment(
              organizationId,
              metricData.paymentMethod,
              metricData.status,
              metricData.amount,
              metricData.currency
            );
            break;
            
          case 'notification':
            this.observabilityService.recordNotification(
              organizationId,
              metricData.channel,
              metricData.type
            );
            break;
            
          case 'error':
            this.observabilityService.recordError(
              metricData.errorType,
              metricData.severity,
              organizationId
            );
            break;
            
          case 'response_time':
            this.observabilityService.recordResponseTime(
              metricData.operation,
              metricData.duration,
              organizationId
            );
            break;
            
          default:
            return reply.status(400).send({
              error: 'Invalid metric type',
              supportedTypes: [
                'http_request', 'database_query', 'farmer_registration',
                'crop_monitoring', 'voice_call', 'payment', 'notification',
                'error', 'response_time'
              ]
            });
        }
        
        reply.send({
          success: true,
          message: 'Metric recorded successfully'
        });
      } catch (error) {
        console.error('Failed to record metric:', error);
        reply.status(500).send({
          error: 'Failed to record metric',
          message: error.message
        });
      }
    });

    // Performance monitoring endpoint
    this.app.get('/api/observability/performance/monitor', async (request, reply) => {
      try {
        // Record current system metrics
        this.observabilityService.recordSystemMetrics();
        
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const systemInfo = {
          timestamp: new Date().toISOString(),
          memory: {
            rss: memUsage.rss,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform
        };
        
        reply.send({
          success: true,
          data: systemInfo
        });
      } catch (error) {
        console.error('Failed to get performance monitor data:', error);
        reply.status(500).send({
          error: 'Failed to get performance monitor data',
          message: error.message
        });
      }
    });

    // Alert rules management
    this.app.get('/api/observability/alert-rules', async (request, reply) => {
      try {
        const rules = Array.from(this.observabilityService.alertRules.values());
        
        reply.send({
          success: true,
          data: rules
        });
      } catch (error) {
        console.error('Failed to get alert rules:', error);
        reply.status(500).send({
          error: 'Failed to get alert rules',
          message: error.message
        });
      }
    });

    this.app.post('/api/observability/alert-rules', async (request, reply) => {
      try {
        const { id, name, description, condition, severity, enabled } = request.body;
        
        const rule = {
          id,
          name,
          description,
          condition,
          severity,
          enabled: enabled !== false
        };
        
        this.observabilityService.alertRules.set(id, rule);
        
        reply.send({
          success: true,
          data: rule,
          message: 'Alert rule created successfully'
        });
      } catch (error) {
        console.error('Failed to create alert rule:', error);
        reply.status(500).send({
          error: 'Failed to create alert rule',
          message: error.message
        });
      }
    });

    this.app.put('/api/observability/alert-rules/:ruleId', async (request, reply) => {
      try {
        const { ruleId } = request.params;
        const { name, description, condition, severity, enabled } = request.body;
        
        const existingRule = this.observabilityService.alertRules.get(ruleId);
        if (!existingRule) {
          return reply.status(404).send({
            error: 'Alert rule not found'
          });
        }
        
        const updatedRule = {
          ...existingRule,
          name,
          description,
          condition,
          severity,
          enabled: enabled !== false
        };
        
        this.observabilityService.alertRules.set(ruleId, updatedRule);
        
        reply.send({
          success: true,
          data: updatedRule,
          message: 'Alert rule updated successfully'
        });
      } catch (error) {
        console.error('Failed to update alert rule:', error);
        reply.status(500).send({
          error: 'Failed to update alert rule',
          message: error.message
        });
      }
    });

    this.app.delete('/api/observability/alert-rules/:ruleId', async (request, reply) => {
      try {
        const { ruleId } = request.params;
        
        const deleted = this.observabilityService.alertRules.delete(ruleId);
        
        if (!deleted) {
          return reply.status(404).send({
            error: 'Alert rule not found'
          });
        }
        
        reply.send({
          success: true,
          message: 'Alert rule deleted successfully'
        });
      } catch (error) {
        console.error('Failed to delete alert rule:', error);
        reply.status(500).send({
          error: 'Failed to delete alert rule',
          message: error.message
        });
      }
    });
  }
}

module.exports = ObservabilityRoutes;
