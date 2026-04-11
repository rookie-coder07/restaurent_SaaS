import { logWarn, logError } from '../utils/logger.js';

export const timeoutMiddleware = (timeoutMs = 5000) => {
  return (req, res, next) => {
    let isTimedOut = false;

    const timeoutId = setTimeout(() => {
      isTimedOut = true;

      logWarn('REQUEST_TIMEOUT', {
        method: req.method,
        path: req.path,
        timeout: `${timeoutMs}ms`,
        userId: req.user?.id,
      });

      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
        });
      }

      req.abort?.();
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    req.on('error', () => {
      clearTimeout(timeoutId);
    });

    const originalJson = res.json;
    res.json = function (data) {
      clearTimeout(timeoutId);
      if (!isTimedOut) {
        return originalJson.call(this, data);
      }
    };

    next();
  };
};

export const queryTimeout = (client, timeoutMs = 5000) => {
  return async (query, params = []) => {
    return Promise.race([
      client.query(query, params),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };
};

export const apiCallTimeout = async (promise, timeoutMs = 5000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`API call timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

export const withTimeout = async (fn, timeoutMs = 5000, context = '') => {
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timeout after ${timeoutMs}ms: ${context}`)),
          timeoutMs
        )
      ),
    ]);
  } catch (error) {
    if (error.message.includes('timeout')) {
      logWarn('TIMEOUT_ERROR', {
        context,
        timeout: `${timeoutMs}ms`,
        error: error.message,
      });
    }
    throw error;
  }
};
