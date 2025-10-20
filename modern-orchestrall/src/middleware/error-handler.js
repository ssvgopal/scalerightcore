class ErrorHandler {
  constructor() {
    this.errorTypes = {
      // Authentication errors
      AUTHENTICATION_FAILED: {
        statusCode: 401,
        message: 'Authentication failed',
        code: 'AUTHENTICATION_FAILED'
      },
      TOKEN_EXPIRED: {
        statusCode: 401,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      },
      INVALID_TOKEN: {
        statusCode: 401,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      },
      MISSING_TOKEN: {
        statusCode: 401,
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      },
      INVALID_CREDENTIALS: {
        statusCode: 401,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      },

      // Authorization errors
      INSUFFICIENT_PERMISSIONS: {
        statusCode: 403,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      },
      ACCESS_DENIED: {
        statusCode: 403,
        message: 'Access denied',
        code: 'ACCESS_DENIED'
      },
      ORG_ACCESS_DENIED: {
        statusCode: 403,
        message: 'Access denied to organization',
        code: 'ORG_ACCESS_DENIED'
      },

      // Validation errors
      VALIDATION_ERROR: {
        statusCode: 400,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      },
      INVALID_INPUT: {
        statusCode: 400,
        message: 'Invalid input data',
        code: 'INVALID_INPUT'
      },
      MISSING_REQUIRED_FIELD: {
        statusCode: 400,
        message: 'Required field is missing',
        code: 'MISSING_REQUIRED_FIELD'
      },

      // Resource errors
      RESOURCE_NOT_FOUND: {
        statusCode: 404,
        message: 'Resource not found',
        code: 'RESOURCE_NOT_FOUND'
      },
      USER_NOT_FOUND: {
        statusCode: 404,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      },
      ORGANIZATION_NOT_FOUND: {
        statusCode: 404,
        message: 'Organization not found',
        code: 'ORGANIZATION_NOT_FOUND'
      },
      FARMER_NOT_FOUND: {
        statusCode: 404,
        message: 'Farmer not found',
        code: 'FARMER_NOT_FOUND'
      },
      CROP_NOT_FOUND: {
        statusCode: 404,
        message: 'Crop not found',
        code: 'CROP_NOT_FOUND'
      },

      // Conflict errors
      RESOURCE_ALREADY_EXISTS: {
        statusCode: 409,
        message: 'Resource already exists',
        code: 'RESOURCE_ALREADY_EXISTS'
      },
      EMAIL_ALREADY_EXISTS: {
        statusCode: 409,
        message: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS'
      },
      DUPLICATE_RESOURCE: {
        statusCode: 409,
        message: 'Duplicate resource',
        code: 'DUPLICATE_RESOURCE'
      },

      // Rate limiting errors
      RATE_LIMIT_EXCEEDED: {
        statusCode: 429,
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      TOO_MANY_REQUESTS: {
        statusCode: 429,
        message: 'Too many requests',
        code: 'TOO_MANY_REQUESTS'
      },

      // External API errors
      EXTERNAL_API_ERROR: {
        statusCode: 502,
        message: 'External API error',
        code: 'EXTERNAL_API_ERROR'
      },
      API_TIMEOUT: {
        statusCode: 504,
        message: 'API timeout',
        code: 'API_TIMEOUT'
      },
      SERVICE_UNAVAILABLE: {
        statusCode: 503,
        message: 'Service unavailable',
        code: 'SERVICE_UNAVAILABLE'
      },

      // Database errors
      DATABASE_ERROR: {
        statusCode: 500,
        message: 'Database error',
        code: 'DATABASE_ERROR'
      },
      CONNECTION_ERROR: {
        statusCode: 500,
        message: 'Database connection error',
        code: 'CONNECTION_ERROR'
      },

      // Server errors
      INTERNAL_SERVER_ERROR: {
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      },
      UNKNOWN_ERROR: {
        statusCode: 500,
        message: 'Unknown error occurred',
        code: 'UNKNOWN_ERROR'
      }
    };
  }

  // Create custom error
  createError(errorType, customMessage = null, details = null) {
    const errorTemplate = this.errorTypes[errorType];
    
    if (!errorTemplate) {
      throw new Error(`Unknown error type: ${errorType}`);
    }

    const error = new Error(customMessage || errorTemplate.message);
    error.statusCode = errorTemplate.statusCode;
    error.code = errorTemplate.code;
    error.details = details;
    error.timestamp = new Date().toISOString();

    return error;
  }

  // Handle Prisma errors
  handlePrismaError(error) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      return this.createError('RESOURCE_ALREADY_EXISTS', 'Resource already exists', {
        field: error.meta?.target,
        constraint: 'unique'
      });
    }

    if (error.code === 'P2025') {
      // Record not found
      return this.createError('RESOURCE_NOT_FOUND', 'Resource not found');
    }

    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return this.createError('INVALID_INPUT', 'Invalid reference to related resource');
    }

    if (error.code === 'P2014') {
      // Required relation violation
      return this.createError('INVALID_INPUT', 'Required relation is missing');
    }

    // Generic database error
    return this.createError('DATABASE_ERROR', 'Database operation failed', {
      prismaCode: error.code,
      message: error.message
    });
  }

  // Handle validation errors
  handleValidationError(errors) {
    return this.createError('VALIDATION_ERROR', 'Validation failed', {
      errors: errors.map(err => ({
        field: err.path?.join('.') || 'unknown',
        message: err.message,
        code: err.code
      }))
    });
  }

  // Handle JWT errors
  handleJWTError(error) {
    if (error.name === 'TokenExpiredError') {
      return this.createError('TOKEN_EXPIRED');
    }

    if (error.name === 'JsonWebTokenError') {
      return this.createError('INVALID_TOKEN');
    }

    if (error.name === 'NotBeforeError') {
      return this.createError('INVALID_TOKEN', 'Token not active yet');
    }

    return this.createError('AUTHENTICATION_FAILED', 'JWT verification failed');
  }

  // Handle external API errors
  handleExternalAPIError(error, service = 'External API') {
    if (error.code === 'ECONNREFUSED') {
      return this.createError('SERVICE_UNAVAILABLE', `${service} is unavailable`);
    }

    if (error.code === 'ETIMEDOUT') {
      return this.createError('API_TIMEOUT', `${service} request timeout`);
    }

    if (error.response) {
      const statusCode = error.response.status;
      if (statusCode >= 400 && statusCode < 500) {
        return this.createError('EXTERNAL_API_ERROR', `${service} client error`, {
          statusCode,
          response: error.response.data
        });
      } else if (statusCode >= 500) {
        return this.createError('EXTERNAL_API_ERROR', `${service} server error`, {
          statusCode,
          response: error.response.data
        });
      }
    }

    return this.createError('EXTERNAL_API_ERROR', `${service} error`, {
      message: error.message
    });
  }

  // Express error handler middleware
  errorHandler() {
    return (error, req, res, next) => {
      console.error('Error occurred:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // If error already has statusCode, use it
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          timestamp: error.timestamp || new Date().toISOString()
        });
      }

      // Handle specific error types
      if (error.name === 'ValidationError') {
        const validationError = this.handleValidationError(error.errors || [error]);
        return res.status(validationError.statusCode).json({
          success: false,
          error: validationError.message,
          code: validationError.code,
          details: validationError.details,
          timestamp: validationError.timestamp
        });
      }

      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        const jwtError = this.handleJWTError(error);
        return res.status(jwtError.statusCode).json({
          success: false,
          error: jwtError.message,
          code: jwtError.code,
          timestamp: jwtError.timestamp
        });
      }

      if (error.code && error.code.startsWith('P')) {
        const prismaError = this.handlePrismaError(error);
        return res.status(prismaError.statusCode).json({
          success: false,
          error: prismaError.message,
          code: prismaError.code,
          details: prismaError.details,
          timestamp: prismaError.timestamp
        });
      }

      // Default to internal server error
      const internalError = this.createError('INTERNAL_SERVER_ERROR', error.message);
      return res.status(internalError.statusCode).json({
        success: false,
        error: internalError.message,
        code: internalError.code,
        timestamp: internalError.timestamp
      });
    };
  }

  // Async error wrapper
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Not found handler
  notFoundHandler() {
    return (req, res) => {
      const notFoundError = this.createError('RESOURCE_NOT_FOUND', `Route ${req.method} ${req.path} not found`);
      res.status(notFoundError.statusCode).json({
        success: false,
        error: notFoundError.message,
        code: notFoundError.code,
        timestamp: notFoundError.timestamp
      });
    };
  }

  // Success response helper
  successResponse(data, message = 'Success', statusCode = 200) {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  // Error response helper
  errorResponse(errorType, customMessage = null, details = null) {
    const error = this.createError(errorType, customMessage, details);
    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp
    };
  }

  // Get all error types
  getErrorTypes() {
    return Object.keys(this.errorTypes);
  }

  // Add custom error type
  addErrorType(name, config) {
    this.errorTypes[name] = config;
  }
}

module.exports = ErrorHandler;
