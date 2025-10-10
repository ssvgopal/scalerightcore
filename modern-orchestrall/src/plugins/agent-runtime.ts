import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../core/config';
import { logger } from '../utils/logger';
import { AgentError } from '../middleware/error-handler';

declare module 'fastify' {
  interface FastifyInstance {
    agentRuntime: AgentRuntimeManager;
  }
}

interface AgentContext {
  conversationId: string;
  userId: string;
  organizationId: string;
  metadata: Record<string, any>;
}

interface AgentResponse {
  content: string;
  actions?: AgentAction[];
  metadata: Record<string, any>;
  framework: string;
}

interface AgentAction {
  type: string;
  payload: any;
  confidence: number;
}

abstract class BaseAgent {
  protected name: string;
  protected capabilities: string[];
  protected framework: string;

  constructor(name: string, capabilities: string[], framework: string) {
    this.name = name;
    this.capabilities = capabilities;
    this.framework = framework;
  }

  abstract async process(input: string, context: AgentContext): Promise<AgentResponse>;

  hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  getName(): string {
    return this.name;
  }

  getFramework(): string {
    return this.framework;
  }
}

class AgentRuntimeManager {
  private agents: Map<string, BaseAgent> = new Map();
  private frameworks: Map<string, any> = new Map();

  constructor() {
    this.initializeFrameworks();
  }

  private initializeFrameworks(): void {
    // Initialize different agent frameworks
    this.frameworks.set('openai', this.initializeOpenAI.bind(this));
    this.frameworks.set('langgraph', this.initializeLangGraph.bind(this));
    this.frameworks.set('crewai', this.initializeCrewAI.bind(this));
    this.frameworks.set('autogen', this.initializeAutoGen.bind(this));
  }

  private async initializeOpenAI(): Promise<void> {
    // Initialize OpenAI client
    logger.info('Initializing OpenAI framework');
  }

  private async initializeLangGraph(): Promise<void> {
    // Initialize LangGraph
    logger.info('Initializing LangGraph framework');
  }

  private async initializeCrewAI(): Promise<void> {
    // Initialize CrewAI
    logger.info('Initializing CrewAI framework');
  }

  private async initializeAutoGen(): Promise<void> {
    // Initialize AutoGen
    logger.info('Initializing AutoGen framework');
  }

  async registerAgent(agent: BaseAgent): Promise<void> {
    this.agents.set(agent.getName(), agent);
    logger.info(`Registered agent: ${agent.getName()} (${agent.getFramework()})`);
  }

  async execute(input: string, context: AgentContext, targetAgent?: string): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    if (targetAgent) {
      const agent = this.agents.get(targetAgent);
      if (agent) {
        try {
          const response = await agent.process(input, context);
          responses.push(response);
        } catch (error) {
          logger.error(`Agent execution error for '${targetAgent}':`, error);
          throw new AgentError(`Agent '${targetAgent}' execution failed`, targetAgent);
        }
      } else {
        throw new AgentError(`Agent '${targetAgent}' not found`);
      }
    } else {
      // Execute all capable agents
      for (const [name, agent] of this.agents) {
        if (agent.hasCapability('conversation')) {
          try {
            const response = await agent.process(input, context);
            responses.push(response);
          } catch (error) {
            logger.error(`Agent execution error for '${name}':`, error);
            // Continue with other agents even if one fails
          }
        }
      }
    }

    return responses;
  }

  getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgentCapabilities(agentName: string): string[] {
    const agent = this.agents.get(agentName);
    return agent ? agent.capabilities : [];
  }

  getAvailableFrameworks(): string[] {
    return Array.from(this.frameworks.keys());
  }
}

export const agentRuntimePlugin = fp(async (fastify: FastifyInstance) => {
  const agentRuntime = new AgentRuntimeManager();

  // Initialize the configured runtime framework
  if (config.agents.runtime !== 'custom') {
    const initializer = agentRuntime['frameworks'].get(config.agents.runtime);
    if (initializer) {
      await initializer();
    }
  }

  // Add to fastify instance
  fastify.decorate('agentRuntime', agentRuntime);

  // Agent execution endpoint
  fastify.post('/api/v2/agents/execute', {
    schema: {
      body: z.object({
        input: z.string(),
        agent: z.string().optional(),
        context: z.object({
          conversationId: z.string(),
          metadata: z.record(z.any()).optional(),
        }),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.array(z.object({
            agent: z.string(),
            content: z.string(),
            actions: z.array(z.object({
              type: z.string(),
              payload: z.any(),
              confidence: z.number(),
            })).optional(),
            metadata: z.record(z.any()),
            framework: z.string(),
          })),
        }),
      },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { input, agent, context } = request.body;

    const agentContext: AgentContext = {
      conversationId: context.conversationId,
      userId: request.user!.id,
      organizationId: request.user!.organizationId,
      metadata: context.metadata || {},
    };

    const responses = await agentRuntime.execute(input, agentContext, agent);

    return {
      success: true,
      data: responses.map(response => ({
        agent: 'system', // Would be actual agent name
        content: response.content,
        actions: response.actions,
        metadata: response.metadata,
        framework: response.framework,
      })),
    };
  });

  // Get available agents endpoint
  fastify.get('/api/v2/agents', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.object({
            agents: z.array(z.string()),
            frameworks: z.array(z.string()),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    return {
      success: true,
      data: {
        agents: agentRuntime.getAvailableAgents(),
        frameworks: agentRuntime.getAvailableFrameworks(),
      },
    };
  });

  logger.info('Agent runtime plugin registered');
});
