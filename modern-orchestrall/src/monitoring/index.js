// src/monitoring/index.js - Comprehensive Monitoring System
const prometheus = require('prom-client');
const config = require('../config');
const logger = require('../utils/logger');

// Initialize Prometheus metrics
const register = new prometheus.Registry();

// Add default metrics
prometheus.collectDefaultMetrics({ register });

class MonitoringService {
  constructor() {
    this.metrics = {};
    this.initializeMetrics();
  }

  initializeMetrics() {
    // HTTP request metrics
    this.metrics.httpRequestsTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register],
    });

    this.metrics.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    // Agent execution metrics
    this.metrics.agentExecutionsTotal = new prometheus.Counter({
      name: 'agent_executions_total',
      help: 'Total number of agent executions',
      labelNames: ['agent_name', 'status'],
      registers: [register],
    });

    this.metrics.agentExecutionDuration = new prometheus.Histogram({
      name: 'agent_execution_duration_seconds',
      help: 'Duration of agent executions in seconds',
      labelNames: ['agent_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [register],
    });

    // Database metrics
    this.metrics.databaseConnections = new prometheus.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [register],
    });

    this.metrics.databaseQueriesTotal = new prometheus.Counter({
      name: 'database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table'],
      registers: [register],
    });

    this.metrics.databaseQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register],
    });

    // Cache metrics
    this.metrics.cacheHitsTotal = new prometheus.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [register],
    });

    this.metrics.cacheMissesTotal = new prometheus.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [register],
    });

    this.metrics.cacheOperationsDuration = new prometheus.Histogram({
      name: 'cache_operations_duration_seconds',
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [register],
    });

    // Authentication metrics
    this.metrics.authAttemptsTotal = new prometheus.Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'status'],
      registers: [register],
    });

    this.metrics.activeSessions = new prometheus.Gauge({
      name: 'active_sessions_total',
      help: 'Number of active user sessions',
      registers: [register],
    });

    // Business metrics
    this.metrics.organizationsTotal = new prometheus.Gauge({
      name: 'organizations_total',
      help: 'Total number of organizations',
      registers: [register],
    });

    this.metrics.usersTotal = new prometheus.Gauge({
      name: 'users_total',
      help: 'Total number of users',
      registers: [register],
    });

    this.metrics.workflowsTotal = new prometheus.Gauge({
      name: 'workflows_total',
      help: 'Total number of workflows',
      registers: [register],
    });

    // System metrics
    this.metrics.memoryUsage = new prometheus.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [register],
    });

    this.metrics.cpuUsage = new prometheus.Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [register],
    });

    // Error metrics
    this.metrics.errorsTotal = new prometheus.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [register],
    });

    logger.info('Monitoring service initialized with Prometheus metrics');
  }

  // HTTP request monitoring
  recordHttpRequest(method, route, statusCode, duration) {
    this.metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.metrics.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  // Agent execution monitoring
  recordAgentExecution(agentName, status, duration) {
    this.metrics.agentExecutionsTotal.inc({ agent_name: agentName, status });
    this.metrics.agentExecutionDuration.observe({ agent_name: agentName }, duration);
  }

  // Database monitoring
  recordDatabaseQuery(operation, table, duration) {
    this.metrics.databaseQueriesTotal.inc({ operation, table });
    this.metrics.databaseQueryDuration.observe({ operation, table }, duration);
  }

  updateDatabaseConnections(count) {
    this.metrics.databaseConnections.set(count);
  }

  // Cache monitoring
  recordCacheHit(cacheType) {
    this.metrics.cacheHitsTotal.inc({ cache_type: cacheType });
  }

  recordCacheMiss(cacheType) {
    this.metrics.cacheMissesTotal.inc({ cache_type: cacheType });
  }

  recordCacheOperation(operation, duration) {
    this.metrics.cacheOperationsDuration.observe({ operation }, duration);
  }

  // Authentication monitoring
  recordAuthAttempt(method, status) {
    this.metrics.authAttemptsTotal.inc({ method, status });
  }

  updateActiveSessions(count) {
    this.metrics.activeSessions.set(count);
  }

  // Business metrics
  updateOrganizationsCount(count) {
    this.metrics.organizationsTotal.set(count);
  }

  updateUsersCount(count) {
    this.metrics.usersTotal.set(count);
  }

  updateWorkflowsCount(count) {
    this.metrics.workflowsTotal.set(count);
  }

  // System metrics
  updateMemoryUsage(type, bytes) {
    this.metrics.memoryUsage.set({ type }, bytes);
  }

  updateCpuUsage(percent) {
    this.metrics.cpuUsage.set(percent);
  }

  // Error monitoring
  recordError(type, severity) {
    this.metrics.errorsTotal.inc({ type, severity });
  }

  // Health check monitoring
  async getHealthMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.updateMemoryUsage('rss', memoryUsage.rss);
    this.updateMemoryUsage('heapTotal', memoryUsage.heapTotal);
    this.updateMemoryUsage('heapUsed', memoryUsage.heapUsed);
    this.updateMemoryUsage('external', memoryUsage.external);

    // Calculate CPU usage percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.updateCpuUsage(cpuPercent);

    return {
      memory: memoryUsage,
      cpu: cpuUsage,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // Get all metrics
  async getMetrics() {
    return register.metrics();
  }

  // Custom metrics
  createCustomCounter(name, help, labelNames = []) {
    const counter = new prometheus.Counter({
      name,
      help,
      labelNames,
      registers: [register],
    });
    
    this.metrics[name] = counter;
    return counter;
  }

  createCustomGauge(name, help, labelNames = []) {
    const gauge = new prometheus.Gauge({
      name,
      help,
      labelNames,
      registers: [register],
    });
    
    this.metrics[name] = gauge;
    return gauge;
  }

  createCustomHistogram(name, help, labelNames = [], buckets = []) {
    const histogram = new prometheus.Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [register],
    });
    
    this.metrics[name] = histogram;
    return histogram;
  }

  // Alerting thresholds
  getAlertThresholds() {
    return {
      httpErrorRate: 0.05, // 5% error rate
      responseTime: 2.0, // 2 seconds
      memoryUsage: 0.9, // 90% memory usage
      cpuUsage: 0.8, // 80% CPU usage
      databaseConnections: 0.8, // 80% of max connections
    };
  }

  // Check for alerts
  async checkAlerts() {
    const alerts = [];
    const thresholds = this.getAlertThresholds();

    // Get current metrics
    const metrics = await this.getMetrics();
    
    // Parse metrics and check thresholds
    // This is a simplified implementation
    // In production, you'd use a proper metrics parsing library
    
    return alerts;
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    setInterval(async () => {
      try {
        await this.getHealthMetrics();
        
        // Log performance summary
        const memoryUsage = process.memoryUsage();
        logger.info('Performance metrics', {
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          },
          uptime: Math.round(process.uptime()) + 's',
        });
      } catch (error) {
        logger.error('Performance monitoring error', error);
      }
    }, 60000); // Every minute
  }

  // Business intelligence metrics
  async updateBusinessMetrics() {
    try {
      // This would typically query the database
      // For now, we'll use placeholder values
      this.updateOrganizationsCount(1);
      this.updateUsersCount(1);
      this.updateWorkflowsCount(2);
      this.updateActiveSessions(1);
    } catch (error) {
      logger.error('Business metrics update error', error);
    }
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

// Start performance monitoring
monitoringService.startPerformanceMonitoring();

module.exports = monitoringService;
