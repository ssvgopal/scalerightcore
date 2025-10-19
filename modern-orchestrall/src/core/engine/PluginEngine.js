// src/core/engine/PluginEngine.js - Core Plugin Discovery and Lifecycle Management
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');
const logger = require('../../utils/logger');

class PluginEngine {
  constructor(prisma) {
    this.prisma = prisma;
    this.plugins = new Map();
    this.enabledPlugins = new Map();
    this.eventEmitter = new EventEmitter();
    this.pluginsDirectory = path.join(__dirname, '../../../plugins');
    this.clientsDirectory = path.join(__dirname, '../../../clients');
  }

  async initialize() {
    try {
      logger.info('Initializing Plugin Engine...');
      
      // Scan plugins directory
      await this.scanPlugins();
      
      // Load client configurations
      await this.loadClientConfigurations();
      
      logger.info(`Plugin Engine initialized with ${this.plugins.size} plugins`);
      
      // Emit initialization complete event
      this.eventEmitter.emit('plugin-engine:initialized', {
        totalPlugins: this.plugins.size,
        enabledPlugins: this.enabledPlugins.size
      });
      
    } catch (error) {
      logger.error('Failed to initialize Plugin Engine', error);
      throw error;
    }
  }

  async scanPlugins() {
    try {
      logger.info('Scanning plugins directory...');
      
      if (!await this.directoryExists(this.pluginsDirectory)) {
        logger.warn('Plugins directory does not exist, creating...');
        await fs.mkdir(this.pluginsDirectory, { recursive: true });
        return;
      }

      const categories = await fs.readdir(this.pluginsDirectory);
      
      for (const category of categories) {
        const categoryPath = path.join(this.pluginsDirectory, category);
        const stat = await fs.stat(categoryPath);
        
        if (stat.isDirectory()) {
          await this.scanCategory(category, categoryPath);
        }
      }
      
      logger.info(`Scanned ${this.plugins.size} plugins`);
      
    } catch (error) {
      logger.error('Failed to scan plugins', error);
      throw error;
    }
  }

  async scanCategory(category, categoryPath) {
    try {
      const plugins = await fs.readdir(categoryPath);
      
      for (const pluginName of plugins) {
        const pluginPath = path.join(categoryPath, pluginName);
        const stat = await fs.stat(pluginPath);
        
        if (stat.isDirectory()) {
          await this.loadPluginManifest(category, pluginName, pluginPath);
        }
      }
      
    } catch (error) {
      logger.error(`Failed to scan category ${category}`, error);
    }
  }

  async loadPluginManifest(category, pluginName, pluginPath) {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.yaml');
      
      if (!await this.fileExists(manifestPath)) {
        logger.warn(`No plugin.yaml found for ${category}/${pluginName}`);
        return;
      }

      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent);
      
      // Validate manifest
      const validation = await this.validateManifest(manifest);
      if (!validation.valid) {
        logger.error(`Invalid manifest for ${category}/${pluginName}:`, validation.errors);
        return;
      }

      const pluginId = `${category}/${pluginName}`;
      const pluginInfo = {
        id: pluginId,
        category,
        name: pluginName,
        path: pluginPath,
        manifest,
        ...manifest
      };

      this.plugins.set(pluginId, pluginInfo);
      
      logger.info(`Loaded plugin: ${pluginId}`);
      
    } catch (error) {
      logger.error(`Failed to load manifest for ${category}/${pluginName}`, error);
    }
  }

  async validateManifest(manifest) {
    const errors = [];
    
    // Required fields
    const requiredFields = ['name', 'version', 'description', 'category', 'capabilities'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate capabilities
    if (manifest.capabilities && !Array.isArray(manifest.capabilities)) {
      errors.push('Capabilities must be an array');
    }
    
    // Validate configuration schema
    if (manifest.configSchema) {
      if (typeof manifest.configSchema !== 'object') {
        errors.push('Config schema must be an object');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async loadClientConfigurations() {
    try {
      logger.info('Loading client configurations...');
      
      if (!await this.directoryExists(this.clientsDirectory)) {
        logger.warn('Clients directory does not exist, creating...');
        await fs.mkdir(this.clientsDirectory, { recursive: true });
        return;
      }

      const clients = await fs.readdir(this.clientsDirectory);
      
      for (const clientId of clients) {
        const clientPath = path.join(this.clientsDirectory, clientId);
        const stat = await fs.stat(clientPath);
        
        if (stat.isDirectory()) {
          await this.loadClientConfig(clientId, clientPath);
        }
      }
      
    } catch (error) {
      logger.error('Failed to load client configurations', error);
    }
  }

  async loadClientConfig(clientId, clientPath) {
    try {
      const configPath = path.join(clientPath, 'config.yaml');
      const pluginsPath = path.join(clientPath, 'plugins.yaml');
      
      let config = {};
      let pluginsConfig = {};
      
      if (await this.fileExists(configPath)) {
        const configContent = await fs.readFile(configPath, 'utf8');
        config = yaml.load(configContent);
      }
      
      if (await this.fileExists(pluginsPath)) {
        const pluginsContent = await fs.readFile(pluginsPath, 'utf8');
        pluginsConfig = yaml.load(pluginsContent);
      }
      
      const clientConfig = {
        id: clientId,
        path: clientPath,
        config,
        plugins: pluginsConfig.plugins || []
      };
      
      logger.info(`Loaded client config: ${clientId}`);
      
      // Enable plugins for this client
      await this.enableClientPlugins(clientId, clientConfig);
      
    } catch (error) {
      logger.error(`Failed to load client config for ${clientId}`, error);
    }
  }

  async enableClientPlugins(clientId, clientConfig) {
    try {
      for (const pluginConfig of clientConfig.plugins) {
        if (pluginConfig.enabled) {
          await this.enablePlugin(pluginConfig.id, pluginConfig.config || {}, clientId);
        }
      }
    } catch (error) {
      logger.error(`Failed to enable plugins for client ${clientId}`, error);
    }
  }

  async enablePlugin(pluginId, config = {}, clientId = 'default') {
    try {
      const pluginInfo = this.plugins.get(pluginId);
      if (!pluginInfo) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      logger.info(`Enabling plugin: ${pluginId} for client: ${clientId}`);

      // Load plugin module
      const pluginModulePath = path.join(pluginInfo.path, 'index.js');
      if (!await this.fileExists(pluginModulePath)) {
        throw new Error(`Plugin module not found: ${pluginModulePath}`);
      }

      // Dynamic import
      const PluginClass = require(pluginModulePath);
      const pluginInstance = new PluginClass({
        prisma: this.prisma,
        config,
        clientId,
        logger
      });

      // Initialize plugin
      if (typeof pluginInstance.initialize === 'function') {
        await pluginInstance.initialize();
      }

      // Register plugin instance
      const enabledKey = `${clientId}:${pluginId}`;
      this.enabledPlugins.set(enabledKey, {
        pluginId,
        clientId,
        instance: pluginInstance,
        config,
        manifest: pluginInfo.manifest
      });

      // Emit plugin enabled event
      this.eventEmitter.emit('plugin:enabled', {
        pluginId,
        clientId,
        config
      });

      logger.info(`Plugin ${pluginId} enabled for client ${clientId}`);

      return pluginInstance;

    } catch (error) {
      logger.error(`Failed to enable plugin ${pluginId}`, error);
      throw error;
    }
  }

  async disablePlugin(pluginId, clientId = 'default') {
    try {
      const enabledKey = `${clientId}:${pluginId}`;
      const enabledPlugin = this.enabledPlugins.get(enabledKey);
      
      if (!enabledPlugin) {
        logger.warn(`Plugin ${pluginId} not enabled for client ${clientId}`);
        return;
      }

      // Cleanup plugin instance
      if (typeof enabledPlugin.instance.cleanup === 'function') {
        await enabledPlugin.instance.cleanup();
      }

      // Remove from enabled plugins
      this.enabledPlugins.delete(enabledKey);

      // Emit plugin disabled event
      this.eventEmitter.emit('plugin:disabled', {
        pluginId,
        clientId
      });

      logger.info(`Plugin ${pluginId} disabled for client ${clientId}`);

    } catch (error) {
      logger.error(`Failed to disable plugin ${pluginId}`, error);
      throw error;
    }
  }

  async runHealthChecks() {
    const healthStatus = new Map();
    
    for (const [key, enabledPlugin] of this.enabledPlugins) {
      try {
        let status = 'healthy';
        
        if (typeof enabledPlugin.instance.healthCheck === 'function') {
          const result = await enabledPlugin.instance.healthCheck();
          status = result.status || 'healthy';
        }
        
        healthStatus.set(key, {
          pluginId: enabledPlugin.pluginId,
          clientId: enabledPlugin.clientId,
          status,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        healthStatus.set(key, {
          pluginId: enabledPlugin.pluginId,
          clientId: enabledPlugin.clientId,
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return healthStatus;
  }

  getPlugin(pluginId, clientId = 'default') {
    const enabledKey = `${clientId}:${pluginId}`;
    return this.enabledPlugins.get(enabledKey);
  }

  getEnabledPlugins(clientId = 'default') {
    const plugins = [];
    for (const [key, enabledPlugin] of this.enabledPlugins) {
      if (enabledPlugin.clientId === clientId) {
        plugins.push(enabledPlugin);
      }
    }
    return plugins;
  }

  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  // Utility methods
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  // Event handling
  on(event, listener) {
    this.eventEmitter.on(event, listener);
  }

  off(event, listener) {
    this.eventEmitter.off(event, listener);
  }

  emit(event, data) {
    this.eventEmitter.emit(event, data);
  }
}

module.exports = PluginEngine;
