import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { z } from 'zod';
import {
  Logger,
  ServiceError,
  ValidationError,
  NotFoundError,
  ApiResponse,
  ServiceHealth,
  Workflow,
  WorkflowExecution
} from '@orchestrall/shared';
import { langGraphEngine } from '@orchestrall/shared';

// Types
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  definition: any; // LangGraph workflow definition
  teamId?: string;
}

interface ExecuteWorkflowRequest {
  input: any;
  async?: boolean;
}

// Workflow engine class
class WorkflowEngine {
  async createWorkflow(organizationId: string, request: CreateWorkflowRequest, userId: string): Promise<Workflow> {
    const workflow = await prisma.workflow.create({
      data: {
        name: request.name,
        description: request.description,
        definition: request.definition,
        organizationId,
        teamId: request.teamId,
        createdById: userId,
        status: 'draft',
      },
    });

    logger.info('Workflow created', {
      workflowId: workflow.id,
      name: workflow.name,
      organizationId,
    });

    return workflow;
  }

  async executeWorkflow(workflowId: string, request: ExecuteWorkflowRequest, userId: string): Promise<WorkflowExecution> {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    if (workflow.status !== 'active') {
      throw new ValidationError('Workflow is not active');
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        input: request.input,
        status: request.async ? 'running' : 'completed',
        triggeredBy: userId,
      },
    });

    try {
      if (request.async) {
        // Execute asynchronously
        this.executeAsync(workflow, execution, request.input);
        return execution;
      } else {
        // Execute synchronously
        const result = await langGraph.executeWorkflow(workflow.definition, request.input);

        // Update execution with results
        const completedExecution = await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            output: result.output,
            status: 'completed',
            completedAt: new Date(),
          },
        });

        logger.info('Workflow executed synchronously', {
          executionId: execution.id,
          workflowId,
          duration: result.executionTime,
        });

        return completedExecution;
      }
    } catch (error) {
      logger.error('Workflow execution failed', { executionId: execution.id, error });

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw new ServiceError('Workflow execution failed');
    }
  }

  private async executeAsync(workflow: Workflow, execution: WorkflowExecution, input: any): Promise<void> {
    // Execute workflow asynchronously
    setImmediate(async () => {
      try {
        const result = await langGraph.executeWorkflow(workflow.definition, input);

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            output: result.output,
            status: 'completed',
            completedAt: new Date(),
          },
        });

        logger.info('Workflow executed asynchronously', {
          executionId: execution.id,
          workflowId: workflow.id,
          duration: result.executionTime,
        });
      } catch (error) {
        logger.error('Async workflow execution failed', { executionId: execution.id, error });

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });
      }
    });
  }

  async getWorkflowExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    return prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new NotFoundError('Workflow execution');
    }

    return execution;
  }
}

const workflowEngine = new WorkflowEngine();

// Routes
fastify.post('/workflows', {
  schema: {
    body: z.object({
      name: z.string(),
      description: z.string().optional(),
      definition: z.any(),
      teamId: z.string().optional(),
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
  const workflowRequest = request.body as CreateWorkflowRequest;

  const workflow = await workflowEngine.createWorkflow(
    request.user.organizationId,
    workflowRequest,
    request.user.id
  );

  const response: ApiResponse<Workflow> = {
    success: true,
    data: workflow,
  };

  return reply.code(201).send(response);
});

fastify.get('/workflows', {
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
  const workflows = await prisma.workflow.findMany({
    where: { organizationId: request.user.organizationId },
    include: {
      createdBy: true,
      team: true,
      _count: {
        select: { executions: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const response: ApiResponse<typeof workflows> = {
    success: true,
    data: workflows,
  };

  return response;
});

fastify.get('/workflows/:workflowId', {
  schema: {
    params: z.object({
      workflowId: z.string(),
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
  const { workflowId } = request.params;

  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowId,
      organizationId: request.user.organizationId,
    },
    include: {
      createdBy: true,
      team: true,
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!workflow) {
    throw new NotFoundError('Workflow');
  }

  const response: ApiResponse<typeof workflow> = {
    success: true,
    data: workflow,
  };

  return response;
});

fastify.post('/workflows/:workflowId/execute', {
  schema: {
    params: z.object({
      workflowId: z.string(),
    }),
    body: z.object({
      input: z.any(),
      async: z.boolean().optional(),
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
  const { workflowId } = request.params;
  const executeRequest = request.body as ExecuteWorkflowRequest;

  const execution = await workflowEngine.executeWorkflow(
    workflowId,
    executeRequest,
    request.user.id
  );

  const response: ApiResponse<WorkflowExecution> = {
    success: true,
    data: execution,
  };

  return response;
});

fastify.get('/workflows/:workflowId/executions', {
  schema: {
    params: z.object({
      workflowId: z.string(),
    }),
    response: {
      200: z.object({
        success: z.boolean(),
        data: z.array(z.any()),
      }),
    },
  },
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { workflowId } = request.params;

  const executions = await workflowEngine.getWorkflowExecutions(workflowId);

  const response: ApiResponse<typeof executions> = {
    success: true,
    data: executions,
  };

  return response;
});

fastify.get('/executions/:executionId', {
  schema: {
    params: z.object({
      executionId: z.string(),
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
  const { executionId } = request.params;

  const execution = await workflowEngine.getExecutionStatus(executionId);

  const response: ApiResponse<WorkflowExecution> = {
    success: true,
    data: execution,
  };

  return response;
});

// Health check
fastify.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    await redis.ping();

    const health: ServiceHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        database: { status: 'up' },
        redis: { status: 'up' },
        langgraph: { status: 'up' },
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
        redis: { status: 'down' },
        langgraph: { status: 'down' },
      },
    };

    return reply.code(503).send(health);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  await redis.quit();
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
      port: parseInt(process.env.PORT || '3005'),
      host: process.env.HOST || '0.0.0.0',
    });

    logger.info(`Workflow service listening on port ${process.env.PORT || 3005}`);
  } catch (err) {
    logger.error('Failed to start workflow service', err);
    process.exit(1);
  }
};

start();
