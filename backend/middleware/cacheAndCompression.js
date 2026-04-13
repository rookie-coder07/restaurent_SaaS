/**
 * Response Caching and Compression Middleware
 * Implements HTTP caching headers and automatic compression
 */

function createCacheHeaderMiddleware() {
  return (req, res, next) => {
    /**
     * Set cache headers based on resource type
     * @param {string} type - 'static', 'api', 'data'
     * @param {number} maxAge - Cache duration in seconds
     */
    res.setCacheHeaders = (type = 'api', maxAge = 300) => {
      switch (type) {
        case 'static':
          // Cache static assets for 1 year
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          break;
        case 'api':
          // Cache API responses for specified duration (default 5 minutes)
          res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
          res.setHeader('ETag', `"${Date.now()}"`);
          break;
        case 'data':
          // Cache data endpoints but allow stale-while-revalidate
          res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=3600`);
          break;
        case 'private':
          // Don't cache sensitive data
          res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          break;
        default:
          res.setHeader('Cache-Control', 'private, no-cache');
      }
    };

    next();
  };
}

/**
 * Middleware to handle If-None-Match (ETag) conditional requests
 */
function createETagMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (body) {
      const bodyString = JSON.stringify(body);
      const etag = `"${require('crypto')
        .createHash('md5')
        .update(bodyString)
        .digest('hex')}"`;

      if (req.get('If-None-Match') === etag) {
        // Client has the latest version
        return res.status(304).end();
      }

      res.setHeader('ETag', etag);
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Response compression configuration
 * Works with compression library
 */
function getCompressionConfig() {
  return {
    level: 6, // Good balance between compression ratio and speed
    threshold: 1024, // Only compress responses > 1KB
    type: [
      'application/json',
      'application/javascript',
      'text/html',
      'text/css',
      'text/plain',
      'image/svg+xml',
    ],
  };
}

/**
 * Middleware for response size optimization
 */
function createResponseOptimizationMiddleware() {
  return (req, res, next) => {
    /**
     * Send a response with size optimization
     * @param {Object} data - Response data
     * @param {Object} options - { minifyJSON, stripNulls }
     */
    res.sendOptimized = (data, options = {}) => {
      const { minifyJSON = true, stripNulls = true } = options;

      let payload = data;

      // Strip null/undefined values to reduce payload size
      if (stripNulls && typeof data === 'object') {
        payload = JSON.parse(
          JSON.stringify(data, (key, value) => {
            if (value === null || value === undefined) return undefined;
            return value;
          })
        );
      }

      res.setHeader('Content-Type', 'application/json');

      // Response will be compressed by compression middleware
      if (minifyJSON) {
        res.send(JSON.stringify(payload));
      } else {
        res.json(payload);
      }
    };

    next();
  };
}

/**
 * Middleware to track response times and sizes
 */
function createPerformanceHeadersMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    let responseSize = 0;

    const originalSend = res.send;
    res.send = function (data) {
      const responseTime = Date.now() - startTime;
      responseSize = Buffer.byteLength(JSON.stringify(data));

      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Response-Size', `${responseSize}bytes`);

      // Log slow responses (> 1 second)
      if (responseTime > 1000) {
        console.warn(`[PERF] Slow response: ${req.method} ${req.path} took ${responseTime}ms`);
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

export {
  createCacheHeaderMiddleware,
  createETagMiddleware,
  getCompressionConfig,
  createResponseOptimizationMiddleware,
  createPerformanceHeadersMiddleware,
};
