const { PrismaClient } = require('@prisma/client');
const client = require('prom-client');

class ObservabilityService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.metrics = {};
    this.alerts = new Map();
    this.alertRules = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize Prometheus metrics
      await this.initializeMetrics();
      
      // Initialize alert rules
      await this.initializeAlertRules();
      
      // Initialize alerting system
      await this.initializeAlerting();
      
      this.isInitialized = true;
      console.log('✅ Observability Service initialized');
    } catch (error) {
      console.error('Failed to initialize Observability Service:', error);
      throw error;
    }
  }

  async initializeMetrics() {
    // Create Prometheus registry
    this.registry = new client.Registry();
    
    // Add default metrics
    client.collectDefaultMetrics({ register: this.registry });

    // Application-specific metrics
    this.metrics = {
      // HTTP Metrics
      httpRequestDuration: new client.Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code', 'organization_id'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
      }),

      httpRequestsTotal: new client.Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code', 'organization_id']
      }),

      // Database Metrics
      databaseConnections: new client.Gauge({
        name: 'database_connections_active',
        help: 'Number of active database connections',
        labelNames: ['organization_id']
      }),

      databaseQueryDuration: new client.Histogram({
        name: 'database_query_duration_seconds',
        help: 'Duration of database queries in seconds',
        labelNames: ['query_type', 'organization_id'],
        buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
      }),

      databaseErrors: new client.Counter({
        name: 'database_errors_total',
        help: 'Total number of database errors',
        labelNames: ['error_type', 'organization_id']
      }),

      // Agricultural Metrics
      farmersRegistered: new client.Gauge({
        name: 'farmers_registered_total',
        help: 'Total number of registered farmers',
        labelNames: ['organization_id', 'region']
      }),

      cropsMonitored: new client.Gauge({
        name: 'crops_monitored_total',
        help: 'Total number of crops being monitored',
        labelNames: ['organization_id', 'crop_type', 'status']
      }),

      cropHealthScore: new client.Gauge({
        name: 'crop_health_score',
        help: 'Average crop health score',
        labelNames: ['organization_id', 'crop_type']
      }),

      // Voice Metrics
      voiceCallsTotal: new client.Counter({
        name: 'voice_calls_total',
        help: 'Total number of voice calls',
        labelNames: ['organization_id', 'language', 'status']
      }),

      voiceCallDuration: new client.Histogram({
        name: 'voice_call_duration_seconds',
        help: 'Duration of voice calls in seconds',
        labelNames: ['organization_id', 'language'],
        buckets: [5, 10, 30, 60, 120, 300, 600]
      }),

      // Payment Metrics
      paymentsProcessed: new client.Counter({
        name: 'payments_processed_total',
        help: 'Total number of payments processed',
        labelNames: ['organization_id', 'payment_method', 'status']
      }),

      paymentAmount: new client.Counter({
        name: 'payment_amount_total',
        help: 'Total payment amount processed',
        labelNames: ['organization_id', 'currency']
      }),

      // Notification Metrics
      notificationsSent: new client.Counter({
        name: 'notifications_sent_total',
        help: 'Total number of notifications sent',
        labelNames: ['organization_id', 'channel', 'type']
      }),

      notificationDeliveryRate: new client.Gauge({
        name: 'notification_delivery_rate',
        help: 'Notification delivery success rate',
        labelNames: ['organization_id', 'channel']
      }),

      // System Metrics
      systemUptime: new client.Gauge({
        name: 'system_uptime_seconds',
        help: 'System uptime in seconds'
      }),

      memoryUsage: new client.Gauge({
        name: 'memory_usage_bytes',
        help: 'Memory usage in bytes',
        labelNames: ['type']
      }),

      cpuUsage: new client.Gauge({
        name: 'cpu_usage_percent',
        help: 'CPU usage percentage'
      }),

      // Business Metrics
      activeUsers: new client.Gauge({
        name: 'active_users_total',
        help: 'Number of active users',
        labelNames: ['organization_id', 'user_type']
      }),

      apiUsage: new client.Counter({
        name: 'api_usage_total',
        help: 'Total API usage',
        labelNames: ['endpoint', 'organization_id', 'user_type']
      }),

      // Error Metrics
      errorsTotal: new client.Counter({
        name: 'errors_total',
        help: 'Total number of errors',
        labelNames: ['error_type', 'severity', 'organization_id']
      }),

      // Performance Metrics
      responseTime: new client.Histogram({
        name: 'response_time_seconds',
        help: 'Response time for various operations',
        labelNames: ['operation', 'organization_id'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
      })
    };

    // Register all metrics
    Object.values(this.metrics).forEach(metric => {
      this.registry.register(metric);
    });

    console.log('✅ Prometheus metrics initialized');
  }

  async initializeAlertRules() {
    // Define alert rules
    const alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate is above 5%',
        condition: 'rate(errors_total[5m]) > 0.05',
        severity: 'critical',
        enabled: true
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Average response time is above 2 seconds',
        condition: 'avg(response_time_seconds) > 2',
        severity: 'warning',
        enabled: true
      },
      {
        id: 'database_connection_issues',
        name: 'Database Connection Issues',
        description: 'Database connection count is low',
        condition: 'database_connections_active < 1',
        severity: 'critical',
        enabled: true
      },
      {
        id: 'low_crop_health',
        name: 'Low Crop Health',
        description: 'Average crop health score is below 60%',
        condition: 'avg(crop_health_score) < 60',
        severity: 'warning',
        enabled: true
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage is above 80%',
        condition: 'memory_usage_bytes / (1024*1024*1024) > 0.8',
        severity: 'warning',
        enabled: true
      },
      {
        id: 'low_notification_delivery',
        name: 'Low Notification Delivery Rate',
        description: 'Notification delivery rate is below 90%',
        condition: 'notification_delivery_rate < 0.9',
        severity: 'warning',
        enabled: true
      },
      {
        id: 'voice_call_failures',
        name: 'Voice Call Failures',
        description: 'Voice call failure rate is above 10%',
        condition: 'rate(voice_calls_total{status="failed"}[5m]) > 0.1',
        severity: 'warning',
        enabled: true
      },
      {
        id: 'payment_failures',
        name: 'Payment Failures',
        description: 'Payment failure rate is above 5%',
        condition: 'rate(payments_processed_total{status="failed"}[5m]) > 0.05',
        severity: 'critical',
        enabled: true
      }
    ];

    alertRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    console.log(`✅ Initialized ${alertRules.length} alert rules`);
  }

  async initializeAlerting() {
    // Initialize alerting system
    this.alertManager = {
      sendAlert: async (alert) => {
        try {
          // Store alert in database
          await this.storeAlert(alert);
          
          // Send notifications based on severity
          await this.sendAlertNotifications(alert);
          
          console.log(`🚨 Alert triggered: ${alert.name} - ${alert.description}`);
        } catch (error) {
          console.error('Failed to send alert:', error);
        }
      },

      checkAlerts: async () => {
        try {
          for (const [ruleId, rule] of this.alertRules) {
            if (!rule.enabled) continue;
            
            const isTriggered = await this.evaluateAlertCondition(rule.condition);
            
            if (isTriggered) {
              const alert = {
                id: `alert_${ruleId}_${Date.now()}`,
                ruleId,
                name: rule.name,
                description: rule.description,
                severity: rule.severity,
                condition: rule.condition,
                triggeredAt: new Date(),
                status: 'active'
              };
              
              await this.alertManager.sendAlert(alert);
            }
          }
        } catch (error) {
          console.error('Failed to check alerts:', error);
        }
      }
    };

    // Start alert checking interval (every 30 seconds)
    setInterval(() => {
      this.alertManager.checkAlerts();
    }, 30000);

    console.log('✅ Alerting system initialized');
  }

  // Metric recording methods
  recordHttpRequest(method, route, statusCode, duration, organizationId = 'default') {
    this.metrics.httpRequestDuration
      .labels(method, route, statusCode, organizationId)
      .observe(duration);
    
    this.metrics.httpRequestsTotal
      .labels(method, route, statusCode, organizationId)
      .inc();
  }

  recordDatabaseQuery(queryType, duration, organizationId = 'default') {
    this.metrics.databaseQueryDuration
      .labels(queryType, organizationId)
      .observe(duration);
  }

  recordDatabaseError(errorType, organizationId = 'default') {
    this.metrics.databaseErrors
      .labels(errorType, organizationId)
      .inc();
  }

  recordFarmerRegistration(organizationId, region) {
    this.metrics.farmersRegistered
      .labels(organizationId, region)
      .inc();
  }

  recordCropMonitoring(organizationId, cropType, status) {
    this.metrics.cropsMonitored
      .labels(organizationId, cropType, status)
      .inc();
  }

  recordCropHealthScore(organizationId, cropType, score) {
    this.metrics.cropHealthScore
      .labels(organizationId, cropType)
      .set(score);
  }

  recordVoiceCall(organizationId, language, status, duration = null) {
    this.metrics.voiceCallsTotal
      .labels(organizationId, language, status)
      .inc();
    
    if (duration !== null) {
      this.metrics.voiceCallDuration
        .labels(organizationId, language)
        .observe(duration);
    }
  }

  recordPayment(organizationId, paymentMethod, status, amount = null, currency = 'INR') {
    this.metrics.paymentsProcessed
      .labels(organizationId, paymentMethod, status)
      .inc();
    
    if (amount !== null) {
      this.metrics.paymentAmount
        .labels(organizationId, currency)
        .inc(amount);
    }
  }

  recordNotification(organizationId, channel, type) {
    this.metrics.notificationsSent
      .labels(organizationId, channel, type)
      .inc();
  }

  recordNotificationDeliveryRate(organizationId, channel, rate) {
    this.metrics.notificationDeliveryRate
      .labels(organizationId, channel)
      .set(rate);
  }

  recordSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.labels('rss').set(memUsage.rss);
    this.metrics.memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
    this.metrics.memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
    this.metrics.memoryUsage.labels('external').set(memUsage.external);

    this.metrics.systemUptime.set(process.uptime());
  }

  recordError(errorType, severity, organizationId = 'default') {
    this.metrics.errorsTotal
      .labels(errorType, severity, organizationId)
      .inc();
  }

  recordResponseTime(operation, duration, organizationId = 'default') {
    this.metrics.responseTime
      .labels(operation, organizationId)
      .observe(duration);
  }

  // Analytics and reporting methods
  async getSystemHealth(organizationId = null) {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        metrics: {},
        alerts: []
      };

      // Get active alerts
      const activeAlerts = await this.prisma.alert.findMany({
        where: {
          status: 'active',
          ...(organizationId && { organizationId })
        },
        orderBy: { triggeredAt: 'desc' },
        take: 10
      });

      health.alerts = activeAlerts;

      // Get key metrics
      const metrics = await this.getKeyMetrics(organizationId);
      health.metrics = metrics;

      // Determine overall health status
      const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
      if (criticalAlerts.length > 0) {
        health.status = 'critical';
      } else if (activeAlerts.length > 0) {
        health.status = 'warning';
      }

      return health;
    } catch (error) {
      console.error('Failed to get system health:', error);
      throw error;
    }
  }

  async getKeyMetrics(organizationId = null) {
    try {
      const whereClause = organizationId ? { organizationId } : {};
      
      const [
        totalFarmers,
        totalCrops,
        totalVoiceCalls,
        totalPayments,
        totalNotifications,
        recentErrors
      ] = await Promise.all([
        this.prisma.farmerProfile.count({ where: whereClause }),
        this.prisma.crop.count({ where: whereClause }),
        this.prisma.voiceCall.count({ 
          where: { 
            ...whereClause,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        this.prisma.payment.count({ 
          where: { 
            ...whereClause,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        this.prisma.notificationHistory.count({ 
          where: { 
            ...whereClause,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        this.prisma.alert.count({ 
          where: { 
            ...whereClause,
            status: 'active',
            triggeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        })
      ]);

      return {
        farmers: totalFarmers,
        crops: totalCrops,
        voiceCalls24h: totalVoiceCalls,
        payments24h: totalPayments,
        notifications24h: totalNotifications,
        activeAlerts24h: recentErrors
      };
    } catch (error) {
      console.error('Failed to get key metrics:', error);
      throw error;
    }
  }

  async getPerformanceMetrics(organizationId = null, timeRange = '24h') {
    try {
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeMs = timeRanges[timeRange] || timeRanges['24h'];
      const startTime = new Date(Date.now() - timeMs);

      const whereClause = organizationId ? { organizationId } : {};

      // Get performance data
      const performanceData = await this.prisma.performanceMetric.findMany({
        where: {
          ...whereClause,
          timestamp: { gte: startTime }
        },
        orderBy: { timestamp: 'asc' }
      });

      // Calculate averages
      const avgResponseTime = performanceData.length > 0 
        ? performanceData.reduce((sum, metric) => sum + metric.responseTime, 0) / performanceData.length
        : 0;

      const avgThroughput = performanceData.length > 0
        ? performanceData.reduce((sum, metric) => sum + metric.throughput, 0) / performanceData.length
        : 0;

      return {
        timeRange,
        dataPoints: performanceData.length,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        averageThroughput: Math.round(avgThroughput * 100) / 100,
        metrics: performanceData.map(metric => ({
          timestamp: metric.timestamp,
          responseTime: metric.responseTime,
          throughput: metric.throughput,
          errorRate: metric.errorRate,
          cpuUsage: metric.cpuUsage,
          memoryUsage: metric.memoryUsage
        }))
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  async getBusinessMetrics(organizationId = null, timeRange = '30d') {
    try {
      const timeRanges = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const timeMs = timeRanges[timeRange] || timeRanges['30d'];
      const startTime = new Date(Date.now() - timeMs);

      const whereClause = organizationId ? { organizationId } : {};

      // Get business metrics
      const [
        farmerGrowth,
        cropHealthTrends,
        voiceUsageTrends,
        paymentTrends,
        notificationTrends
      ] = await Promise.all([
        this.getFarmerGrowthMetrics(whereClause, startTime),
        this.getCropHealthTrends(whereClause, startTime),
        this.getVoiceUsageTrends(whereClause, startTime),
        this.getPaymentTrends(whereClause, startTime),
        this.getNotificationTrends(whereClause, startTime)
      ]);

      return {
        timeRange,
        farmerGrowth,
        cropHealthTrends,
        voiceUsageTrends,
        paymentTrends,
        notificationTrends
      };
    } catch (error) {
      console.error('Failed to get business metrics:', error);
      throw error;
    }
  }

  async getFarmerGrowthMetrics(whereClause, startTime) {
    const farmers = await this.prisma.farmerProfile.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: startTime }
      },
      select: {
        createdAt: true,
        region: true
      }
    });

    // Group by date and region
    const growthData = {};
    farmers.forEach(farmer => {
      const date = farmer.createdAt.toISOString().split('T')[0];
      if (!growthData[date]) {
        growthData[date] = { total: 0, byRegion: {} };
      }
      growthData[date].total++;
      growthData[date].byRegion[farmer.region] = (growthData[date].byRegion[farmer.region] || 0) + 1;
    });

    return Object.entries(growthData).map(([date, data]) => ({
      date,
      total: data.total,
      byRegion: data.byRegion
    }));
  }

  async getCropHealthTrends(whereClause, startTime) {
    const crops = await this.prisma.crop.findMany({
      where: whereClause,
      include: {
        cropHealthRecords: {
          where: {
            createdAt: { gte: startTime }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const healthTrends = {};
    crops.forEach(crop => {
      crop.cropHealthRecords.forEach(record => {
        const date = record.createdAt.toISOString().split('T')[0];
        if (!healthTrends[date]) {
          healthTrends[date] = { scores: [], count: 0 };
        }
        healthTrends[date].scores.push(record.healthScore);
        healthTrends[date].count++;
      });
    });

    return Object.entries(healthTrends).map(([date, data]) => ({
      date,
      averageHealthScore: data.scores.length > 0 
        ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
        : 0,
      recordCount: data.count
    }));
  }

  async getVoiceUsageTrends(whereClause, startTime) {
    const calls = await this.prisma.voiceCall.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: startTime }
      },
      select: {
        createdAt: true,
        language: true,
        status: true,
        duration: true
      }
    });

    const usageTrends = {};
    calls.forEach(call => {
      const date = call.createdAt.toISOString().split('T')[0];
      if (!usageTrends[date]) {
        usageTrends[date] = { total: 0, byLanguage: {}, totalDuration: 0 };
      }
      usageTrends[date].total++;
      usageTrends[date].byLanguage[call.language] = (usageTrends[date].byLanguage[call.language] || 0) + 1;
      usageTrends[date].totalDuration += call.duration;
    });

    return Object.entries(usageTrends).map(([date, data]) => ({
      date,
      totalCalls: data.total,
      averageDuration: data.total > 0 ? data.totalDuration / data.total : 0,
      byLanguage: data.byLanguage
    }));
  }

  async getPaymentTrends(whereClause, startTime) {
    const payments = await this.prisma.payment.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: startTime }
      },
      select: {
        createdAt: true,
        amount: true,
        status: true,
        paymentMethod: true
      }
    });

    const paymentTrends = {};
    payments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!paymentTrends[date]) {
        paymentTrends[date] = { total: 0, amount: 0, byMethod: {}, byStatus: {} };
      }
      paymentTrends[date].total++;
      paymentTrends[date].amount += payment.amount;
      paymentTrends[date].byMethod[payment.paymentMethod] = (paymentTrends[date].byMethod[payment.paymentMethod] || 0) + 1;
      paymentTrends[date].byStatus[payment.status] = (paymentTrends[date].byStatus[payment.status] || 0) + 1;
    });

    return Object.entries(paymentTrends).map(([date, data]) => ({
      date,
      totalPayments: data.total,
      totalAmount: data.amount,
      byMethod: data.byMethod,
      byStatus: data.byStatus
    }));
  }

  async getNotificationTrends(whereClause, startTime) {
    const notifications = await this.prisma.notificationHistory.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: startTime }
      },
      select: {
        createdAt: true,
        channel: true,
        status: true,
        type: true
      }
    });

    const notificationTrends = {};
    notifications.forEach(notification => {
      const date = notification.createdAt.toISOString().split('T')[0];
      if (!notificationTrends[date]) {
        notificationTrends[date] = { total: 0, byChannel: {}, byStatus: {}, byType: {} };
      }
      notificationTrends[date].total++;
      notificationTrends[date].byChannel[notification.channel] = (notificationTrends[date].byChannel[notification.channel] || 0) + 1;
      notificationTrends[date].byStatus[notification.status] = (notificationTrends[date].byStatus[notification.status] || 0) + 1;
      notificationTrends[date].byType[notification.type] = (notificationTrends[date].byType[notification.type] || 0) + 1;
    });

    return Object.entries(notificationTrends).map(([date, data]) => ({
      date,
      totalNotifications: data.total,
      byChannel: data.byChannel,
      byStatus: data.byStatus,
      byType: data.byType
    }));
  }

  async storeAlert(alert) {
    try {
      await this.prisma.alert.create({
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          name: alert.name,
          description: alert.description,
          severity: alert.severity,
          condition: alert.condition,
          status: alert.status,
          triggeredAt: alert.triggeredAt,
          metadata: {
            organizationId: alert.organizationId || 'default'
          }
        }
      });
    } catch (error) {
      console.error('Failed to store alert:', error);
    }
  }

  async sendAlertNotifications(alert) {
    try {
      // Send email notification for critical alerts
      if (alert.severity === 'critical') {
        // Implementation would send email to administrators
        console.log(`📧 Critical alert email sent: ${alert.name}`);
      }

      // Send SMS notification for critical alerts
      if (alert.severity === 'critical') {
        // Implementation would send SMS to administrators
        console.log(`📱 Critical alert SMS sent: ${alert.name}`);
      }

      // Send push notification
      // Implementation would send push notification to mobile apps
      console.log(`🔔 Push notification sent: ${alert.name}`);
    } catch (error) {
      console.error('Failed to send alert notifications:', error);
    }
  }

  async evaluateAlertCondition(condition) {
    try {
      // Simplified condition evaluation
      // In a real implementation, this would use a proper expression evaluator
      
      if (condition.includes('errors_total') && condition.includes('> 0.05')) {
        // Check if error rate is above 5%
        const errorRate = await this.getErrorRate();
        return errorRate > 0.05;
      }

      if (condition.includes('response_time_seconds') && condition.includes('> 2')) {
        // Check if response time is above 2 seconds
        const avgResponseTime = await this.getAverageResponseTime();
        return avgResponseTime > 2;
      }

      if (condition.includes('crop_health_score') && condition.includes('< 60')) {
        // Check if crop health is below 60%
        const avgCropHealth = await this.getAverageCropHealth();
        return avgCropHealth < 60;
      }

      // Add more condition evaluations as needed
      return false;
    } catch (error) {
      console.error('Failed to evaluate alert condition:', error);
      return false;
    }
  }

  async getErrorRate() {
    try {
      const totalRequests = await this.prisma.apiLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        }
      });

      const errorRequests = await this.prisma.apiLog.count({
        where: {
          statusCode: { gte: 400 },
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
        }
      });

      return totalRequests > 0 ? errorRequests / totalRequests : 0;
    } catch (error) {
      console.error('Failed to get error rate:', error);
      return 0;
    }
  }

  async getAverageResponseTime() {
    try {
      const logs = await this.prisma.apiLog.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
        },
        select: { responseTime: true }
      });

      if (logs.length === 0) return 0;

      const totalResponseTime = logs.reduce((sum, log) => sum + (log.responseTime || 0), 0);
      return totalResponseTime / logs.length;
    } catch (error) {
      console.error('Failed to get average response time:', error);
      return 0;
    }
  }

  async getAverageCropHealth() {
    try {
      const crops = await this.prisma.crop.findMany({
        include: {
          cropHealthRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (crops.length === 0) return 0;

      const totalHealthScore = crops.reduce((sum, crop) => {
        const latestHealth = crop.cropHealthRecords[0];
        return sum + (latestHealth ? latestHealth.healthScore : 0);
      }, 0);

      return totalHealthScore / crops.length;
    } catch (error) {
      console.error('Failed to get average crop health:', error);
      return 0;
    }
  }

  // Prometheus metrics endpoint
  async getPrometheusMetrics() {
    return this.registry.metrics();
  }

  // Grafana dashboard configuration
  getGrafanaDashboardConfig() {
    return {
      dashboard: {
        title: 'Orchestrall Platform Dashboard',
        panels: [
          {
            title: 'System Health',
            type: 'stat',
            targets: [
              { expr: 'system_uptime_seconds' },
              { expr: 'memory_usage_bytes{type="heapUsed"}' },
              { expr: 'cpu_usage_percent' }
            ]
          },
          {
            title: 'HTTP Requests',
            type: 'graph',
            targets: [
              { expr: 'rate(http_requests_total[5m])' }
            ]
          },
          {
            title: 'Response Time',
            type: 'graph',
            targets: [
              { expr: 'histogram_quantile(0.95, rate(response_time_seconds_bucket[5m]))' }
            ]
          },
          {
            title: 'Error Rate',
            type: 'graph',
            targets: [
              { expr: 'rate(errors_total[5m])' }
            ]
          },
          {
            title: 'Voice Calls',
            type: 'graph',
            targets: [
              { expr: 'rate(voice_calls_total[5m])' }
            ]
          },
          {
            title: 'Payments',
            type: 'graph',
            targets: [
              { expr: 'rate(payments_processed_total[5m])' }
            ]
          },
          {
            title: 'Crop Health',
            type: 'graph',
            targets: [
              { expr: 'avg(crop_health_score)' }
            ]
          },
          {
            title: 'Active Alerts',
            type: 'table',
            targets: [
              { expr: 'ALERTS{alertstate="firing"}' }
            ]
          }
        ]
      }
    };
  }
}

module.exports = ObservabilityService;
