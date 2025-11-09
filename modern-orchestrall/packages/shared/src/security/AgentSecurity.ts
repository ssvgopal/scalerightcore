import { Logger, ServiceError, AgentError } from '@orchestrall/shared';

interface PermissionRule {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  constraints?: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    allowedDomains?: string[];
    rateLimit?: number;
  };
}

interface SandboxConfig {
  timeout: number;
  memoryLimit: number;
  networkAccess: boolean;
  fileSystemAccess: boolean;
  allowedModules: string[];
  environment: Record<string, string>;
}

interface ExecutionContext {
  agentId: string;
  organizationId: string;
  userId: string;
  permissions: PermissionRule[];
  sandbox: SandboxConfig;
  metadata: Record<string, any>;
}

class AgentSandbox {
  private logger: Logger;
  private activeExecutions: Map<string, any> = new Map();

  constructor() {
    this.logger = new Logger('agent-sandbox');
  }

  async executeWithSandbox(
    code: string,
    context: ExecutionContext,
    inputs: any = {}
  ): Promise<any> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate permissions
      await this.validatePermissions(context, code);

      // Set up sandbox environment
      const sandbox = this.createSandbox(context.sandbox);

      // Execute with monitoring
      const result = await this.executeInSandbox(code, sandbox, inputs, context);

      // Log successful execution
      this.logger.info('Agent execution completed', {
        executionId,
        agentId: context.agentId,
        duration: Date.now() - Date.now(), // Would be actual duration
      });

      return result;
    } catch (error) {
      this.logger.error('Agent execution failed', {
        executionId,
        agentId: context.agentId,
        error: error.message,
      });

      throw new AgentError(`Sandboxed execution failed: ${error.message}`);
    } finally {
      // Cleanup
      this.activeExecutions.delete(executionId);
    }
  }

  private async validatePermissions(context: ExecutionContext, code: string): Promise<void> {
    // Check if the code requires permissions not granted to this agent
    const requiredPermissions = this.extractRequiredPermissions(code);

    for (const requiredPermission of requiredPermissions) {
      const hasPermission = context.permissions.some(
        p => p.resource === requiredPermission.resource && p.action === requiredPermission.action
      );

      if (!hasPermission) {
        throw new ServiceError(
          `Agent lacks permission: ${requiredPermission.action} on ${requiredPermission.resource}`
        );
      }
    }
  }

  private extractRequiredPermissions(code: string): PermissionRule[] {
    const permissions: PermissionRule[] = [];

    // Analyze code for permission requirements
    if (code.includes('fetch(') || code.includes('axios.') || code.includes('http.')) {
      permissions.push({ resource: 'network', action: 'http_request' });
    }

    if (code.includes('fs.') || code.includes('readFile') || code.includes('writeFile')) {
      permissions.push({ resource: 'filesystem', action: 'read_write' });
    }

    if (code.includes('process.env') || code.includes('environment')) {
      permissions.push({ resource: 'environment', action: 'read' });
    }

    if (code.includes('database') || code.includes('prisma') || code.includes('sql')) {
      permissions.push({ resource: 'database', action: 'query' });
    }

    return permissions;
  }

  private createSandbox(config: SandboxConfig): any {
    // Create a restricted execution environment
    return {
      timeout: config.timeout,
      memoryLimit: config.memoryLimit,
      allowedGlobals: this.getAllowedGlobals(config.allowedModules),
      environment: config.environment,
      networkAccess: config.networkAccess,
      fileSystemAccess: config.fileSystemAccess,
    };
  }

  private getAllowedGlobals(allowedModules: string[]): any {
    const safeGlobals: any = {};

    // Only allow safe, pre-approved modules
    allowedModules.forEach(module => {
      if (this.isSafeModule(module)) {
        try {
          safeGlobals[module] = require(module);
        } catch (error) {
          this.logger.warn(`Failed to load module: ${module}`, error);
        }
      }
    });

    return safeGlobals;
  }

  private isSafeModule(moduleName: string): boolean {
    const safeModules = [
      'lodash',
      'moment',
      'uuid',
      'validator',
      'crypto-js',
      // Add other safe modules as needed
    ];

    return safeModules.includes(moduleName) || moduleName.startsWith('@safe/');
  }

  private async executeInSandbox(
    code: string,
    sandbox: any,
    inputs: any,
    context: ExecutionContext
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ServiceError('Execution timeout exceeded'));
      }, sandbox.timeout);

      try {
        // Create isolated execution context
        const executionContext = {
          ...sandbox.allowedGlobals,
          inputs,
          console: {
            log: (...args: any[]) => this.logger.info('Sandbox console.log', args),
            error: (...args: any[]) => this.logger.error('Sandbox console.error', args),
            warn: (...args: any[]) => this.logger.warn('Sandbox console.warn', args),
          },
          setTimeout: (fn: Function, delay: number) => {
            if (delay > 5000) {
              throw new ServiceError('setTimeout delay too long');
            }
            return global.setTimeout(fn, delay);
          },
          setInterval: () => {
            throw new ServiceError('setInterval not allowed in sandbox');
          },
        };

        // Wrap code in safety function
        const wrappedCode = `
          (function() {
            "use strict";
            ${code}
          })()
        `;

        // Execute with restrictions (simplified - real implementation would use VM2 or similar)
        const result = eval(wrappedCode);

        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

class PermissionManager {
  private logger: Logger;
  private permissionCache: Map<string, PermissionRule[]> = new Map();

  constructor() {
    this.logger = new Logger('permission-manager');
  }

  async getAgentPermissions(agentId: string, organizationId: string): Promise<PermissionRule[]> {
    const cacheKey = `${agentId}:${organizationId}`;

    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    // In production, this would query the database
    // For now, return default permissions
    const permissions: PermissionRule[] = [
      {
        resource: 'network',
        action: 'http_request',
        constraints: {
          allowedDomains: ['api.github.com', 'api.openai.com'],
          rateLimit: 100,
        },
      },
      {
        resource: 'data',
        action: 'read',
        constraints: {
          maxExecutionTime: 30000,
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        },
      },
      {
        resource: 'logging',
        action: 'write',
      },
    ];

    this.permissionCache.set(cacheKey, permissions);
    return permissions;
  }

  async validateAgentAction(
    agentId: string,
    action: string,
    resource: string,
    context: any
  ): Promise<boolean> {
    try {
      // This would validate against the agent's permission rules
      // For now, return true (allow all)
      return true;
    } catch (error) {
      this.logger.error('Permission validation failed', { agentId, action, resource, error });
      return false;
    }
  }

  async grantPermission(
    agentId: string,
    organizationId: string,
    permission: PermissionRule
  ): Promise<void> {
    // In production, this would update the database
    this.logger.info('Permission granted', { agentId, organizationId, permission });

    // Clear cache to force refresh
    const cacheKey = `${agentId}:${organizationId}`;
    this.permissionCache.delete(cacheKey);
  }

  async revokePermission(
    agentId: string,
    organizationId: string,
    resource: string,
    action: string
  ): Promise<void> {
    // In production, this would update the database
    this.logger.info('Permission revoked', { agentId, organizationId, resource, action });

    // Clear cache to force refresh
    const cacheKey = `${agentId}:${organizationId}`;
    this.permissionCache.delete(cacheKey);
  }
}

export class AgentSecurityManager {
  private sandbox: AgentSandbox;
  private permissionManager: PermissionManager;
  private logger: Logger;

  constructor() {
    this.sandbox = new AgentSandbox();
    this.permissionManager = new PermissionManager();
    this.logger = new Logger('agent-security');
  }

  async executeSecurely(
    agentId: string,
    code: string,
    organizationId: string,
    userId: string,
    inputs: any = {}
  ): Promise<any> {
    // Get agent permissions
    const permissions = await this.permissionManager.getAgentPermissions(agentId, organizationId);

    // Create execution context
    const context: ExecutionContext = {
      agentId,
      organizationId,
      userId,
      permissions,
      sandbox: {
        timeout: 30000, // 30 seconds
        memoryLimit: 100 * 1024 * 1024, // 100MB
        networkAccess: true,
        fileSystemAccess: false,
        allowedModules: ['lodash', 'moment', 'uuid'],
        environment: {},
      },
      metadata: {
        startTime: Date.now(),
        executionEnvironment: 'sandbox',
      },
    };

    // Execute in sandbox
    return this.sandbox.executeWithSandbox(code, context, inputs);
  }

  async validateAgentPermissions(
    agentId: string,
    organizationId: string,
    action: string,
    resource: string,
    context: any
  ): Promise<boolean> {
    return this.permissionManager.validateAgentAction(agentId, action, resource, context);
  }

  async auditAgentExecution(
    agentId: string,
    executionId: string,
    result: any,
    error?: Error
  ): Promise<void> {
    // Log agent execution for audit purposes
    this.logger.info('Agent execution audit', {
      agentId,
      executionId,
      success: !error,
      error: error?.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export { AgentSandbox, PermissionManager, ExecutionContext };
