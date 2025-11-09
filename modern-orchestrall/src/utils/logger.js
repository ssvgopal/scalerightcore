// src/utils/logger.js - Enhanced Logging System
const winston = require('winston');
const path = require('path');
const config = require('../config');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
      service: 'orchestrall-platform',
      version: config.deployment.version,
      environment: config.server.nodeEnv,
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'orchestrall-platform',
    version: config.deployment.version,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.server.nodeEnv === 'development' ? consoleFormat : logFormat,
    }),
    
    // File transports
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

// Add request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  if (next) next();
};

// Add agent execution logging
logger.agentExecution = (agentName, input, output, duration, metadata = {}) => {
  logger.info('Agent Execution', {
    agentName,
    inputLength: input?.length || 0,
    outputLength: output?.length || 0,
    duration,
    success: !output?.error,
    ...metadata,
  });
};

// Add workflow execution logging
logger.workflowExecution = (workflowId, status, duration, metadata = {}) => {
  logger.info('Workflow Execution', {
    workflowId,
    status,
    duration,
    ...metadata,
  });
};

// Add security event logging
logger.securityEvent = (event, details = {}) => {
  logger.warn('Security Event', {
    event,
    ...details,
  });
};

// Add performance metrics logging
logger.performance = (operation, duration, metadata = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration,
    ...metadata,
  });
};

// Add database operation logging
logger.database = (operation, table, duration, metadata = {}) => {
  logger.debug('Database Operation', {
    operation,
    table,
    duration,
    ...metadata,
  });
};

// Export logger instance
module.exports = logger;
