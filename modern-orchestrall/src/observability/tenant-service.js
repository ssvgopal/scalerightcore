const client = require('prom-client');

class TenantObservabilityService {
  constructor(prisma) {
    this.prisma = prisma;
    this.tenantMetrics = new Map();
    this.alertRules = new Map();
    this.dashboards = new Map();
    this.auditTrails = new Map();
  }

  async initializeTenantMetrics(organizationId) {
    try {
      const registry = new client.Registry();
      
      // Custom metrics for this tenant
      const httpRequestsTotal = new client.Counter({
        name: `tenant_http_requests_total_${organizationId}`,
        help: 'Total HTTP requests for tenant',
        labelNames: ['method', 'route', 'status_code'],
        registers: [registry]
      });

      const httpRequestDuration = new client.Histogram({
        name: `tenant_http_request_duration_seconds_${organizationId}`,
        help: 'HTTP request duration for tenant',
        labelNames: ['method', 'route'],
        buckets: [0.1, 0.5, 1, 2, 5, 10],
        registers: [registry]
      });

      const activeUsers = new client.Gauge({
        name: `tenant_active_users_${organizationId}`,
        help: 'Active users for tenant',
        registers: [registry]
      });

      const apiErrors = new client.Counter({
        name: `tenant_api_errors_total_${organizationId}`,
        help: 'Total API errors for tenant',
        labelNames: ['error_type', 'endpoint'],
        registers: [registry]
      });

      const businessMetrics = new client.Gauge({
        name: `tenant_business_metrics_${organizationId}`,
        help: 'Business metrics for tenant',
        labelNames: ['metric_type'],
        registers: [registry]
      });

      this.tenantMetrics.set(organizationId, {
        registry,
        httpRequestsTotal,
        httpRequestDuration,
        activeUsers,
        apiErrors,
        businessMetrics
      });

      return {
        success: true,
        message: `Metrics initialized for tenant ${organizationId}`
      };
    } catch (error) {
      console.error('Tenant metrics initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async recordMetric(organizationId, metricType, value, labels = {}) {
    try {
      const metrics = this.tenantMetrics.get(organizationId);
      if (!metrics) {
        await this.initializeTenantMetrics(organizationId);
        return this.recordMetric(organizationId, metricType, value, labels);
      }

      switch (metricType) {
        case 'http_request':
          metrics.httpRequestsTotal.inc(labels);
          if (labels.duration) {
            metrics.httpRequestDuration.observe(labels, labels.duration);
          }
          break;
        
        case 'active_users':
          metrics.activeUsers.set(labels, value);
          break;
        
        case 'api_error':
          metrics.apiErrors.inc(labels);
          break;
        
        case 'business_metric':
          metrics.businessMetrics.set(labels, value);
          break;
        
        default:
          console.warn(`Unknown metric type: ${metricType}`);
      }

      return {
        success: true,
        message: 'Metric recorded successfully'
      };
    } catch (error) {
      console.error('Metric recording failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createDashboard(organizationId, dashboardConfig) {
    try {
      const dashboard = {
        id: `dashboard_${organizationId}_${Date.now()}`,
        organizationId,
        name: dashboardConfig.name,
        description: dashboardConfig.description,
        widgets: dashboardConfig.widgets || [],
        layout: dashboardConfig.layout || 'grid',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.dashboards.set(dashboard.id, dashboard);

      return {
        success: true,
        dashboard: {
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          widgetCount: dashboard.widgets.length
        }
      };
    } catch (error) {
      console.error('Dashboard creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDashboard(dashboardId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return {
        success: false,
        error: 'Dashboard not found'
      };
    }

    return {
      success: true,
      dashboard
    };
  }

  async getTenantDashboards(organizationId) {
    const dashboards = Array.from(this.dashboards.values())
      .filter(dashboard => dashboard.organizationId === organizationId)
      .map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        widgetCount: dashboard.widgets.length,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      }));

    return {
      success: true,
      dashboards
    };
  }

  async createAlertRule(organizationId, ruleConfig) {
    try {
      const rule = {
        id: `alert_${organizationId}_${Date.now()}`,
        organizationId,
        name: ruleConfig.name,
        description: ruleConfig.description,
        metric: ruleConfig.metric,
        condition: ruleConfig.condition, // gt, lt, eq, ne
        threshold: ruleConfig.threshold,
        severity: ruleConfig.severity || 'warning', // critical, warning, info
        isActive: ruleConfig.isActive !== false,
        notificationChannels: ruleConfig.notificationChannels || [],
        createdAt: new Date(),
        lastTriggered: null,
        triggerCount: 0
      };

      this.alertRules.set(rule.id, rule);

      return {
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          metric: rule.metric,
          condition: rule.condition,
          threshold: rule.threshold,
          severity: rule.severity,
          isActive: rule.isActive
        }
      };
    } catch (error) {
      console.error('Alert rule creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async evaluateAlertRules(organizationId) {
    try {
      const rules = Array.from(this.alertRules.values())
        .filter(rule => rule.organizationId === organizationId && rule.isActive);

      const triggeredAlerts = [];

      for (const rule of rules) {
        const currentValue = await this.getCurrentMetricValue(organizationId, rule.metric);
        
        if (this.evaluateCondition(currentValue, rule.condition, rule.threshold)) {
          rule.lastTriggered = new Date();
          rule.triggerCount++;
          
          triggeredAlerts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            currentValue,
            threshold: rule.threshold,
            condition: rule.condition,
            severity: rule.severity,
            triggeredAt: rule.lastTriggered
          });

          // Send notifications
          await this.sendAlertNotifications(rule, currentValue);
        }
      }

      return {
        success: true,
        triggeredAlerts,
        totalRules: rules.length
      };
    } catch (error) {
      console.error('Alert evaluation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCurrentMetricValue(organizationId, metricName) {
    try {
      // This would typically query the metrics store
      // For now, we'll simulate some values
      const mockValues = {
        'http_requests_per_minute': Math.random() * 100,
        'error_rate': Math.random() * 0.1,
        'response_time_p95': Math.random() * 2,
        'active_users': Math.random() * 50,
        'api_errors_total': Math.random() * 10
      };

      return mockValues[metricName] || 0;
    } catch (error) {
      console.error('Metric value fetch failed:', error);
      return 0;
    }
  }

  evaluateCondition(currentValue, condition, threshold) {
    switch (condition) {
      case 'gt':
        return currentValue > threshold;
      case 'lt':
        return currentValue < threshold;
      case 'eq':
        return currentValue === threshold;
      case 'ne':
        return currentValue !== threshold;
      case 'gte':
        return currentValue >= threshold;
      case 'lte':
        return currentValue <= threshold;
      default:
        return false;
    }
  }

  async sendAlertNotifications(rule, currentValue) {
    try {
      // This would integrate with notification channels
      console.log(`ALERT: ${rule.name} - ${rule.metric} ${rule.condition} ${rule.threshold} (current: ${currentValue})`);
      
      // Could integrate with:
      // - Email notifications
      // - Slack webhooks
      // - PagerDuty
      // - SMS alerts
      
      return {
        success: true,
        message: 'Alert notifications sent'
      };
    } catch (error) {
      console.error('Alert notification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createAuditTrail(organizationId, auditData) {
    try {
      const auditEntry = {
        id: `audit_${organizationId}_${Date.now()}`,
        organizationId,
        timestamp: new Date(),
        userId: auditData.userId,
        action: auditData.action,
        resource: auditData.resource,
        resourceId: auditData.resourceId,
        details: auditData.details,
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        result: auditData.result || 'success'
      };

      this.auditTrails.set(auditEntry.id, auditEntry);

      return {
        success: true,
        auditId: auditEntry.id
      };
    } catch (error) {
      console.error('Audit trail creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAuditTrails(organizationId, filters = {}) {
    try {
      const audits = Array.from(this.auditTrails.values())
        .filter(audit => audit.organizationId === organizationId)
        .filter(audit => {
          if (filters.userId && audit.userId !== filters.userId) return false;
          if (filters.action && audit.action !== filters.action) return false;
          if (filters.resource && audit.resource !== filters.resource) return false;
          if (filters.startDate && audit.timestamp < new Date(filters.startDate)) return false;
          if (filters.endDate && audit.timestamp > new Date(filters.endDate)) return false;
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, filters.limit || 100)
        .map(audit => ({
          id: audit.id,
          timestamp: audit.timestamp,
          userId: audit.userId,
          action: audit.action,
          resource: audit.resource,
          resourceId: audit.resourceId,
          result: audit.result,
          ipAddress: audit.ipAddress
        }));

      return {
        success: true,
        audits,
        total: audits.length
      };
    } catch (error) {
      console.error('Audit trails fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTenantMetrics(organizationId, timeRange = '1h') {
    try {
      const metrics = this.tenantMetrics.get(organizationId);
      if (!metrics) {
        return {
          success: false,
          error: 'Tenant metrics not initialized'
        };
      }

      // This would typically query a time-series database
      // For now, we'll return mock data
      const mockMetrics = {
        httpRequestsTotal: Math.floor(Math.random() * 1000),
        httpRequestDuration: {
          p50: Math.random() * 0.5,
          p95: Math.random() * 2,
          p99: Math.random() * 5
        },
        activeUsers: Math.floor(Math.random() * 50),
        apiErrors: Math.floor(Math.random() * 10),
        businessMetrics: {
          orders: Math.floor(Math.random() * 100),
          revenue: Math.random() * 10000,
          customers: Math.floor(Math.random() * 200)
        }
      };

      return {
        success: true,
        metrics: mockMetrics,
        timeRange
      };
    } catch (error) {
      console.error('Tenant metrics fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTenantHealth(organizationId) {
    try {
      const metrics = await this.getTenantMetrics(organizationId);
      const alerts = await this.evaluateAlertRules(organizationId);

      const healthScore = this.calculateHealthScore(metrics.metrics, alerts.triggeredAlerts);

      return {
        success: true,
        health: {
          score: healthScore,
          status: this.getHealthStatus(healthScore),
          metrics: metrics.metrics,
          activeAlerts: alerts.triggeredAlerts.length,
          lastChecked: new Date()
        }
      };
    } catch (error) {
      console.error('Tenant health check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateHealthScore(metrics, alerts) {
    let score = 100;

    // Deduct points for errors
    if (metrics.apiErrors > 5) score -= 20;
    if (metrics.apiErrors > 10) score -= 30;

    // Deduct points for slow response times
    if (metrics.httpRequestDuration.p95 > 2) score -= 15;
    if (metrics.httpRequestDuration.p99 > 5) score -= 25;

    // Deduct points for active alerts
    score -= alerts.length * 10;

    return Math.max(0, score);
  }

  getHealthStatus(score) {
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'warning';
    if (score >= 50) return 'degraded';
    return 'critical';
  }
}

module.exports = TenantObservabilityService;
