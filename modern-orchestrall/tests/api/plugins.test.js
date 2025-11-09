// tests/api/plugins.test.js - Plugin API Tests
const fastify = require('fastify');

// Mock dependencies
jest.mock('../../src/core/engine/PluginEngine');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Plugin API Tests', () => {
  let app;
  let mockPluginEngine;

  beforeAll(async () => {
    // Create test Fastify app
    app = fastify({ logger: false });
    
    // Mock plugin engine
    mockPluginEngine = {
      getAllPlugins: jest.fn(),
      getEnabledPlugins: jest.fn(),
      enablePlugin: jest.fn(),
      disablePlugin: jest.fn(),
      runHealthChecks: jest.fn()
    };

    // Register plugin routes
    app.get('/api/plugins', async (request, reply) => {
      try {
        const plugins = mockPluginEngine.getAllPlugins();
        return {
          success: true,
          data: plugins.map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            category: plugin.category,
            capabilities: plugin.capabilities
          }))
        };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to list plugins' });
      }
    });

    app.get('/api/plugins/:clientId/enabled', async (request, reply) => {
      try {
        const { clientId } = request.params;
        const enabledPlugins = mockPluginEngine.getEnabledPlugins(clientId);
        return {
          success: true,
          data: enabledPlugins.map(plugin => ({
            pluginId: plugin.pluginId,
            clientId: plugin.clientId,
            config: plugin.config,
            manifest: plugin.manifest
          }))
        };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to get enabled plugins' });
      }
    });

    app.post('/api/plugins/:pluginId/enable', async (request, reply) => {
      try {
        const { pluginId } = request.params;
        const { config, clientId = 'default' } = request.body;
        
        const pluginInstance = await mockPluginEngine.enablePlugin(pluginId, config, clientId);
        
        return {
          success: true,
          message: `Plugin ${pluginId} enabled for client ${clientId}`,
          data: { pluginId, clientId }
        };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to enable plugin' });
      }
    });

    app.post('/api/plugins/:pluginId/disable', async (request, reply) => {
      try {
        const { pluginId } = request.params;
        const { clientId = 'default' } = request.body;
        
        await mockPluginEngine.disablePlugin(pluginId, clientId);
        
        return {
          success: true,
          message: `Plugin ${pluginId} disabled for client ${clientId}`,
          data: { pluginId, clientId }
        };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to disable plugin' });
      }
    });

    app.get('/api/plugins/health', async (request, reply) => {
      try {
        const healthStatus = await mockPluginEngine.runHealthChecks();
        return {
          success: true,
          data: Object.fromEntries(healthStatus)
        };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to check plugin health' });
      }
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/plugins', () => {
    test('should return all plugins successfully', async () => {
      const mockPlugins = [
        {
          id: 'ecommerce/shopify',
          name: 'Shopify Connector',
          version: '1.0.0',
          description: 'Shopify integration',
          category: 'ecommerce',
          capabilities: ['product-sync', 'order-sync']
        }
      ];

      mockPluginEngine.getAllPlugins.mockReturnValue(mockPlugins);

      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('ecommerce/shopify');
    });

    test('should handle plugin engine errors', async () => {
      mockPluginEngine.getAllPlugins.mockImplementation(() => {
        throw new Error('Plugin engine error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins'
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to list plugins');
    });
  });

  describe('POST /api/plugins/:pluginId/enable', () => {
    test('should enable plugin successfully', async () => {
      const mockPluginInstance = { id: 'test-plugin' };
      mockPluginEngine.enablePlugin.mockResolvedValue(mockPluginInstance);

      const response = await app.inject({
        method: 'POST',
        url: '/api/plugins/ecommerce/shopify/enable',
        payload: {
          config: { apiKey: 'test-key' },
          clientId: 'kankatala'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Plugin ecommerce/shopify enabled');
      expect(body.data.pluginId).toBe('ecommerce/shopify');
      expect(body.data.clientId).toBe('kankatala');
    });

    test('should handle plugin enable errors', async () => {
      mockPluginEngine.enablePlugin.mockRejectedValue(new Error('Enable failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/plugins/ecommerce/shopify/enable',
        payload: { config: {} }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to enable plugin');
    });
  });

  describe('GET /api/plugins/health', () => {
    test('should return plugin health status', async () => {
      const mockHealthStatus = new Map([
        ['kankatala:ecommerce/shopify', {
          pluginId: 'ecommerce/shopify',
          clientId: 'kankatala',
          status: 'healthy',
          timestamp: '2025-01-19T12:00:00Z'
        }]
      ]);

      mockPluginEngine.runHealthChecks.mockResolvedValue(mockHealthStatus);

      const response = await app.inject({
        method: 'GET',
        url: '/api/plugins/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('kankatala:ecommerce/shopify');
      expect(body.data['kankatala:ecommerce/shopify'].status).toBe('healthy');
    });
  });
});