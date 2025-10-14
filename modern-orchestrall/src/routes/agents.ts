// src/routes/agents.ts
import { FastifyInstance } from 'fastify';
import { AgentRegistry } from '../agents/agent-registry';

interface ExecuteAgentBody {
  input: any;
  context?: Record<string, any>;
}

export async function agentRoutes(fastify: FastifyInstance) {
  const agentRegistry = new AgentRegistry();

  // Get all available agents
  fastify.get('/agents', async (request, reply) => {
    try {
      const agents = agentRegistry.getAllAgents();
      reply.send({
        success: true,
        agents,
        count: agents.length
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve agents'
      });
    }
  });

  // Execute specific agent
  fastify.post('/agents/:agentName/execute', {
    schema: {
      params: {
        type: 'object',
        required: ['agentName'],
        properties: {
          agentName: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: ['string', 'number', 'object', 'array'] },
          context: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { agentName } = request.params as { agentName: string };
      const { input, context } = request.body as ExecuteAgentBody;

      // Get user ID from JWT token if available
      const authHeader = request.headers.authorization;
      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Basic token verification (simplified for MVP)
        try {
          const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          userId = decoded.userId;
        } catch (error) {
          // Invalid token, continue without user context
        }
      }

      const result = await agentRegistry.executeAgent(agentName, {
        input,
        context,
        userId
      });

      if (result.success) {
        reply.send({
          success: true,
          result: result.output,
          metadata: result.metadata
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error,
          metadata: result.metadata
        });
      }
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Agent execution failed'
      });
    }
  });
}
