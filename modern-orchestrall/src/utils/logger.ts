import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../core/config';

export const logger = winston.createLogger({
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
  defaultMeta: { service: 'orchestrall-core' },
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
});

// Create logs directory if it doesn't exist
import { mkdir } from 'fs/promises';
if (config.logging.file.enabled) {
  try {
    await mkdir(config.logging.file.path, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error);
  }
}
