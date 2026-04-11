import { performanceMonitor } from '../utils/performanceMonitor.js';
import { cacheManager } from '../utils/cacheManager.js';
import logger from '../utils/logger.js';

// Performance tracking middleware
export const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    performanceMonitor.recordRequest(req.method, req.path, duration, res.statusCode);

    if (duration > 500) {
      logger.debug(`⏱️ ${req.method} ${req.path} - ${duration}ms`);
    }

    return originalSend.call(this, data);
  };

  next();
};

// Pagination middleware - extracts and validates pagination parameters
export const paginationMiddleware = (req, res, next) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 per page
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  req.pagination = {
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
  };

  next();
};

// Request cache middleware - for GET requests
export const cacheMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = `http:${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    res.set('X-Cache-Hit', 'true');
    return res.json(cached);
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to cache response
  res.json = function(data) {
    if (res.statusCode === 200) {
      cacheManager.set(cacheKey, data, 60); // Cache for 60 seconds
      res.set('X-Cache-Hit', 'false');
    }
    return originalJson(data);
  };

  next();
};

export default {
  performanceMiddleware,
  paginationMiddleware,
  cacheMiddleware,
};
