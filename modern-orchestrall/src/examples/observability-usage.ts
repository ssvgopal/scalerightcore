/**
 * Observability Usage Examples
 *
 * Demonstrates how to use the enhanced logging and tracing capabilities
 * throughout the Orchestrall platform
 */

// Example 1: Basic service logging
import { createLogger } from '../utils/enhanced-logger';

const logger = createLogger('agent-service');

// Example 2: Tracing async operations
export class AgentService {
  private logger = createLogger('agent-service');

  async processAgent(input: string, context: any) {
    const timer = this.logger.startTimer('agent_processing');

    try {
      // Trace the entire operation
      const result = await this.logger.traceAsync(
        'process_agent_request',
        async () => {
          this.logger.info('Starting agent processing', {
            agentId: context.agentId,
            userId: context.userId,
            operation: 'agent_execution'
          });

          // Simulate some work
          const agentResult = await this.executeAgent(input, context);

          this.logger.info('Agent processing completed', {
            agentId: context.agentId,
            duration: timer(),
            success: true
          });

          return agentResult;
        },
        {
          agentId: context.agentId,
          userId: context.userId,
          component: 'agent-service',
          operation: 'process_agent'
        }
      );

      return result;
    } catch (error) {
      this.logger.error('Agent processing failed', {
        error,
        agentId: context.agentId,
        userId: context.userId,
        duration: timer(),
        metadata: { operation: 'agent_execution', failed: true }
      });
      throw error;
    }
  }

  private async executeAgent(input: string, context: any) {
    // Simulate agent execution with tracing
    return await this.logger.traceAsync(
      'execute_specific_agent',
      async () => {
        // Agent execution logic here
        return {
          response: `Processed: ${input}`,
          metadata: { agentType: 'crm', confidence: 0.9 }
        };
      },
      {
        agentId: context.agentId,
        operation: 'agent_execution_internal'
      }
    );
  }
}

// Example 3: Database operations with tracing
export class DatabaseService {
  private logger = createLogger('database-service');

  async queryCustomers(email: string) {
    const timer = this.logger.startTimer('database_query');

    try {
      return await this.logger.traceAsync(
        'query_customers',
        async () => {
          // Database query logic
          const customers = await this.performQuery(email);

          this.logger.info('Customer query completed', {
            email,
            resultCount: customers.length,
            duration: timer()
          });

          return customers;
        },
        {
          operation: 'customer_lookup',
          component: 'database-service'
        }
      );
    } catch (error) {
      this.logger.error('Customer query failed', {
        error,
        email,
        duration: timer(),
        metadata: { operation: 'customer_lookup', failed: true }
      });
      throw error;
    }
  }

  private async performQuery(email: string) {
    // Actual database query implementation
    // This would use Prisma or similar ORM
    return [];
  }
}

// Example 4: Workflow execution tracing
export class WorkflowService {
  private logger = createLogger('workflow-service');

  async executeWorkflow(workflowType: string, input: any) {
    const executionId = `exec_${Date.now()}`;

    return await this.logger.traceAsync(
      'execute_workflow',
      async () => {
        this.logger.info('Workflow execution started', {
          workflowType,
          executionId,
          input: JSON.stringify(input).substring(0, 100)
        });

        // Execute workflow steps
        const result = await this.executeWorkflowSteps(workflowType, input, executionId);

        this.logger.info('Workflow execution completed', {
          workflowType,
          executionId,
          success: true,
          result: JSON.stringify(result).substring(0, 100)
        });

        return result;
      },
      {
        workflowId: executionId,
        workflowType,
        operation: 'workflow_execution',
        component: 'workflow-service'
      }
    );
  }

  private async executeWorkflowSteps(workflowType: string, input: any, executionId: string) {
    // Workflow execution logic with step-by-step tracing
    const steps = ['validate_input', 'process_data', 'generate_output'];

    for (const step of steps) {
      await this.logger.traceAsync(
        `workflow_step_${step}`,
        async () => {
          this.logger.debug(`Executing workflow step: ${step}`, {
            workflowType,
            executionId,
            step
          });

          // Step execution logic
          await this.delay(100); // Simulate work

          this.logger.debug(`Workflow step completed: ${step}`, {
            workflowType,
            executionId,
            step,
            success: true
          });
        },
        {
          workflowId: executionId,
          workflowType,
          operation: step,
          component: 'workflow-service'
        }
      );
    }

    return { workflowType, executionId, status: 'completed' };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example 5: HTTP API endpoint tracing
import { FastifyRequest, FastifyReply } from 'fastify';

export class APIController {
  private logger = createLogger('api-controller');

  async handleAgentRequest(request: FastifyRequest, reply: FastifyReply) {
    const { agentType, input } = request.body as any;
    const requestId = `req_${Date.now()}`;

    return await this.logger.traceAsync(
      'handle_agent_api_request',
      async () => {
        this.logger.info('API request received', {
          requestId,
          agentType,
          userId: request.user?.id,
          organizationId: request.user?.organizationId,
          endpoint: '/v2/agents/execute'
        });

        // Validate request
        if (!agentType || !input) {
          this.logger.warn('Invalid API request', {
            requestId,
            error: 'Missing required fields',
            metadata: { validation: 'failed' }
          });

          reply.code(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
          });
          return;
        }

        try {
          // Execute agent
          const agentService = new AgentService();
          const result = await agentService.processAgent(input, {
            agentId: requestId,
            userId: request.user?.id,
            organizationId: request.user?.organizationId
          });

          this.logger.info('API request completed successfully', {
            requestId,
            agentType,
            duration: Date.now() - parseInt(requestId.split('_')[1]),
            success: true
          });

          reply.send({
            success: true,
            data: result
          });

        } catch (error) {
          this.logger.error('API request failed', {
            requestId,
            agentType,
            error,
            metadata: { operation: 'api_request', failed: true }
          });

          reply.code(500).send({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Request processing failed' }
          });
        }
      },
      {
        requestId,
        agentType,
        operation: 'api_request',
        component: 'api-controller',
        userId: request.user?.id,
        organizationId: request.user?.organizationId
      }
    );
  }
}

// Example 6: Custom metrics collection
export class MetricsService {
  private logger = createLogger('metrics-service');

  recordCustomMetric(name: string, value: number, labels: Record<string, string> = {}) {
    this.logger.recordMetric(name, value, {
      service: 'orchestrall-platform',
      ...labels
    });

    this.logger.debug('Custom metric recorded', {
      metricName: name,
      value,
      labels
    });
  }

  incrementCounter(name: string, labels: Record<string, string> = {}) {
    this.logger.incrementCounter(name, {
      service: 'orchestrall-platform',
      ...labels
    });

    this.logger.debug('Counter incremented', {
      counterName: name,
      labels
    });
  }
}

// Example 7: Error tracking and analysis
export class ErrorTracker {
  private logger = createLogger('error-tracker');

  trackError(error: Error, context: any) {
    this.logger.error('Error occurred', {
      error,
      context,
      metadata: {
        errorType: error.name,
        stackTrace: error.stack,
        timestamp: new Date().toISOString(),
        operation: context.operation || 'unknown'
      }
    });

    // Also record error metrics
    this.logger.incrementCounter('errors_total', {
      errorType: error.name,
      component: context.component || 'unknown',
      severity: this.classifyError(error)
    });
  }

  private classifyError(error: Error): string {
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('validation')) return 'validation';
    if (error.message.includes('authentication')) return 'auth';
    if (error.message.includes('authorization')) return 'permission';
    if (error.message.includes('database')) return 'database';
    if (error.message.includes('network')) return 'network';
    return 'unknown';
  }
}

// Example 8: Performance monitoring
export class PerformanceMonitor {
  private logger = createLogger('performance-monitor');

  async monitorOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = `op_${Date.now()}`;

    try {
      this.logger.info(`Starting performance monitoring for ${operationName}`, {
        operationId,
        operation: operationName
      });

      const result = await this.logger.traceAsync(
        operationName,
        operation,
        {
          operationId,
          operation: operationName,
          component: 'performance-monitor'
        }
      );

      const duration = Date.now() - startTime;

      this.logger.recordMetric('operation_duration_seconds', duration / 1000, {
        operation: operationName,
        status: 'success'
      });

      this.logger.info(`Operation completed successfully`, {
        operationId,
        operation: operationName,
        duration,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.recordMetric('operation_duration_seconds', duration / 1000, {
        operation: operationName,
        status: 'failed'
      });

      this.logger.error(`Operation failed`, {
        operationId,
        operation: operationName,
        duration,
        error,
        metadata: { operation: operationName, failed: true }
      });

      throw error;
    }
  }
}

/**
 * Usage Examples:
 *
 * // 1. Basic logging with context
 * logger.info('User logged in', {
 *   userId: 'user_123',
 *   organizationId: 'org_456',
 *   ipAddress: '192.168.1.1'
 * });
 *
 * // 2. Tracing async operations
 * const result = await logger.traceAsync(
 *   'process_payment',
 *   async () => {
 *     return await paymentService.process(paymentData);
 *   },
 *   { userId: 'user_123', operation: 'payment_processing' }
 * );
 *
 * // 3. Performance timing
 * const timer = logger.startTimer('database_query');
 * const data = await queryDatabase();
 * timer(); // Logs the duration
 *
 * // 4. Error tracking
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed', {
 *     error,
 *     userId: 'user_123',
 *     operation: 'risky_operation'
 *   });
 * }
 *
 * // 5. Custom metrics
 * logger.recordMetric('api_response_time', 0.5, {
 *   endpoint: '/api/users',
 *   method: 'GET'
 * });
 *
 * logger.incrementCounter('api_requests_total', {
 *   endpoint: '/api/users',
 *   status: '200'
 * });
 */
