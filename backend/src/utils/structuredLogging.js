import logger from './logger.js';

/**
 * Structured logging utility for standardized error and action tracking
 */

export const logError = (error, context = {}) => {
  const {
    message = 'An error occurred',
    endpoint = 'unknown',
    method = 'unknown',
    userId = null,
    restaurantId = null,
    orderId = null,
    tableId = null,
    statusCode = 500,
    action = 'unknown',
  } = context;

  logger.error({
    message,
    error: error?.message || error || 'Unknown error',
    stack: error?.stack,
    statusCode,
    endpoint,
    method,
    userId,
    restaurantId,
    orderId,
    tableId,
    action,
    timestamp: new Date().toISOString(),
  });
};

export const logFailedRequest = (error, context = {}) => {
  const {
    message = 'Request failed',
    endpoint = 'unknown',
    method = 'unknown',
    userId = null,
    restaurantId = null,
    statusCode = 400,
    action = 'unknown',
  } = context;

  logger.warn({
    message,
    error: error?.message || error || 'Request validation failed',
    endpoint,
    method,
    userId,
    restaurantId,
    statusCode,
    action,
    timestamp: new Date().toISOString(),
  });
};

export const logCriticalAction = (action, context = {}) => {
  const {
    message = 'Critical action performed',
    userId = null,
    restaurantId = null,
    orderId = null,
    tableId = null,
    details = {},
    severity = 'info',
  } = context;

  const logLevel = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'info';

  logger[logLevel]({
    message,
    action,
    userId,
    restaurantId,
    orderId,
    tableId,
    details,
    timestamp: new Date().toISOString(),
  });
};

export const logSuccessfulOperation = (operation, context = {}) => {
  const {
    message = 'Operation completed successfully',
    endpoint = 'unknown',
    method = 'unknown',
    userId = null,
    restaurantId = null,
    orderId = null,
    tableId = null,
    duration = 0,
    details = {},
  } = context;

  logger.info({
    message,
    operation,
    endpoint,
    method,
    userId,
    restaurantId,
    orderId,
    tableId,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Middleware to track request performance and add logging context
 */
export const createRequestLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;

    if (isError || duration > 1000) {
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        endpoint: req.path,
        query: req.query,
        statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id || req.user?.userId || null,
        restaurantId: req.restaurantId || null,
      };

      if (isError) {
        logger.warn('Request completed with error', logData);
      } else if (duration > 1000) {
        logger.warn('Slow request detected', logData);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

export const withErrorTracking = (fn, actionName) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    try {
      await fn(req, res, next);

      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSuccessfulOperation(actionName, {
          endpoint: req.path,
          method: req.method,
          userId: req.user?.id || req.user?.userId,
          restaurantId: req.restaurantId,
          duration,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logError(error, {
        action: actionName,
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        statusCode: error.statusCode || 500,
      });
      next(error);
    }
  };
};

export default {
  logError,
  logFailedRequest,
  logCriticalAction,
  logSuccessfulOperation,
  createRequestLogger,
  withErrorTracking,
};
