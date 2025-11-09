/**
 * Enhanced Logging Utility with OpenTelemetry Integration
 *
 * Comprehensive tracing and logging for the Orchestrall platform
 * Provides structured logging, distributed tracing, and metrics collection
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../core/config';
import { observability } from '../core/observability';

// Log levels and their numeric values
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Log context interface for structured logging
export interface LogContext {
  userId?: string;
  organizationId?: string;
  agentId?: string;
  workflowId?: string;
  executionId?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  error?: Error;
  duration?: number;
  component?: string;
  operation?: string;
}

// Enhanced logger class with OpenTelemetry integration
export class OrchestrallLogger {
  private logger: winston.Logger;
  private serviceName: string;
  private tracer: any;
  private meter: any;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.tracer = observability.getTracer(serviceName);
    this.meter = observability.getMeter();

    // Create Winston logger with structured format
    this.logger = winston.createLogger({
      level: config.logging.level,
      format: config.logging.format === 'json'
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })
          ),
      defaultMeta: {
        service: serviceName,
        version: process.env.npm_package_version || '2.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),

        // File transport (if enabled)
        ...(config.logging.file.enabled
          ? [
              new DailyRotateFile({
                filename: `${config.logging.file.path}/orchestrall-%DATE%.log`,
                datePattern: 'YYYY-MM-DD',
                maxSize: config.logging.file.maxSize,
                maxFiles: config.logging.file.maxFiles,
                format: winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json()
                ),
              }),
            ]
          : []),
      ],
      exceptionHandlers: [
        new winston.transports.File({
          filename: `${config.logging.file.path}/orchestrall-exceptions.log`,
        }),
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: `${config.logging.file.path}/orchestrall-rejections.log`,
        }),
      ],
    });

    // Create logs directory if it doesn't exist
    if (config.logging.file.enabled) {
      import('fs/promises').then(({ mkdir }) => {
        mkdir(config.logging.file.path, { recursive: true }).catch(error => {
          console.error('Failed to create logs directory:', error);
        });
      });
    }

    // Create metrics for logging
    this.createLogMetrics();
  }

  private createLogMetrics() {
    try {
      // Counter for log events by level
      const logCounter = this.meter.createCounter('log_events_total', {
        description: 'Total number of log events by level',
      });

      // Histogram for log processing time
      const logDuration = this.meter.createHistogram('log_processing_duration_ms', {
        description: 'Time taken to process and emit logs',
      });

      // Store for cleanup
      this.meter = { ...this.meter, logCounter, logDuration };
    } catch (error) {
      // Fallback if metrics not available
    }
  }

  // Enhanced logging methods with tracing context
  error(message: string, context?: LogContext) {
    this.logWithTrace(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.logWithTrace(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext) {
    this.logWithTrace(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext) {
    this.logWithTrace(LogLevel.DEBUG, message, context);
  }

  trace(message: string, context?: LogContext) {
    this.logWithTrace(LogLevel.TRACE, message, context);
  }

  // Method for performance timing
  startTimer(label: string): () => number {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.debug(`Operation completed in ${duration}ms`, {
        operation: label,
        duration,
        metadata: { timer: true },
      });
      return duration;
    };
  }

  // Method for tracing function execution
  async traceAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName);

    try {
      span.setAttributes({
        'operation.name': operationName,
        'component': context?.component || 'unknown',
        ...context?.metadata,
      });

      const result = await fn();

      span.setStatus({ code: 1, message: 'SUCCESS' });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  private logWithTrace(level: LogLevel, message: string, context?: LogContext) {
    const startTime = Date.now();

    // Create log entry with structured data
    const logEntry = {
      level: LogLevel[level],
      message,
      ...context,
      timestamp: new Date().toISOString(),
      traceId: this.getCurrentTraceId(),
      spanId: this.getCurrentSpanId(),
    };

    // Add error stack trace if present
    if (context?.error) {
      logEntry.stack = context.error.stack;
    }

    // Log to Winston
    this.logger.log(LogLevel[level] === LogLevel.ERROR ? 'error' :
                   LogLevel[level] === LogLevel.WARN ? 'warn' :
                   LogLevel[level] === LogLevel.INFO ? 'info' :
                   LogLevel[level] === LogLevel.DEBUG ? 'debug' : 'verbose', message, logEntry);

    // Record metrics
    try {
      if (this.meter.logCounter) {
        this.meter.logCounter.add(1, {
          level: LogLevel[level].toString(),
          service: this.serviceName,
        });
      }

      // Record processing time
      if (this.meter.logDuration) {
        const duration = Date.now() - startTime;
        this.meter.logDuration.record(duration);
      }
    } catch (error) {
      // Fallback if metrics not available
    }

    // Also log to OpenTelemetry if available
    try {
      const otelLogger = observability.getLogger();
      otelLogger.emit({
        body: message,
        severityNumber: this.mapLogLevelToSeverity(level),
        severityText: LogLevel[level],
        attributes: {
          ...context?.metadata,
          'log.level': LogLevel[level].toString(),
          'service.name': this.serviceName,
        },
      });
    } catch (error) {
      // Fallback if OpenTelemetry not available
    }
  }

  private mapLogLevelToSeverity(level: LogLevel): number {
    switch (level) {
      case LogLevel.ERROR: return 17; // ERROR
      case LogLevel.WARN: return 13;  // WARN
      case LogLevel.INFO: return 9;   // INFO
      case LogLevel.DEBUG: return 5;  // DEBUG
      case LogLevel.TRACE: return 1;  // TRACE
      default: return 9; // INFO
    }
  }

  private getCurrentTraceId(): string {
    try {
      const { trace } = require('@opentelemetry/api');
      const span = trace.getSpan(trace.getTracer('default'));
      return span?.spanContext()?.traceId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getCurrentSpanId(): string {
    try {
      const { trace } = require('@opentelemetry/api');
      const span = trace.getSpan(trace.getTracer('default'));
      return span?.spanContext()?.spanId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Method to add custom metrics
  recordMetric(name: string, value: number, attributes?: Record<string, string>) {
    try {
      const histogram = this.meter.createHistogram(name, {
        description: `Custom metric: ${name}`,
      });
      histogram.record(value, attributes);
    } catch (error) {
      this.warn(`Failed to record metric ${name}`, { error: error.message });
    }
  }

  // Method to increment counters
  incrementCounter(name: string, attributes?: Record<string, string>) {
    try {
      const counter = this.meter.createCounter(name, {
        description: `Custom counter: ${name}`,
      });
      counter.add(1, attributes);
    } catch (error) {
      this.warn(`Failed to increment counter ${name}`, { error: error.message });
    }
  }
}

// Factory function to create service-specific loggers
export function createLogger(serviceName: string): OrchestrallLogger {
  return new OrchestrallLogger(serviceName);
}

// Global logger instance for core services (maintains backward compatibility)
export const logger = createLogger('orchestrall-core');

// Export for use in other modules
export default OrchestrallLogger;
