const fs = require('fs').promises;
const path = require('path');

class PluginCatalogService {
  constructor() {
    this.catalogPath = path.join(__dirname, 'catalog.json');
    this.catalog = null;
    this.lastHealthCheck = new Map();
  }

  async loadCatalog() {
    try {
      const data = await fs.readFile(this.catalogPath, 'utf8');
      this.catalog = JSON.parse(data);
      return this.catalog;
    } catch (error) {
      console.error('Failed to load plugin catalog:', error);
      throw new Error('Plugin catalog unavailable');
    }
  }

  async getCatalog() {
    if (!this.catalog) {
      await this.loadCatalog();
    }
    return this.catalog;
  }

  async getPlugin(pluginId) {
    const catalog = await this.getCatalog();
    return catalog.plugins.find(p => p.id === pluginId);
  }

  async updatePluginHealth(pluginId, healthData) {
    const catalog = await this.getCatalog();
    const plugin = catalog.plugins.find(p => p.id === pluginId);
    
    if (plugin) {
      plugin.health = {
        ...plugin.health,
        ...healthData,
        lastChecked: new Date().toISOString()
      };
      
      // Update catalog file
      await fs.writeFile(this.catalogPath, JSON.stringify(catalog, null, 2));
      this.lastHealthCheck.set(pluginId, Date.now());
    }
  }

  async performHealthCheck(pluginId) {
    const plugin = await this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Simulate health checks based on plugin type
    const healthChecks = await this.runHealthChecks(plugin);
    
    await this.updatePluginHealth(pluginId, healthChecks);
    return healthChecks;
  }

  async runHealthChecks(plugin) {
    const checks = {};
    let overallScore = 100;
    let status = 'healthy';

    // Simulate different health checks based on plugin category
    switch (plugin.category) {
      case 'payments':
        checks.apiConnectivity = Math.random() > 0.1 ? 'pass' : 'fail';
        checks.webhookDelivery = Math.random() > 0.05 ? 'pass' : 'fail';
        checks.refundProcessing = Math.random() > 0.08 ? 'pass' : 'fail';
        break;
      
      case 'crm':
        checks.oauthToken = Math.random() > 0.15 ? 'pass' : 'fail';
        checks.apiRateLimit = Math.random() > 0.1 ? 'pass' : 'warning';
        checks.dataSync = Math.random() > 0.2 ? 'pass' : 'warning';
        break;
      
      case 'search':
        checks.clusterHealth = Math.random() > 0.05 ? 'pass' : 'fail';
        checks.indexingSpeed = Math.random() > 0.1 ? 'pass' : 'warning';
        checks.queryLatency = Math.random() > 0.08 ? 'pass' : 'warning';
        break;
      
      case 'voice':
        checks.apiConnectivity = Math.random() > 0.1 ? 'pass' : 'fail';
        checks.audioProcessing = Math.random() > 0.2 ? 'pass' : 'warning';
        checks.languageSupport = Math.random() > 0.05 ? 'pass' : 'fail';
        break;
      
      case 'ecommerce':
        checks.apiConnectivity = Math.random() > 0.05 ? 'pass' : 'fail';
        checks.webhookDelivery = Math.random() > 0.1 ? 'pass' : 'fail';
        checks.dataSync = Math.random() > 0.15 ? 'pass' : 'warning';
        break;
      
      default:
        checks.generalHealth = Math.random() > 0.1 ? 'pass' : 'fail';
    }

    // Calculate overall score and status
    const failedChecks = Object.values(checks).filter(check => check === 'fail').length;
    const warningChecks = Object.values(checks).filter(check => check === 'warning').length;
    
    overallScore = Math.max(0, 100 - (failedChecks * 20) - (warningChecks * 10));
    
    if (overallScore < 70) {
      status = 'unhealthy';
    } else if (overallScore < 85) {
      status = 'degraded';
    }

    return {
      status,
      score: overallScore,
      checks
    };
  }

  async enablePlugin(pluginId, organizationId) {
    const plugin = await this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Emit billing event
    this.emitBillingEvent('plugin:enabled', {
      pluginId,
      organizationId,
      pricing: plugin.pricing,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      pluginId,
      organizationId,
      message: `Plugin ${plugin.name} enabled for organization ${organizationId}`
    };
  }

  async disablePlugin(pluginId, organizationId) {
    const plugin = await this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Emit billing event
    this.emitBillingEvent('plugin:disabled', {
      pluginId,
      organizationId,
      pricing: plugin.pricing,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      pluginId,
      organizationId,
      message: `Plugin ${plugin.name} disabled for organization ${organizationId}`
    };
  }

  emitBillingEvent(eventType, data) {
    // In a real implementation, this would emit to a message queue or event system
    console.log(`BILLING_EVENT: ${eventType}`, data);
    
    // Could integrate with:
    // - Redis pub/sub
    // - RabbitMQ
    // - AWS SNS/SQS
    // - Internal event bus
  }

  async getPluginMetrics() {
    const catalog = await this.getCatalog();
    const metrics = {
      totalPlugins: catalog.plugins.length,
      healthyPlugins: catalog.plugins.filter(p => p.health.status === 'healthy').length,
      degradedPlugins: catalog.plugins.filter(p => p.health.status === 'degraded').length,
      unhealthyPlugins: catalog.plugins.filter(p => p.health.status === 'unhealthy').length,
      averageHealthScore: catalog.plugins.reduce((sum, p) => sum + p.health.score, 0) / catalog.plugins.length,
      categories: catalog.categories.length
    };

    return metrics;
  }
}

module.exports = PluginCatalogService;
