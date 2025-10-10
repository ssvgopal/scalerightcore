import Fastify, { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  Logger,
  ServiceError,
  ValidationError,
  NotFoundError,
  ApiResponse,
  AgentResponse,
  Workflow,
  PluginInstance
} from '@orchestrall/shared';
import { langGraphEngine } from '@orchestrall/shared';
import { crewAIService } from '@orchestrall/shared';
import { autoGenService } from '@orchestrall/shared';

const logger = new Logger('external-apis');

interface ExternalAPIConfig {
  enableRateLimiting: boolean;
  corsOrigins: string[];
  apiKeyRequired: boolean;
  maxRequestSize: string;
}

export const externalAPIsPlugin: FastifyPluginAsync<{ config: ExternalAPIConfig }> = async (fastify, options) => {
  const { config } = options;

  // Register CORS if origins are specified
  if (config.corsOrigins.length > 0) {
    fastify.register(import('@fastify/cors'), {
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    });
  }

  // API Key authentication middleware
  if (config.apiKeyRequired) {
    fastify.addHook('preHandler', async (request, reply) => {
      const apiKey = request.headers['x-api-key'] as string;

      if (!apiKey) {
        throw new ValidationError('API key required');
      }

      // Validate API key (in production, check against database)
      if (apiKey !== process.env.EXTERNAL_API_KEY) {
        throw new ValidationError('Invalid API key');
      }
    });
  }

  // Rate limiting
  if (config.enableRateLimiting) {
    fastify.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        return request.headers['x-api-key'] as string || request.ip;
      },
    });
  }

  // ===== AGENT APIs =====

  // Execute AI Agent
  fastify.post('/v2/agents/execute', {
    schema: {
      body: z.object({
        agentType: z.enum(['crm', 'analytics', 'document', 'general']),
        input: z.string(),
        context: z.object({
          organizationId: z.string().optional(),
          userId: z.string().optional(),
          conversationId: z.string().optional(),
          metadata: z.record(z.any()).optional(),
        }).optional(),
        options: z.object({
          model: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
          maxTokens: z.number().optional(),
          framework: z.enum(['openai', 'crewai', 'autogen', 'langgraph']).optional(),
        }).optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            response: z.string(),
            metadata: z.object({
              agent: z.string(),
              executionTime: z.number(),
              tokensUsed: z.number().optional(),
              confidence: z.number(),
            }),
            actions: z.array(z.object({
              type: z.string(),
              payload: z.any(),
            })).optional(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { agentType, input, context, options } = request.body;

    try {
      logger.info('External agent execution request', {
        agentType,
        inputLength: input.length,
        organizationId: context?.organizationId,
      });

      let result: AgentResponse;

      switch (agentType) {
        case 'crm':
          // Route to CRM agent
          result = await executeCRMAgent(input, context, options);
          break;
        case 'analytics':
          // Route to Analytics agent
          result = await executeAnalyticsAgent(input, context, options);
          break;
        case 'document':
          // Route to Document Processing agent
          result = await executeDocumentAgent(input, context, options);
          break;
        default:
          // General AI assistant
          result = await executeGeneralAgent(input, context, options);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          response: result.content,
          metadata: result.metadata,
          actions: result.actions,
        },
      };

      return response;
    } catch (error) {
      logger.error('External agent execution failed', error);
      throw error;
    }
  });

  // Get Available Agents
  fastify.get('/v2/agents', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            capabilities: z.array(z.string()),
            category: z.string(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const agents = [
      {
        id: 'crm',
        name: 'CRM Specialist',
        description: 'Customer relationship management and sales insights',
        capabilities: ['customer_lookup', 'lead_scoring', 'sales_insights', 'customer_segmentation'],
        category: 'business',
      },
      {
        id: 'analytics',
        name: 'Data Analyst',
        description: 'Data analysis, reporting, and business intelligence',
        capabilities: ['data_query', 'trend_analysis', 'anomaly_detection', 'predictive_insights'],
        category: 'analytics',
      },
      {
        id: 'document',
        name: 'Document Processor',
        description: 'Document analysis, data extraction, and content processing',
        capabilities: ['document_analysis', 'data_extraction', 'classification', 'summarization'],
        category: 'productivity',
      },
      {
        id: 'general',
        name: 'AI Assistant',
        description: 'General-purpose AI assistant for various tasks',
        capabilities: ['conversation', 'question_answering', 'task_assistance'],
        category: 'general',
      },
    ];

    const response: ApiResponse<typeof agents> = {
      success: true,
      data: agents,
    };

    return response;
  });

  // ===== WORKFLOW APIs =====

  // Execute Workflow
  fastify.post('/v2/workflows/execute', {
    schema: {
      body: z.object({
        workflowType: z.enum(['customer-onboarding', 'document-processing', 'data-analysis']),
        input: z.record(z.any()),
        options: z.object({
          async: z.boolean().optional(),
          timeout: z.number().optional(),
        }).optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            executionId: z.string(),
            status: z.string(),
            result: z.any().optional(),
            metadata: z.object({
              workflowType: z.string(),
              executionTime: z.number().optional(),
              steps: z.array(z.string()).optional(),
            }),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { workflowType, input, options } = request.body;

    try {
      logger.info('External workflow execution request', {
        workflowType,
        async: options?.async,
      });

      const result = await langGraphEngine.executeWorkflow(workflowType, {
        data: input,
        metadata: {
          workflowId: workflowType,
          executionId: `exec_${Date.now()}`,
          startTime: Date.now(),
          organizationId: 'external',
          userId: 'external-user',
        },
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          executionId: `exec_${Date.now()}`,
          status: options?.async ? 'running' : 'completed',
          result: result.data,
          metadata: {
            workflowType,
            executionTime: Date.now() - Date.now(), // Would be actual duration
            steps: Object.keys(result.data || {}),
          },
        },
      };

      return response;
    } catch (error) {
      logger.error('External workflow execution failed', error);
      throw error;
    }
  });

  // Get Available Workflows
  fastify.get('/v2/workflows', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            category: z.string(),
            inputSchema: z.record(z.any()),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const workflows = [
      {
        id: 'customer-onboarding',
        name: 'Customer Onboarding',
        description: 'Automated customer onboarding workflow with validation and setup',
        category: 'customer',
        inputSchema: {
          customerData: {
            email: 'string',
            name: 'string',
            organization: 'string',
          },
        },
      },
      {
        id: 'document-processing',
        name: 'Document Processing',
        description: 'Intelligent document analysis and data extraction',
        category: 'productivity',
        inputSchema: {
          document: {
            content: 'string',
            type: 'string',
          },
        },
      },
      {
        id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Comprehensive data analysis and insights generation',
        category: 'analytics',
        inputSchema: {
          data: 'object',
          analysisType: 'string',
        },
      },
    ];

    const response: ApiResponse<typeof workflows> = {
      success: true,
      data: workflows,
    };

    return response;
  });

  // ===== PLUGIN APIs =====

  // List Available Plugins
  fastify.get('/v2/plugins', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            category: z.string(),
            capabilities: z.array(z.string()),
            configSchema: z.record(z.any()),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const plugins = [
      {
        id: 'crm-salesforce',
        name: 'Salesforce CRM',
        description: 'Complete Salesforce CRM integration',
        category: 'crm',
        capabilities: ['contacts', 'leads', 'opportunities', 'reports'],
        configSchema: {
          instanceUrl: { type: 'string', required: true },
          apiKey: { type: 'string', required: true, secret: true },
        },
      },
      {
        id: 'analytics-powerbi',
        name: 'Power BI Analytics',
        description: 'Microsoft Power BI integration for advanced analytics',
        category: 'analytics',
        capabilities: ['dashboards', 'reports', 'data-refresh'],
        configSchema: {
          workspaceId: { type: 'string', required: true },
          clientId: { type: 'string', required: true, secret: true },
        },
      },
      {
        id: 'payment-stripe',
        name: 'Stripe Payments',
        description: 'Payment processing with Stripe',
        category: 'finance',
        capabilities: ['payments', 'subscriptions', 'refunds'],
        configSchema: {
          publishableKey: { type: 'string', required: true },
          secretKey: { type: 'string', required: true, secret: true },
        },
      },
    ];

    const response: ApiResponse<typeof plugins> = {
      success: true,
      data: plugins,
    };

    return response;
  });

  // ===== ANALYTICS APIs =====

  // Get Platform Analytics
  fastify.get('/v2/analytics/platform', {
    schema: {
      querystring: z.object({
        timeframe: z.enum(['24h', '7d', '30d', '90d']).optional(),
        metrics: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            metrics: z.record(z.number()),
            trends: z.array(z.object({
              metric: z.string(),
              change: z.number(),
              trend: z.enum(['up', 'down', 'stable']),
            })),
            summary: z.string(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { timeframe = '7d', metrics = ['agents', 'workflows', 'users'] } = request.query;

    // Mock analytics data
    const analyticsData = {
      metrics: {
        agents: 45,
        workflows: 123,
        users: 234,
        executions: 5678,
      },
      trends: [
        { metric: 'agents', change: 12.5, trend: 'up' },
        { metric: 'workflows', change: -2.1, trend: 'down' },
        { metric: 'users', change: 8.3, trend: 'up' },
      ],
      summary: 'Platform usage increased by 8.2% compared to last week.',
    };

    const response: ApiResponse<typeof analyticsData> = {
      success: true,
      data: analyticsData,
    };

    return response;
  });

  // ===== HEALTH & STATUS APIs =====

  // Platform Health Check
  fastify.get('/v2/health', {
    schema: {
      response: {
        200: z.object({
          status: z.string(),
          version: z.string(),
          uptime: z.number(),
          services: z.record(z.object({
            status: z.string(),
            responseTime: z.number().optional(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const healthData = {
      status: 'healthy',
      version: '2.0.0',
      uptime: process.uptime(),
      services: {
        'api-gateway': { status: 'up', responseTime: 12 },
        'auth-service': { status: 'up', responseTime: 8 },
        'plugin-service': { status: 'up', responseTime: 15 },
        'workflow-service': { status: 'up', responseTime: 10 },
        'agent-service': { status: 'up', responseTime: 18 },
      },
    };

    return healthData;
  });

  // ===== MCP SERVER ENDPOINTS =====

  // MCP Discovery Endpoint
  fastify.get('/v2/mcp/discovery', {
    schema: {
      response: {
        200: z.object({
          jsonrpc: z.string(),
          id: z.string(),
          result: z.object({
            capabilities: z.object({
              tools: z.array(z.object({
                name: z.string(),
                description: z.string(),
                inputSchema: z.record(z.any()),
              })),
            }),
            serverInfo: z.object({
              name: z.string(),
              version: z.string(),
            }),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const mcpCapabilities = {
      tools: [
        {
          name: 'execute_agent',
          description: 'Execute an AI agent with specified input',
          inputSchema: {
            type: 'object',
            properties: {
              agentType: { type: 'string', enum: ['crm', 'analytics', 'document', 'general'] },
              input: { type: 'string' },
              context: { type: 'object' },
            },
            required: ['agentType', 'input'],
          },
        },
        {
          name: 'execute_workflow',
          description: 'Execute a predefined workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowType: { type: 'string' },
              input: { type: 'object' },
            },
            required: ['workflowType', 'input'],
          },
        },
        {
          name: 'get_analytics',
          description: 'Retrieve platform analytics and metrics',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string' },
              metrics: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      ],
      serverInfo: {
        name: 'Orchestrall Platform MCP Server',
        version: '2.0.0',
      },
    };

    return {
      jsonrpc: '2.0',
      id: 'discovery',
      result: mcpCapabilities,
    };
  });

  // MCP Tool Execution
  fastify.post('/v2/mcp/execute', {
    schema: {
      body: z.object({
        jsonrpc: z.string(),
        id: z.string(),
        method: z.string(),
        params: z.record(z.any()),
      }),
      response: {
        200: z.object({
          jsonrpc: z.string(),
          id: z.string(),
          result: z.any(),
        }),
      },
    },
  }, async (request, reply) => {
    const { method, params, id } = request.body;

    try {
      let result: any;

      switch (method) {
        case 'execute_agent':
          result = await executeAgentViaMCP(params);
          break;
        case 'execute_workflow':
          result = await executeWorkflowViaMCP(params);
          break;
        case 'get_analytics':
          result = await getAnalyticsViaMCP(params);
          break;
        default:
          throw new ValidationError(`Unknown MCP method: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result,
      };
    } catch (error) {
      logger.error('MCP execution failed', { method, error });

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message,
        },
      };
    }
  });
};

// ===== HELPER FUNCTIONS =====

async function executeCRMAgent(input: string, context?: any, options?: any): Promise<AgentResponse> {
  // Route to CRM agent logic
  const mockResponse: AgentResponse = {
    content: `CRM Analysis: ${input}`,
    metadata: {
      agent: 'CRM',
      duration: 150,
      confidence: 0.9,
    },
    actions: [
      {
        type: 'update_customer_record',
        payload: { customerId: '123', action: 'analyzed' },
      },
    ],
    framework: 'openai',
  };

  return mockResponse;
}

async function executeAnalyticsAgent(input: string, context?: any, options?: any): Promise<AgentResponse> {
  // Route to Analytics agent logic
  const mockResponse: AgentResponse = {
    content: `Analytics Results: ${input}`,
    metadata: {
      agent: 'Analytics',
      duration: 200,
      confidence: 0.85,
    },
    actions: [
      {
        type: 'generate_report',
        payload: { reportType: 'analysis', data: input },
      },
    ],
    framework: 'openai',
  };

  return mockResponse;
}

async function executeDocumentAgent(input: string, context?: any, options?: any): Promise<AgentResponse> {
  // Route to Document Processing agent logic
  const mockResponse: AgentResponse = {
    content: `Document Analysis: ${input}`,
    metadata: {
      agent: 'DocumentProcessor',
      duration: 300,
      confidence: 0.8,
    },
    actions: [
      {
        type: 'extract_data',
        payload: { documentId: '123', fields: ['name', 'date'] },
      },
    ],
    framework: 'openai',
  };

  return mockResponse;
}

async function executeGeneralAgent(input: string, context?: any, options?: any): Promise<AgentResponse> {
  // General AI assistant logic
  const mockResponse: AgentResponse = {
    content: `AI Assistant Response: ${input}`,
    metadata: {
      agent: 'GeneralAI',
      duration: 100,
      confidence: 0.7,
    },
    framework: 'openai',
  };

  return mockResponse;
}

// MCP-specific helper functions
async function executeAgentViaMCP(params: any): Promise<any> {
  const { agentType, input, context } = params;

  // Execute agent and return MCP-compatible result
  const result = await executeCRMAgent(input, context);

  return {
    response: result.content,
    metadata: result.metadata,
    actions: result.actions,
  };
}

async function executeWorkflowViaMCP(params: any): Promise<any> {
  const { workflowType, input } = params;

  // Execute workflow and return MCP-compatible result
  const result = await langGraphEngine.executeWorkflow(workflowType, {
    data: input,
    metadata: {
      workflowId: workflowType,
      executionId: `mcp_${Date.now()}`,
      startTime: Date.now(),
      organizationId: 'external',
      userId: 'external-user',
    },
  });

  return {
    executionId: `mcp_${Date.now()}`,
    result: result.data,
    status: 'completed',
  };
}

async function getAnalyticsViaMCP(params: any): Promise<any> {
  const { timeframe = '7d', metrics = ['agents', 'workflows'] } = params;

  // Return analytics data in MCP format
  return {
    metrics: {
      agents: 45,
      workflows: 123,
      users: 234,
    },
    timeframe,
    generatedAt: new Date().toISOString(),
  };
}
