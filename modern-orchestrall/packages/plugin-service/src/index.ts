import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import cron from 'node-cron';
import axios from 'axios';
import {
  Logger,
  ServiceError,
  ValidationError,
  NotFoundError,
  ApiResponse,
  ServiceHealth,
  PluginManifest,
  PluginInstance
} from '@orchestrall/shared';

const logger = new Logger('plugin-service');

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Initialize Prisma
const prisma = new PrismaClient();

// Plugin registry (in production, this would come from a database or external registry)
const PLUGIN_REGISTRY: Record<string, PluginManifest> = {
  'crm-salesforce': {
    id: 'crm-salesforce',
    name: 'Salesforce CRM',
    version: '1.0.0',
    description: 'Salesforce CRM integration plugin',
    author: 'Orchestrall',
    capabilities: ['crm', 'contacts', 'deals', 'leads'],
    dependencies: ['http-client'],
    config: {
      instanceUrl: { type: 'string', required: true },
      apiKey: { type: 'string', required: true, secret: true },
      apiSecret: { type: 'string', required: true, secret: true },
    },
    hooks: {
      onInstall: 'setup-salesforce-connection',
      onEnable: 'start-salesforce-sync',
      onDisable: 'stop-salesforce-sync',
      onUninstall: 'cleanup-salesforce-data',
    },
  },
  'payment-stripe': {
    id: 'payment-stripe',
    name: 'Stripe Payments',
    version: '1.0.0',
    description: 'Stripe payment processing plugin',
    author: 'Orchestrall',
    capabilities: ['payments', 'subscriptions', 'refunds'],
    dependencies: ['http-client'],
    config: {
      publishableKey: { type: 'string', required: true },
      secretKey: { type: 'string', required: true, secret: true },
      webhookSecret: { type: 'string', required: true, secret: true },
    },
    hooks: {
      onInstall: 'setup-stripe-webhooks',
      onEnable: 'activate-payment-processing',
      onDisable: 'deactivate-payment-processing',
    },
  },
  'analytics-powerbi': {
    id: 'analytics-powerbi',
    name: 'Power BI Analytics',
    version: '1.0.0',
    description: 'Microsoft Power BI integration',
    author: 'Orchestrall',
    capabilities: ['analytics', 'dashboards', 'reporting'],
    dependencies: ['http-client', 'data-processing'],
    config: {
      workspaceId: { type: 'string', required: true },
      clientId: { type: 'string', required: true, secret: true },
      clientSecret: { type: 'string', required: true, secret: true },
      tenantId: { type: 'string', required: true, secret: true },
    },
    hooks: {
      onInstall: 'setup-powerbi-connection',
      onEnable: 'start-data-sync',
      onDisable: 'stop-data-sync',
    },
  },
};

// Types
interface InstallPluginRequest {
  pluginId: string;
  config: Record<string, any>;
  name?: string;
}

interface UpdatePluginRequest {
  config?: Record<string, any>;
  enabled?: boolean;
}

// Plugin manager class
class PluginManager {
  private healthChecks: Map<string, cron.ScheduledTask> = new Map();

  async installPlugin(organizationId: string, request: InstallPluginRequest): Promise<PluginInstance> {
    const { pluginId, config, name } = request;

    // Validate plugin exists
    const manifest = PLUGIN_REGISTRY[pluginId];
    if (!manifest) {
      throw new NotFoundError(`Plugin '${pluginId}' not found`);
    }

    // Validate configuration
    this.validatePluginConfig(manifest, config);

    // Check if already installed
    const existing = await prisma.organizationPlugin.findFirst({
      where: {
        organizationId,
        pluginId,
      },
    });

    if (existing) {
      throw new ValidationError('Plugin already installed');
    }

    // Install plugin
    const plugin = await prisma.organizationPlugin.create({
      data: {
        organizationId,
        pluginId,
        name: name || manifest.name,
        version: manifest.version,
        config,
        status: 'installed',
      },
    });

    // Execute install hook
    await this.executeHook(manifest.hooks.onInstall, { organizationId, pluginId: plugin.id });

    // Start health check
    this.startHealthCheck(plugin.id, manifest);

    logger.info('Plugin installed', {
      organizationId,
      pluginId,
      pluginName: manifest.name,
    });

    return plugin;
  }

  async enablePlugin(pluginId: string): Promise<PluginInstance> {
    const plugin = await prisma.organizationPlugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundError('Plugin');
    }

    const manifest = PLUGIN_REGISTRY[plugin.pluginId];
    if (!manifest) {
      throw new NotFoundError(`Plugin manifest for '${plugin.pluginId}' not found`);
    }

    // Update status
    const updated = await prisma.organizationPlugin.update({
      where: { id: pluginId },
      data: { status: 'enabled' },
    });

    // Execute enable hook
    await this.executeHook(manifest.hooks.onEnable, { organizationId: plugin.organizationId, pluginId });

    logger.info('Plugin enabled', { pluginId, pluginName: manifest.name });
    return updated;
  }

  async disablePlugin(pluginId: string): Promise<PluginInstance> {
    const plugin = await prisma.organizationPlugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundError('Plugin');
    }

    const manifest = PLUGIN_REGISTRY[plugin.pluginId];
    if (!manifest) {
      throw new NotFoundError(`Plugin manifest for '${plugin.pluginId}' not found`);
    }

    // Update status
    const updated = await prisma.organizationPlugin.update({
      where: { id: pluginId },
      data: { status: 'disabled' },
    });

    // Execute disable hook
    await this.executeHook(manifest.hooks.onDisable, { organizationId: plugin.organizationId, pluginId });

    logger.info('Plugin disabled', { pluginId, pluginName: manifest.name });
    return updated;
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = await prisma.organizationPlugin.findUnique({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundError('Plugin');
    }

    const manifest = PLUGIN_REGISTRY[plugin.pluginId];
    if (!manifest) {
      throw new NotFoundError(`Plugin manifest for '${plugin.pluginId}' not found`);
    }

    // Execute uninstall hook
    await this.executeHook(manifest.hooks.onUninstall, { organizationId: plugin.organizationId, pluginId });

    // Stop health check
    this.stopHealthCheck(pluginId);

    // Delete plugin
    await prisma.organizationPlugin.delete({
      where: { id: pluginId },
    });

    logger.info('Plugin uninstalled', { pluginId, pluginName: manifest.name });
  }

  private validatePluginConfig(manifest: PluginManifest, config: Record<string, any>): void {
    for (const [key, field] of Object.entries(manifest.config)) {
      if (field.required && !config[key]) {
        throw new ValidationError(`Missing required config field: ${key}`);
      }
    }
  }

  private async executeHook(hookName: string | undefined, context: any): Promise<void> {
    if (!hookName) return;

    try {
      // In a real implementation, this would execute actual hook logic
      // For now, just log the hook execution
      logger.info('Executing plugin hook', { hook: hookName, context });
    } catch (error) {
      logger.error('Hook execution failed', { hook: hookName, error });
      throw new ServiceError(`Hook '${hookName}' execution failed`);
    }
  }

  private startHealthCheck(pluginId: string, manifest: PluginManifest): void {
    // Start periodic health check for the plugin
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        // Perform health check logic
        logger.debug('Plugin health check', { pluginId, pluginName: manifest.name });
      } catch (error) {
        logger.error('Plugin health check failed', { pluginId, error });
      }
    });

    this.healthChecks.set(pluginId, task);
  }

  private stopHealthCheck(pluginId: string): void {
    const task = this.healthChecks.get(pluginId);
    if (task) {
      task.stop();
      this.healthChecks.delete(pluginId);
    }
  }
}

const pluginManager = new PluginManager();

// Routes
fastify.get('/plugins', {
  schema: {
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.array(z.any()),
      }),
    },
  },
}, async (request, reply) => {
  const plugins = Object.values(PLUGIN_REGISTRY).map(manifest => ({
    ...manifest,
    installed: false, // Would check actual installation status
  }));

  const response: ApiResponse<typeof plugins> = {
    success: true,
    data: plugins,
  };

  return response;
});

fastify.get('/plugins/:pluginId', {
  schema: {
    params: z.object({
      pluginId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
}, async (request, reply) => {
  const { pluginId } = request.params;

  const manifest = PLUGIN_REGISTRY[pluginId];
  if (!manifest) {
    throw new NotFoundError(`Plugin '${pluginId}' not found`);
  }

  const response: ApiResponse<PluginManifest> = {
    success: true,
    data: manifest,
  };

  return response;
});

fastify.post('/organizations/:organizationId/plugins', {
  schema: {
    params: z.object({
      organizationId: z.string(),
    }),
    body: z.object({
      pluginId: z.string(),
      config: z.record(z.any()),
      name: z.string().optional(),
    }),
    response: {
      201: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
}, async (request, reply) => {
  const { organizationId } = request.params;
  const installRequest = request.body as InstallPluginRequest;

  const plugin = await pluginManager.installPlugin(organizationId, installRequest);

  const response: ApiResponse<PluginInstance> = {
    success: true,
    data: plugin,
  };

  return reply.code(201).send(response);
});

fastify.get('/organizations/:organizationId/plugins', {
  schema: {
    params: z.object({
      organizationId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.array(z.any()),
      }),
    },
  },
}, async (request, reply) => {
  const { organizationId } = request.params;

  const plugins = await prisma.organizationPlugin.findMany({
    where: { organizationId },
    include: {
      organization: true,
    },
  });

  const response: ApiResponse<typeof plugins> = {
    success: true,
    data: plugins,
  };

  return response;
});

fastify.put('/plugins/:pluginId', {
  schema: {
    params: z.object({
      pluginId: z.string(),
    }),
    body: z.object({
      config: z.record(z.any()).optional(),
      enabled: z.boolean().optional(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
}, async (request, reply) => {
  const { pluginId } = request.params;
  const updates = request.body as UpdatePluginRequest;

  let plugin: PluginInstance;

  if (updates.enabled === true) {
    plugin = await pluginManager.enablePlugin(pluginId);
  } else if (updates.enabled === false) {
    plugin = await pluginManager.disablePlugin(pluginId);
  } else {
    // Update configuration
    plugin = await prisma.organizationPlugin.update({
      where: { id: pluginId },
      data: {
        config: updates.config,
        updatedAt: new Date(),
      },
    });
  }

  const response: ApiResponse<PluginInstance> = {
    success: true,
    data: plugin,
  };

  return response;
});

fastify.delete('/plugins/:pluginId', {
  schema: {
    params: z.object({
      pluginId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
  },
}, async (request, reply) => {
  const { pluginId } = request.params;

  await pluginManager.uninstallPlugin(pluginId);

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: 'Plugin uninstalled successfully' },
  };

  return response;
});

// Health check
fastify.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    const health: ServiceHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: { status: 'up' },
      },
    };

    return health;
  } catch (error) {
    logger.error('Health check failed', error);

    const health: ServiceHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: { status: 'down' },
      },
    };

    return reply.code(503).send(health);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  // Stop all health checks
  for (const task of pluginManager['healthChecks'].values()) {
    task.stop();
  }

  await prisma.$disconnect();
  await fastify.close();

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT || '3004'),
      host: process.env.HOST || '0.0.0.0',
    });

    logger.info(`Plugin service listening on port ${process.env.PORT || 3004}`);
  } catch (err) {
    logger.error('Failed to start plugin service', err);
    process.exit(1);
  }
};

start();
