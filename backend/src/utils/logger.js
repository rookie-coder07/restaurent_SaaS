import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const ts = timestamp.slice(0, 19).replace('T', ' ');
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${ts} [${level}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'restaurant-saas-api' },
  transports: [
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // Slow queries log
    new winston.transports.File({
      filename: path.join(logsDir, 'slow-queries.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // API errors log
    new winston.transports.File({
      filename: path.join(logsDir, 'api-errors.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format,
    })
  );
}

export const logError = (context, error, metadata = {}) => {
  logger.error(`${context}`, {
    error: error?.message || String(error),
    stack: error?.stack,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logWarn = (context, data = {}) => {
  logger.warn(`${context}`, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logInfo = (context, data = {}) => {
  logger.info(`${context}`, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logDebug = (context, data = {}) => {
  logger.debug(`${context}`, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

export const logSlowQuery = (query, duration, threshold = 1000) => {
  if (duration > threshold) {
    logger.warn('SLOW_QUERY_DETECTED', {
      query: query.substring(0, 200),
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

export const logSlowAPI = (endpoint, method, duration, threshold = 1000) => {
  if (duration > threshold) {
    logger.warn('SLOW_API_DETECTED', {
      endpoint,
      method,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      timestamp: new Date().toISOString(),
    });
  }
};

export const logCriticalError = (context, error, userId = null, metadata = {}) => {
  logger.error(`CRITICAL_ERROR: ${context}`, {
    error: error?.message || String(error),
    stack: error?.stack,
    userId,
    ...metadata,
    timestamp: new Date().toISOString(),
    severity: 'CRITICAL',
  });
};

export const logDatabaseError = (operation, error, metadata = {}) => {
  logger.error(`DATABASE_ERROR: ${operation}`, {
    error: error?.message || String(error),
    stack: error?.stack,
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logAPIError = (endpoint, method, statusCode, error, metadata = {}) => {
  logger.error(`API_ERROR: ${method} ${endpoint}`, {
    statusCode,
    error: error?.message || String(error),
    ...metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logServerCrash = (error) => {
  logger.error('SERVER_CRASH', {
    error: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    severity: 'CRITICAL',
  });
};

export default logger;
