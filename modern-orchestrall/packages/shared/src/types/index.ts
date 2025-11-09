// Shared types for all Orchestrall services
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  tier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
}

export interface User extends BaseEntity {
  email: string;
  name?: string;
  avatar?: string;
  organizationId: string;
  status: 'active' | 'inactive' | 'suspended';
  roles: string[];
  permissions: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: Record<string, {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
  }>;
}

// Error types
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

// Database utilities
export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  name: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  db: number;
}

// Event types for inter-service communication
export interface ServiceEvent<T = any> {
  id: string;
  type: string;
  source: string;
  data: T;
  timestamp: string;
  correlationId?: string;
  organizationId?: string;
  userId?: string;
}

export interface WorkflowEvent extends ServiceEvent {
  type: 'workflow.started' | 'workflow.completed' | 'workflow.failed';
  data: {
    workflowId: string;
    executionId: string;
    status: string;
    input?: any;
    output?: any;
    error?: string;
  };
}

export interface AgentEvent extends ServiceEvent {
  type: 'agent.invoked' | 'agent.completed' | 'agent.failed';
  data: {
    agentId: string;
    conversationId: string;
    input: string;
    output?: string;
    error?: string;
    duration?: number;
  };
}

// Plugin types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: string[];
  dependencies: string[];
  config: Record<string, any>;
  hooks: {
    onInstall?: string;
    onUninstall?: string;
    onEnable?: string;
    onDisable?: string;
  };
}

export interface PluginInstance {
  id: string;
  organizationId: string;
  pluginId: string;
  name: string;
  version: string;
  config: Record<string, any>;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  installedAt: Date;
  updatedAt: Date;
}
