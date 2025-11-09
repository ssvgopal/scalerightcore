import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../core/config';
import { logger } from '../utils/logger';
import { FeatureFlagError } from '../middleware/error-handler';

declare module 'fastify' {
  interface FastifyRequest {
    featureFlags: Map<string, boolean>;
  }
}

interface FeatureFlagContext {
  userId?: string;
  organizationId?: string;
  environment?: string;
  custom?: Record<string, any>;
}

class FeatureFlagManager {
  private flags: Map<string, any> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    switch (config.featureFlags.provider) {
      case 'unleash':
        await this.initializeUnleash();
        break;
      case 'flagsmith':
        await this.initializeFlagsmith();
        break;
      case 'local':
      default:
        await this.initializeLocal();
        break;
    }

    this.initialized = true;
    logger.info('Feature flag system initialized');
  }

  private async initializeLocal(): Promise<void> {
    // Initialize with default feature flags
    const defaultFlags = {
      'crm-integration': { enabled: true, percentage: 100 },
      'agent-runtime': { enabled: true, percentage: 100 },
      'multi-tenancy': { enabled: true, percentage: 100 },
      'analytics-dashboard': { enabled: true, percentage: 100 },
      'workflow-automation': { enabled: true, percentage: 100 },
      'api-gateway': { enabled: true, percentage: 100 },
      'mobile-app': { enabled: false, percentage: 0 },
      'advanced-analytics': { enabled: false, percentage: 0 },
      'custom-integrations': { enabled: true, percentage: 100 },
      'agent-marketplace': { enabled: false, percentage: 0 },
    };

    for (const [name, config] of Object.entries(defaultFlags)) {
      this.flags.set(name, config);
    }
  }

  private async initializeUnleash(): Promise<void> {
    // Initialize Unleash client
    // This would integrate with actual Unleash server
    logger.info('Initializing Unleash feature flags');
  }

  private async initializeFlagsmith(): Promise<void> {
    // Initialize Flagsmith client
    // This would integrate with actual Flagsmith server
    logger.info('Initializing Flagsmith feature flags');
  }

  isEnabled(flagName: string, context?: FeatureFlagContext): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    if (!flag.enabled) return false;

    // Check percentage rollout
    if (flag.percentage < 100) {
      const hash = this.getHash(context?.userId || 'anonymous');
      const percentage = (hash % 100) + 1;
      if (percentage > flag.percentage) {
        return false;
      }
    }

    // Check organization-specific rules
    if (context?.organizationId && flag.organizationRules) {
      const orgRule = flag.organizationRules[context.organizationId];
      if (orgRule !== undefined) {
        return orgRule;
      }
    }

    return flag.enabled;
  }

  private getHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  getFlag(flagName: string): any {
    return this.flags.get(flagName);
  }

  async updateFlag(flagName: string, updates: any): Promise<void> {
    const existing = this.flags.get(flagName);
    if (existing) {
      this.flags.set(flagName, { ...existing, ...updates });
      logger.info(`Updated feature flag: ${flagName}`, updates);
    }
  }
}

export const featureFlagPlugin = fp(async (fastify: FastifyInstance) => {
  const featureManager = new FeatureFlagManager();
  await featureManager.initialize();

  // Add feature manager to fastify instance
  fastify.decorate('featureFlags', featureManager);

  // Add feature flag context to each request
  fastify.addHook('onRequest', async (request) => {
    request.featureFlags = new Map();

    // Extract context from request
    const context: FeatureFlagContext = {
      userId: request.user?.id,
      organizationId: request.user?.organizationId,
      environment: config.deployment.environment,
    };

    // Check common feature flags for this request
    const flagsToCheck = [
      'crm-integration',
      'agent-runtime',
      'analytics-dashboard',
      'workflow-automation',
      'mobile-app',
    ];

    for (const flagName of flagsToCheck) {
      const isEnabled = featureManager.isEnabled(flagName, context);
      request.featureFlags.set(flagName, isEnabled);
    }
  });

  // Feature flag check decorator
  fastify.decorate('isFeatureEnabled', (request: FastifyRequest, flagName: string): boolean => {
    return request.featureFlags.get(flagName) || false;
  });

  // Feature flag endpoint
  fastify.get('/api/v2/features', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.record(z.any()),
        }),
      },
    },
  }, async (request, reply) => {
    const context: FeatureFlagContext = {
      userId: request.user?.id,
      organizationId: request.user?.organizationId,
      environment: config.deployment.environment,
    };

    const flags: Record<string, any> = {};
    for (const [flagName] of request.featureFlags) {
      flags[flagName] = {
        enabled: featureManager.isEnabled(flagName, context),
        config: featureManager.getFlag(flagName),
      };
    }

    return {
      success: true,
      data: flags,
    };
  });

  // Individual feature flag endpoint
  fastify.get('/api/v2/features/:flagName', {
    schema: {
      params: z.object({
        flagName: z.string(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            name: z.string(),
            enabled: z.boolean(),
            config: z.any(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { flagName } = request.params;
    const context: FeatureFlagContext = {
      userId: request.user?.id,
      organizationId: request.user?.organizationId,
      environment: config.deployment.environment,
    };

    const flag = featureManager.getFlag(flagName);
    if (!flag) {
      throw new FeatureFlagError(`Feature flag '${flagName}' not found`);
    }

    return {
      success: true,
      data: {
        name: flagName,
        enabled: featureManager.isEnabled(flagName, context),
        config: flag,
      },
    };
  });

  logger.info('Feature flags plugin registered');
});
