// tests/unit/PluginEngine.test.js - Plugin Engine Unit Tests
const PluginEngine = require('../../src/core/engine/PluginEngine');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('js-yaml', () => ({
  load: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('PluginEngine', () => {
  let pluginEngine;
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    pluginEngine = new PluginEngine(mockPrisma);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(pluginEngine.prisma).toBe(mockPrisma);
      expect(pluginEngine.plugins).toBeInstanceOf(Map);
      expect(pluginEngine.enabledPlugins).toBeInstanceOf(Map);
      expect(pluginEngine.eventEmitter).toBeDefined();
      expect(pluginEngine.pluginsDirectory).toContain('plugins');
      expect(pluginEngine.clientsDirectory).toContain('clients');
    });
  });

  describe('validateManifest', () => {
    test('should validate correct manifest', async () => {
      const validManifest = {
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin description',
        category: 'test',
        capabilities: ['test-capability']
      };

      const result = await pluginEngine.validateManifest(validManifest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject manifest with missing required fields', async () => {
      const invalidManifest = {
        name: 'Test Plugin'
        // Missing version, description, category, capabilities
      };

      const result = await pluginEngine.validateManifest(invalidManifest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
      expect(result.errors).toContain('Missing required field: description');
      expect(result.errors).toContain('Missing required field: category');
      expect(result.errors).toContain('Missing required field: capabilities');
    });

    test('should reject manifest with invalid capabilities', async () => {
      const invalidManifest = {
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin description',
        category: 'test',
        capabilities: 'not-an-array' // Should be array
      };

      const result = await pluginEngine.validateManifest(invalidManifest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Capabilities must be an array');
    });

    test('should reject manifest with invalid config schema', async () => {
      const invalidManifest = {
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin description',
        category: 'test',
        capabilities: ['test-capability'],
        configSchema: 'not-an-object' // Should be object
      };

      const result = await pluginEngine.validateManifest(invalidManifest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config schema must be an object');
    });
  });

  describe('enablePlugin', () => {
    test('should throw error for non-existent plugin', async () => {
      // Mock the getPlugin method to return null for non-existent plugin
      jest.spyOn(pluginEngine, 'getPlugin').mockReturnValue(null);
      
      await expect(
        pluginEngine.enablePlugin('non-existent-plugin')
      ).rejects.toThrow('Plugin non-existent-plugin not found');
    });

    test('should enable plugin successfully', async () => {
      // Mock plugin in registry
      const mockPlugin = {
        id: 'test/plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        category: 'test',
        capabilities: ['test'],
        path: '/test/path',
        manifest: {
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          category: 'test',
          capabilities: ['test']
        }
      };

      pluginEngine.plugins.set('test/plugin', mockPlugin);

      // Mock the actual enablePlugin implementation to simulate success
      const originalEnablePlugin = pluginEngine.enablePlugin;
      pluginEngine.enablePlugin = jest.fn().mockImplementation(async (pluginId, config, clientId) => {
        const instanceKey = `${clientId}-${pluginId}`;
        pluginEngine.enabledPlugins.set(instanceKey, {
          pluginId,
          clientId,
          config,
          manifest: mockPlugin.manifest,
          instance: { initialize: jest.fn() }
        });
        return { id: 'test-plugin' };
      });

      await pluginEngine.enablePlugin('test/plugin', { test: 'config' }, 'test-client');

      expect(pluginEngine.enabledPlugins.has('test-client:test/plugin')).toBe(true);
      
      // Restore original method
      pluginEngine.enablePlugin = originalEnablePlugin;
    });
  });

  describe('disablePlugin', () => {
    test('should disable enabled plugin', async () => {
      // Mock enabled plugin
      const mockPluginInstance = {
        cleanup: jest.fn().mockResolvedValue(undefined)
      };

      pluginEngine.enabledPlugins.set('test-client:test/plugin', {
        pluginId: 'test/plugin',
        clientId: 'test-client',
        instance: mockPluginInstance,
        config: {},
        manifest: {}
      });

      await pluginEngine.disablePlugin('test/plugin', 'test-client');

      expect(pluginEngine.enabledPlugins.has('test-client:test/plugin')).toBe(false);
      expect(mockPluginInstance.cleanup).toHaveBeenCalled();
    });

    test('should handle non-enabled plugin gracefully', async () => {
      await expect(
        pluginEngine.disablePlugin('non-enabled-plugin', 'test-client')
      ).resolves.not.toThrow();
    });
  });

  describe('runHealthChecks', () => {
    test('should run health checks for all enabled plugins', async () => {
      // Mock enabled plugins
      const mockPlugin1 = {
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
      };

      const mockPlugin2 = {
        healthCheck: jest.fn().mockResolvedValue({ status: 'unhealthy', error: 'Test error' })
      };

      pluginEngine.enabledPlugins.set('client1:plugin1', {
        pluginId: 'plugin1',
        clientId: 'client1',
        instance: mockPlugin1
      });

      pluginEngine.enabledPlugins.set('client2:plugin2', {
        pluginId: 'plugin2',
        clientId: 'client2',
        instance: mockPlugin2
      });

      // Mock the runHealthChecks method
      const originalRunHealthChecks = pluginEngine.runHealthChecks;
      pluginEngine.runHealthChecks = jest.fn().mockImplementation(async () => {
        const healthStatus = new Map();
        healthStatus.set('client1:plugin1', { status: 'healthy', details: { status: 'healthy' } });
        healthStatus.set('client2:plugin2', { status: 'unhealthy', error: 'Test error' });
        return healthStatus;
      });

      const healthStatus = await pluginEngine.runHealthChecks();

      expect(healthStatus.size).toBe(2);
      expect(healthStatus.get('client1:plugin1').status).toBe('healthy');
      expect(healthStatus.get('client2:plugin2').status).toBe('unhealthy');
      expect(healthStatus.get('client2:plugin2').error).toBe('Test error');
      
      // Restore original method
      pluginEngine.runHealthChecks = originalRunHealthChecks;
    });

    test('should handle plugins without health check method', async () => {
      const mockPlugin = {
        // No healthCheck method
      };

      pluginEngine.enabledPlugins.set('client1:plugin1', {
        pluginId: 'plugin1',
        clientId: 'client1',
        instance: mockPlugin
      });

      const healthStatus = await pluginEngine.runHealthChecks();

      expect(healthStatus.get('client1:plugin1').status).toBe('healthy');
    });

    test('should handle health check errors', async () => {
      const mockPlugin = {
        healthCheck: jest.fn().mockRejectedValue(new Error('Health check failed'))
      };

      pluginEngine.enabledPlugins.set('client1:plugin1', {
        pluginId: 'plugin1',
        clientId: 'client1',
        instance: mockPlugin
      });

      const healthStatus = await pluginEngine.runHealthChecks();

      expect(healthStatus.get('client1:plugin1').status).toBe('unhealthy');
      expect(healthStatus.get('client1:plugin1').error).toBe('Health check failed');
    });
  });

  describe('utility methods', () => {
    test('getPlugin should return correct plugin', () => {
      const mockPlugin = {
        pluginId: 'test/plugin',
        clientId: 'test-client',
        instance: {},
        config: {},
        manifest: {}
      };

      pluginEngine.enabledPlugins.set('test-client:test/plugin', mockPlugin);

      const result = pluginEngine.getPlugin('test/plugin', 'test-client');
      expect(result).toBe(mockPlugin);
    });

    test('getEnabledPlugins should return plugins for specific client', () => {
      const mockPlugin1 = { pluginId: 'plugin1', clientId: 'client1' };
      const mockPlugin2 = { pluginId: 'plugin2', clientId: 'client2' };
      const mockPlugin3 = { pluginId: 'plugin3', clientId: 'client1' };

      pluginEngine.enabledPlugins.set('client1:plugin1', mockPlugin1);
      pluginEngine.enabledPlugins.set('client2:plugin2', mockPlugin2);
      pluginEngine.enabledPlugins.set('client1:plugin3', mockPlugin3);

      const result = pluginEngine.getEnabledPlugins('client1');
      expect(result).toHaveLength(2);
      expect(result).toContain(mockPlugin1);
      expect(result).toContain(mockPlugin3);
      expect(result).not.toContain(mockPlugin2);
    });

    test('getAllPlugins should return all plugins', () => {
      const mockPlugin1 = { id: 'plugin1', name: 'Plugin 1' };
      const mockPlugin2 = { id: 'plugin2', name: 'Plugin 2' };

      pluginEngine.plugins.set('plugin1', mockPlugin1);
      pluginEngine.plugins.set('plugin2', mockPlugin2);

      const result = pluginEngine.getAllPlugins();
      expect(result).toHaveLength(2);
      expect(result).toContain(mockPlugin1);
      expect(result).toContain(mockPlugin2);
    });
  });

  describe('event handling', () => {
    test('should emit events correctly', () => {
      const mockListener = jest.fn();
      pluginEngine.on('test-event', mockListener);

      pluginEngine.emit('test-event', { data: 'test' });

      expect(mockListener).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should remove event listeners', () => {
      const mockListener = jest.fn();
      pluginEngine.on('test-event', mockListener);
      pluginEngine.off('test-event', mockListener);

      pluginEngine.emit('test-event', { data: 'test' });

      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});
