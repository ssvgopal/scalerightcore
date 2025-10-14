// src/plugins/plugin-manager.js - Advanced Plugin Management System
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const database = require('../database');

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginRegistry = new Map();
    this.conflictResolver = new Map();
    this.dependencyGraph = new Map();
    this.initializeCorePlugins();
  }

  async initialize() {
    this.prisma = database.client;
    await this.loadInstalledPlugins();
    await this.buildDependencyGraph();
  }

  // Initialize core plugins that come with the platform
  initializeCorePlugins() {
    // CRM Plugins
    this.pluginRegistry.set('salesforce-crm', {
      id: 'salesforce-crm',
      name: 'Salesforce CRM Integration',
      version: '1.0.0',
      category: 'crm',
      description: 'Complete Salesforce CRM integration with lead management, opportunity tracking, and reporting',
      capabilities: [
        'lead-management',
        'opportunity-tracking',
        'contact-sync',
        'reporting',
        'automation'
      ],
      dependencies: [],
      conflicts: ['hubspot-crm', 'pipedrive-crm'],
      compatible: ['mailchimp-marketing', 'stripe-payments', 'slack-communication'],
      configuration: {
        apiVersion: 'v58.0',
        authentication: 'oauth2',
        rateLimits: { requests: 1000, per: 'hour' },
        requiredFields: ['clientId', 'clientSecret', 'redirectUri']
      },
      pricing: {
        tier: 'premium',
        cost: '$500/month',
        features: ['unlimited-sync', 'advanced-automation', 'custom-fields']
      }
    });

    this.pluginRegistry.set('hubspot-crm', {
      id: 'hubspot-crm',
      name: 'HubSpot CRM Integration',
      version: '1.0.0',
      category: 'crm',
      description: 'HubSpot CRM integration with marketing automation and analytics',
      capabilities: [
        'contact-management',
        'lead-scoring',
        'marketing-automation',
        'analytics',
        'email-tracking'
      ],
      dependencies: [],
      conflicts: ['salesforce-crm', 'pipedrive-crm'],
      compatible: ['mailchimp-marketing', 'stripe-payments', 'slack-communication'],
      configuration: {
        apiVersion: 'v3',
        authentication: 'oauth2',
        rateLimits: { requests: 100, per: 'minute' },
        requiredFields: ['clientId', 'clientSecret', 'redirectUri']
      },
      pricing: {
        tier: 'standard',
        cost: '$200/month',
        features: ['contact-sync', 'basic-automation', 'standard-fields']
      }
    });

    // Payment Plugins
    this.pluginRegistry.set('stripe-payments', {
      id: 'stripe-payments',
      name: 'Stripe Payment Processing',
      version: '1.0.0',
      category: 'payments',
      description: 'Complete Stripe payment processing with subscription management',
      capabilities: [
        'payment-processing',
        'subscription-management',
        'invoice-generation',
        'webhook-handling',
        'refund-processing'
      ],
      dependencies: [],
      conflicts: ['paypal-payments', 'square-payments'],
      compatible: ['salesforce-crm', 'hubspot-crm', 'mailchimp-marketing'],
      configuration: {
        apiVersion: '2023-10-16',
        authentication: 'api-key',
        rateLimits: { requests: 100, per: 'second' },
        requiredFields: ['secretKey', 'publishableKey', 'webhookSecret']
      },
      pricing: {
        tier: 'pay-per-use',
        cost: '2.9% + $0.30 per transaction',
        features: ['unlimited-transactions', 'advanced-reporting', 'fraud-protection']
      }
    });

    // Marketing Plugins
    this.pluginRegistry.set('mailchimp-marketing', {
      id: 'mailchimp-marketing',
      name: 'Mailchimp Marketing Automation',
      version: '1.0.0',
      category: 'marketing',
      description: 'Email marketing automation with audience segmentation and analytics',
      capabilities: [
        'email-campaigns',
        'audience-segmentation',
        'automation-workflows',
        'analytics',
        'a-b-testing'
      ],
      dependencies: [],
      conflicts: ['constant-contact-marketing', 'sendgrid-marketing'],
      compatible: ['salesforce-crm', 'hubspot-crm', 'stripe-payments'],
      configuration: {
        apiVersion: '3.0',
        authentication: 'api-key',
        rateLimits: { requests: 10, per: 'second' },
        requiredFields: ['apiKey', 'serverPrefix']
      },
      pricing: {
        tier: 'standard',
        cost: '$50/month',
        features: ['unlimited-emails', 'advanced-segmentation', 'automation-workflows']
      }
    });

    // Communication Plugins
    this.pluginRegistry.set('slack-communication', {
      id: 'slack-communication',
      name: 'Slack Team Communication',
      version: '1.0.0',
      category: 'communication',
      description: 'Slack integration for team notifications and workflow automation',
      capabilities: [
        'message-sending',
        'channel-management',
        'workflow-automation',
        'file-sharing',
        'bot-integration'
      ],
      dependencies: [],
      conflicts: ['microsoft-teams', 'discord-communication'],
      compatible: ['salesforce-crm', 'hubspot-crm', 'stripe-payments'],
      configuration: {
        apiVersion: 'v1',
        authentication: 'oauth2',
        rateLimits: { requests: 1, per: 'second' },
        requiredFields: ['clientId', 'clientSecret', 'botToken']
      },
      pricing: {
        tier: 'free',
        cost: '$0/month',
        features: ['basic-notifications', 'channel-integration', 'bot-commands']
      }
    });

    // Analytics Plugins
    this.pluginRegistry.set('google-analytics', {
      id: 'google-analytics',
      name: 'Google Analytics Integration',
      version: '1.0.0',
      category: 'analytics',
      description: 'Google Analytics 4 integration with custom event tracking',
      capabilities: [
        'event-tracking',
        'conversion-tracking',
        'audience-analysis',
        'custom-dimensions',
        'real-time-reporting'
      ],
      dependencies: [],
      conflicts: ['adobe-analytics', 'mixpanel-analytics'],
      compatible: ['salesforce-crm', 'hubspot-crm', 'stripe-payments'],
      configuration: {
        apiVersion: 'v1',
        authentication: 'oauth2',
        rateLimits: { requests: 10000, per: 'day' },
        requiredFields: ['clientId', 'clientSecret', 'measurementId']
      },
      pricing: {
        tier: 'free',
        cost: '$0/month',
        features: ['standard-tracking', 'basic-reports', 'real-time-data']
      }
    });
  }

  // Load installed plugins from database
  async loadInstalledPlugins() {
    try {
      const installedPlugins = await this.prisma.organizationPlugin.findMany({
        where: { enabled: true },
        include: { organization: true }
      });

      for (const plugin of installedPlugins) {
        const pluginDef = this.pluginRegistry.get(plugin.pluginId);
        if (pluginDef) {
          this.plugins.set(plugin.id, {
            ...pluginDef,
            instance: plugin,
            status: plugin.status,
            config: plugin.config
          });
        }
      }

      logger.info(`Loaded ${this.plugins.size} installed plugins`);
    } catch (error) {
      logger.error('Failed to load installed plugins', error);
    }
  }

  // Build dependency graph for conflict resolution
  async buildDependencyGraph() {
    for (const [pluginId, plugin] of this.pluginRegistry) {
      this.dependencyGraph.set(pluginId, {
        dependencies: plugin.dependencies,
        conflicts: plugin.conflicts,
        compatible: plugin.compatible,
        dependents: []
      });
    }

    // Build reverse dependencies
    for (const [pluginId, graph] of this.dependencyGraph) {
      for (const dep of graph.dependencies) {
        if (this.dependencyGraph.has(dep)) {
          this.dependencyGraph.get(dep).dependents.push(pluginId);
        }
      }
    }
  }

  // Install a new plugin
  async installPlugin(organizationId, pluginId, config = {}) {
    try {
      const pluginDef = this.pluginRegistry.get(pluginId);
      if (!pluginDef) {
        throw new Error(`Plugin ${pluginId} not found in registry`);
      }

      // Check for conflicts
      const conflicts = await this.checkConflicts(organizationId, pluginId);
      if (conflicts.length > 0) {
        throw new Error(`Conflicts detected: ${conflicts.join(', ')}`);
      }

      // Validate configuration
      const validationResult = this.validateConfiguration(pluginDef, config);
      if (!validationResult.valid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      // Install the plugin
      const installedPlugin = await this.prisma.organizationPlugin.create({
        data: {
          organizationId,
          pluginId,
          name: pluginDef.name,
          version: pluginDef.version,
          config,
          enabled: true,
          status: 'installed'
        }
      });

      // Add to active plugins
      this.plugins.set(installedPlugin.id, {
        ...pluginDef,
        instance: installedPlugin,
        status: 'installed',
        config
      });

      logger.info(`Plugin ${pluginId} installed for organization ${organizationId}`);
      return installedPlugin;
    } catch (error) {
      logger.error('Plugin installation failed', error);
      throw error;
    }
  }

  // Uninstall a plugin
  async uninstallPlugin(organizationId, pluginId) {
    try {
      const plugin = await this.prisma.organizationPlugin.findFirst({
        where: { organizationId, pluginId }
      });

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // Check for dependent plugins
      const dependents = this.findDependentPlugins(pluginId, organizationId);
      if (dependents.length > 0) {
        throw new Error(`Cannot uninstall: plugins depend on this plugin: ${dependents.join(', ')}`);
      }

      // Uninstall
      await this.prisma.organizationPlugin.delete({
        where: { id: plugin.id }
      });

      this.plugins.delete(plugin.id);
      logger.info(`Plugin ${pluginId} uninstalled from organization ${organizationId}`);
    } catch (error) {
      logger.error('Plugin uninstallation failed', error);
      throw error;
    }
  }

  // Check for conflicts before installation
  async checkConflicts(organizationId, pluginId) {
    const pluginDef = this.pluginRegistry.get(pluginId);
    const conflicts = [];

    // Get installed plugins for organization
    const installedPlugins = await this.prisma.organizationPlugin.findMany({
      where: { organizationId, enabled: true }
    });

    for (const installed of installedPlugins) {
      const installedDef = this.pluginRegistry.get(installed.pluginId);
      if (installedDef && pluginDef.conflicts.includes(installed.pluginId)) {
        conflicts.push(installed.pluginId);
      }
    }

    return conflicts;
  }

  // Validate plugin configuration
  validateConfiguration(pluginDef, config) {
    const errors = [];
    const requiredFields = pluginDef.configuration?.requiredFields || [];

    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Find plugins that depend on a given plugin
  findDependentPlugins(pluginId, organizationId) {
    const dependents = [];
    const graph = this.dependencyGraph.get(pluginId);

    if (graph) {
      for (const dependent of graph.dependents) {
        // Check if this dependent is installed for the organization
        const installed = Array.from(this.plugins.values()).find(
          p => p.instance.organizationId === organizationId && p.id === dependent
        );
        if (installed) {
          dependents.push(dependent);
        }
      }
    }

    return dependents;
  }

  // Get available plugins for installation
  getAvailablePlugins(category = null) {
    const plugins = Array.from(this.pluginRegistry.values());
    
    if (category) {
      return plugins.filter(plugin => plugin.category === category);
    }
    
    return plugins;
  }

  // Get installed plugins for an organization
  getInstalledPlugins(organizationId) {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.instance.organizationId === organizationId
    );
  }

  // Generate compatibility report
  generateCompatibilityReport(organizationId) {
    const installedPlugins = this.getInstalledPlugins(organizationId);
    const report = {
      totalPlugins: installedPlugins.length,
      conflicts: [],
      recommendations: [],
      compatibilityScore: 0
    };

    let totalScore = 0;
    let maxScore = 0;

    for (const plugin of installedPlugins) {
      maxScore += 100;
      
      // Check for conflicts
      for (const otherPlugin of installedPlugins) {
        if (plugin.id !== otherPlugin.id && plugin.conflicts.includes(otherPlugin.id)) {
          report.conflicts.push({
            plugin1: plugin.id,
            plugin2: otherPlugin.id,
            type: 'conflict',
            severity: 'high'
          });
          totalScore += 0; // No points for conflicts
        } else if (plugin.id !== otherPlugin.id && plugin.compatible.includes(otherPlugin.id)) {
          totalScore += 20; // Bonus points for compatibility
        } else {
          totalScore += 50; // Neutral compatibility
        }
      }
    }

    report.compatibilityScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    // Generate recommendations
    if (report.conflicts.length > 0) {
      report.recommendations.push('Resolve plugin conflicts to improve system stability');
    }

    if (report.compatibilityScore < 70) {
      report.recommendations.push('Consider replacing conflicting plugins with compatible alternatives');
    }

    return report;
  }

  // Execute plugin functionality
  async executePlugin(pluginId, action, data, context) {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found or not installed`);
      }

      // Route to appropriate plugin handler
      switch (plugin.category) {
        case 'crm':
          return await this.executeCRMPlugin(plugin, action, data, context);
        case 'payments':
          return await this.executePaymentPlugin(plugin, action, data, context);
        case 'marketing':
          return await this.executeMarketingPlugin(plugin, action, data, context);
        case 'communication':
          return await this.executeCommunicationPlugin(plugin, action, data, context);
        case 'analytics':
          return await this.executeAnalyticsPlugin(plugin, action, data, context);
        default:
          throw new Error(`Unknown plugin category: ${plugin.category}`);
      }
    } catch (error) {
      logger.error('Plugin execution failed', error);
      throw error;
    }
  }

  // CRM Plugin execution
  async executeCRMPlugin(plugin, action, data, context) {
    // Implement CRM-specific logic
    return {
      success: true,
      result: `CRM action ${action} executed for ${plugin.name}`,
      plugin: plugin.id,
      action,
      data
    };
  }

  // Payment Plugin execution
  async executePaymentPlugin(plugin, action, data, context) {
    // Implement payment-specific logic
    return {
      success: true,
      result: `Payment action ${action} executed for ${plugin.name}`,
      plugin: plugin.id,
      action,
      data
    };
  }

  // Marketing Plugin execution
  async executeMarketingPlugin(plugin, action, data, context) {
    // Implement marketing-specific logic
    return {
      success: true,
      result: `Marketing action ${action} executed for ${plugin.name}`,
      plugin: plugin.id,
      action,
      data
    };
  }

  // Communication Plugin execution
  async executeCommunicationPlugin(plugin, action, data, context) {
    // Implement communication-specific logic
    return {
      success: true,
      result: `Communication action ${action} executed for ${plugin.name}`,
      plugin: plugin.id,
      action,
      data
    };
  }

  // Analytics Plugin execution
  async executeAnalyticsPlugin(plugin, action, data, context) {
    // Implement analytics-specific logic
    return {
      success: true,
      result: `Analytics action ${action} executed for ${plugin.name}`,
      plugin: plugin.id,
      action,
      data
    };
  }

  // Get plugin recommendations based on business description
  async getPluginRecommendations(businessDescription, organizationId) {
    const installedPlugins = this.getInstalledPlugins(organizationId);
    const installedIds = installedPlugins.map(p => p.id);
    
    const recommendations = [];
    const availablePlugins = this.getAvailablePlugins();

    for (const plugin of availablePlugins) {
      if (!installedIds.includes(plugin.id)) {
        const score = this.calculateRelevanceScore(plugin, businessDescription);
        if (score > 0.6) {
          recommendations.push({
            plugin,
            score,
            reason: this.generateRecommendationReason(plugin, businessDescription)
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  // Calculate relevance score for plugin recommendations
  calculateRelevanceScore(plugin, businessDescription) {
    const description = businessDescription.toLowerCase();
    let score = 0;

    // Check for keyword matches
    const keywords = {
      'crm': ['customer', 'lead', 'sales', 'contact', 'opportunity'],
      'payments': ['payment', 'billing', 'subscription', 'invoice', 'transaction'],
      'marketing': ['marketing', 'email', 'campaign', 'automation', 'audience'],
      'communication': ['team', 'notification', 'chat', 'message', 'collaboration'],
      'analytics': ['analytics', 'reporting', 'tracking', 'metrics', 'data']
    };

    const categoryKeywords = keywords[plugin.category] || [];
    for (const keyword of categoryKeywords) {
      if (description.includes(keyword)) {
        score += 0.2;
      }
    }

    // Check for capability matches
    for (const capability of plugin.capabilities) {
      if (description.includes(capability.replace('-', ' '))) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  // Generate recommendation reason
  generateRecommendationReason(plugin, businessDescription) {
    const reasons = [];
    
    if (businessDescription.toLowerCase().includes('customer')) {
      reasons.push('Customer management capabilities');
    }
    if (businessDescription.toLowerCase().includes('payment')) {
      reasons.push('Payment processing needs');
    }
    if (businessDescription.toLowerCase().includes('marketing')) {
      reasons.push('Marketing automation requirements');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'General business optimization';
  }
}

module.exports = PluginManager;
