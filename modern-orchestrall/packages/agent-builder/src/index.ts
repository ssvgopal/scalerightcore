import Fastify from 'fastify';
import { z } from 'zod';
import {
  Logger,
  ServiceError,
  ValidationError,
  NotFoundError,
  ApiResponse
} from '@orchestrall/shared';

const logger = new Logger('agent-builder');

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
    },
  },
});

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  configSchema: Record<string, any>;
  defaultConfig: Record<string, any>;
  icon: string;
  tags: string[];
}

interface CustomAgent {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  createdBy: string;
  templateId: string;
  configuration: Record<string, any>;
  capabilities: string[];
  status: 'draft' | 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// Predefined agent templates
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'customer-support',
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries and support tickets',
    category: 'customer_service',
    capabilities: ['conversation', 'ticket_management', 'knowledge_base'],
    configSchema: {
      type: 'object',
      properties: {
        knowledgeBase: { type: 'string', description: 'Knowledge base to use' },
        responseStyle: { type: 'string', enum: ['formal', 'friendly', 'technical'] },
        escalationRules: { type: 'array', items: { type: 'string' } },
        maxResponseTime: { type: 'number', default: 30 },
      },
      required: ['knowledgeBase', 'responseStyle'],
    },
    defaultConfig: {
      responseStyle: 'friendly',
      maxResponseTime: 30,
      escalationRules: [],
    },
    icon: 'support',
    tags: ['customer-service', 'helpdesk', 'support'],
  },
  {
    id: 'data-analyst',
    name: 'Data Analysis Agent',
    description: 'Analyzes data and generates insights',
    category: 'analytics',
    capabilities: ['data_query', 'visualization', 'reporting'],
    configSchema: {
      type: 'object',
      properties: {
        dataSources: { type: 'array', items: { type: 'string' } },
        reportFormat: { type: 'string', enum: ['summary', 'detailed', 'visual'] },
        autoRefresh: { type: 'boolean', default: false },
        notificationChannels: { type: 'array', items: { type: 'string' } },
      },
      required: ['dataSources'],
    },
    defaultConfig: {
      reportFormat: 'summary',
      autoRefresh: false,
      notificationChannels: ['email'],
    },
    icon: 'analytics',
    tags: ['data', 'analytics', 'reporting'],
  },
  {
    id: 'document-processor',
    name: 'Document Processing Agent',
    description: 'Processes and analyzes documents',
    category: 'document_processing',
    capabilities: ['document_analysis', 'data_extraction', 'classification'],
    configSchema: {
      type: 'object',
      properties: {
        supportedTypes: { type: 'array', items: { type: 'string' } },
        extractFields: { type: 'array', items: { type: 'string' } },
        ocrEnabled: { type: 'boolean', default: false },
        confidenceThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.8 },
      },
      required: ['supportedTypes'],
    },
    defaultConfig: {
      supportedTypes: ['pdf', 'docx', 'txt'],
      extractFields: ['name', 'date', 'amount'],
      ocrEnabled: false,
      confidenceThreshold: 0.8,
    },
    icon: 'document',
    tags: ['documents', 'processing', 'extraction'],
  },
  {
    id: 'crm-specialist',
    name: 'CRM Specialist Agent',
    description: 'Manages customer relationships and sales data',
    category: 'crm',
    capabilities: ['customer_lookup', 'lead_scoring', 'sales_insights'],
    configSchema: {
      type: 'object',
      properties: {
        crmProvider: { type: 'string', enum: ['salesforce', 'hubspot', 'zoho'] },
        autoSync: { type: 'boolean', default: true },
        leadScoringModel: { type: 'string', enum: ['basic', 'advanced', 'custom'] },
        notificationTriggers: { type: 'array', items: { type: 'string' } },
      },
      required: ['crmProvider'],
    },
    defaultConfig: {
      crmProvider: 'salesforce',
      autoSync: true,
      leadScoringModel: 'basic',
      notificationTriggers: ['new_lead', 'deal_closed'],
    },
    icon: 'crm',
    tags: ['crm', 'sales', 'customers'],
  },
  {
    id: 'workflow-coordinator',
    name: 'Workflow Coordinator Agent',
    description: 'Coordinates and manages business workflows',
    category: 'workflow',
    capabilities: ['workflow_execution', 'task_management', 'coordination'],
    configSchema: {
      type: 'object',
      properties: {
        workflowTypes: { type: 'array', items: { type: 'string' } },
        escalationRules: { type: 'array', items: { type: 'string' } },
        notificationSettings: { type: 'object' },
        retryPolicy: { type: 'object' },
      },
      required: ['workflowTypes'],
    },
    defaultConfig: {
      workflowTypes: ['approval', 'onboarding', 'review'],
      escalationRules: [],
      notificationSettings: { email: true, slack: false },
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2 },
    },
    icon: 'workflow',
    tags: ['workflow', 'automation', 'coordination'],
  },
];

// Initialize Prisma for database storage
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Routes
fastify.get('/templates', {
  schema: {
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.array(z.any()),
      }),
    },
  },
}, async (request, reply) => {
  const response: ApiResponse<AgentTemplate[]> = {
    success: true,
    data: AGENT_TEMPLATES,
  };

  return response;
});

fastify.get('/templates/:templateId', {
  schema: {
    params: z.object({
      templateId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
}, async (request, reply) => {
  const { templateId } = request.params;

  const template = AGENT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new NotFoundError(`Template '${templateId}' not found`);
  }

  const response: ApiResponse<AgentTemplate> = {
    success: true,
    data: template,
  };

  return response;
});

fastify.post('/agents', {
  schema: {
    body: z.object({
      name: z.string(),
      description: z.string(),
      templateId: z.string(),
      configuration: z.record(z.any()),
    }),
    response: {
      201: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { name, description, templateId, configuration } = request.body;

  // Find template
  const template = AGENT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    throw new ValidationError(`Template '${templateId}' not found`);
  }

  // Validate configuration against schema
  await validateConfiguration(configuration, template.configSchema);

  // Create custom agent in database
  const agent = await prisma.agent.create({
    data: {
      name,
      description,
      organizationId: request.user.organizationId,
      createdById: request.user.id,
      type: templateId,
      config: configuration,
      capabilities: template.capabilities,
      status: 'draft',
    },
  });

  const response: ApiResponse<CustomAgent> = {
    success: true,
    data: agent,
  };

  logger.info('Custom agent created', {
    agentId: agent.id,
    name: agent.name,
    templateId,
    organizationId: request.user.organizationId,
  });

  return reply.code(201).send(response);
});

fastify.get('/agents', {
  schema: {
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.array(z.any()),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  // Query agents from database
  const agents = await prisma.agent.findMany({
    where: {
      organizationId: request.user.organizationId,
    },
    include: {
      createdBy: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const response: ApiResponse<typeof agents> = {
    success: true,
    data: agents,
  };

  return response;
});

fastify.get('/agents/:agentId', {
  schema: {
    params: z.object({
      agentId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { agentId } = request.params;

  // Query agent from database
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      organizationId: request.user.organizationId,
    },
    include: {
      createdBy: true,
    },
  });
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  const response: ApiResponse<typeof agent> = {
    success: true,
    data: agent,
  };

  return response;
});

fastify.put('/agents/:agentId', {
  schema: {
    params: z.object({
      agentId: z.string(),
    }),
    body: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      configuration: z.record(z.any()).optional(),
      status: z.enum(['draft', 'active', 'inactive']).optional(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.any(),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { agentId } = request.params;
  const updates = request.body;

  // Check agent exists and user has access
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      organizationId: request.user.organizationId,
    },
  });
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Validate configuration if provided
  if (updates.configuration) {
    const template = AGENT_TEMPLATES.find(t => t.id === agent.type);
    if (template) {
      await validateConfiguration(updates.configuration, template.configSchema);
    }
  }

  // Update agent in database
  const updatedAgent = await prisma.agent.update({
    where: { id: agentId },
    data: {
      name: updates.name,
      description: updates.description,
      config: updates.configuration,
      status: updates.status,
      updatedAt: new Date(),
    },
  });

  const response: ApiResponse<CustomAgent> = {
    success: true,
    data: updatedAgent,
  };

  logger.info('Custom agent updated', { agentId, updates });
  return response;
});

fastify.delete('/agents/:agentId', {
  schema: {
    params: z.object({
      agentId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { agentId } = request.params;

  // Check agent exists and user has access
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      organizationId: request.user.organizationId,
    },
  });
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Delete agent from database
  await prisma.agent.delete({
    where: { id: agentId },
  });

  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: 'Agent deleted successfully' },
  };

  logger.info('Custom agent deleted', { agentId });
  return response;
});

// Agent deployment
fastify.post('/agents/:agentId/deploy', {
  schema: {
    params: z.object({
      agentId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.object({
          deploymentId: z.string(),
          status: z.string(),
          deployedAt: z.string(),
        }),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { agentId } = request.params;

  // Check agent exists and user has access
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      organizationId: request.user.organizationId,
    },
  });
  
  if (!agent) {
    throw new NotFoundError('Agent');
  }

  // Update agent status to deployed
  await prisma.agent.update({
    where: { id: agentId },
    data: { status: 'active' },
  });
  
  const deploymentId = `deploy_${Date.now()}`;

  const response: ApiResponse<any> = {
    success: true,
    data: {
      deploymentId,
      status: 'deployed',
      deployedAt: new Date().toISOString(),
    },
  };

  logger.info('Custom agent deployed', { agentId, deploymentId });
  return response;
});

// Health check
fastify.get('/health', async (request, reply) => {
  const agentsCount = await prisma.agent.count();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    agentsCount,
  };
});

// Configuration validation function
async function validateConfiguration(config: Record<string, any>, schema: any): Promise<void> {
  // Simple validation - in production would use a proper JSON schema validator
  for (const [key, fieldSchema] of Object.entries(schema.properties || {})) {
    if (fieldSchema.required && !config[key]) {
      throw new ValidationError(`Missing required field: ${key}`);
    }

    if (config[key] && fieldSchema.type && typeof config[key] !== fieldSchema.type) {
      throw new ValidationError(`Invalid type for field ${key}: expected ${fieldSchema.type}`);
    }

    if (config[key] && fieldSchema.enum && !fieldSchema.enum.includes(config[key])) {
      throw new ValidationError(`Invalid value for field ${key}: must be one of ${fieldSchema.enum.join(', ')}`);
    }
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT || '3006'),
      host: process.env.HOST || '0.0.0.0',
    });

    logger.info(`Agent builder service listening on port ${process.env.PORT || 3006}`);
  } catch (err) {
    logger.error('Failed to start agent builder service', err);
    process.exit(1);
  }
};

start();
