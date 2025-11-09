import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  const requestId = request.id as string;
  const timestamp = new Date().toISOString();

  // Log the error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  });

  // Handle different error types
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors,
        timestamp,
        requestId,
      },
    };

    reply.status(400).send(errorResponse);
    return;
  }

  // Handle authentication errors
  if (error.message.includes('Unauthorized') || error.message.includes('authentication')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
        timestamp,
        requestId,
      },
    };

    reply.status(401).send(errorResponse);
    return;
  }

  // Handle authorization errors
  if (error.message.includes('Forbidden') || error.message.includes('authorization')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions',
        timestamp,
        requestId,
      },
    };

    reply.status(403).send(errorResponse);
    return;
  }

  // Handle rate limiting
  if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_ERROR',
        message: 'Too many requests, please try again later',
        timestamp,
        requestId,
      },
    };

    reply.status(429).send(errorResponse);
    return;
  }

  // Handle not found errors
  if (error.message.includes('not found') || error.statusCode === 404) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND_ERROR',
        message: 'Resource not found',
        timestamp,
        requestId,
      },
    };

    reply.status(404).send(errorResponse);
    return;
  }

  // Handle database errors
  if (error.message.includes('database') || error.message.includes('connection')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        timestamp,
        requestId,
      },
    };

    reply.status(500).send(errorResponse);
    return;
  }

  // Handle agent runtime errors
  if (error.message.includes('agent') || error.message.includes('Agent')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'AGENT_ERROR',
        message: 'Agent operation failed',
        details: error.message,
        timestamp,
        requestId,
      },
    };

    reply.status(500).send(errorResponse);
    return;
  }

  // Handle feature flag errors
  if (error.message.includes('feature flag') || error.message.includes('FeatureFlag')) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'FEATURE_FLAG_ERROR',
        message: 'Feature flag evaluation failed',
        timestamp,
        requestId,
      },
    };

    reply.status(500).send(errorResponse);
    return;
  }

  // Default error handling for unexpected errors
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp,
      requestId,
    },
  };

  reply.status(error.statusCode || 500).send(errorResponse);
};

// Custom error classes for better error handling
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class AgentError extends Error {
  constructor(message: string, public agentName?: string) {
    super(message);
    this.name = 'AgentError';
  }
}

export class FeatureFlagError extends Error {
  constructor(message: string, public flagName?: string) {
    super(message);
    this.name = 'FeatureFlagError';
  }
}
