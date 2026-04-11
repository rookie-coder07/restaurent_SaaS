import { logWarn } from '../utils/logger.js';

export class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.limits = {
      default: { requests: 100, window: 60000 }, // 100 requests per minute
      auth: { requests: 5, window: 300000 }, // 5 requests per 5 minutes
      api: { requests: 1000, window: 60000 }, // 1000 requests per minute
      payment: { requests: 10, window: 60000 }, // 10 requests per minute
    };
  }

  isLimited(key, limit = 'default') {
    const limitConfig = this.limits[limit] || this.limits.default;
    const now = Date.now();

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key);
    const recentRequests = timestamps.filter((ts) => now - ts < limitConfig.window);

    if (recentRequests.length >= limitConfig.requests) {
      return true;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    // Cleanup old entries
    if (this.requests.size > 10000) {
      for (const [k, v] of this.requests.entries()) {
        this.requests.set(k, v.filter((ts) => now - ts < limitConfig.window));
      }
    }

    return false;
  }

  getRemaining(key, limit = 'default') {
    const limitConfig = this.limits[limit] || this.limits.default;
    const now = Date.now();

    if (!this.requests.has(key)) {
      return limitConfig.requests;
    }

    const timestamps = this.requests.get(key);
    const recentRequests = timestamps.filter((ts) => now - ts < limitConfig.window);

    return Math.max(0, limitConfig.requests - recentRequests.length);
  }
}

export const rateLimiterInstance = new RateLimiter();

export const rateLimitMiddleware = (limitType = 'default') => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const identifiedKey = req.user?.id ? `user:${req.user.id}` : key;

    const isLimited = rateLimiterInstance.isLimited(identifiedKey, limitType);
    const remaining = rateLimiterInstance.getRemaining(identifiedKey, limitType);

    res.set('X-RateLimit-Remaining', remaining.toString());

    if (isLimited) {
      logWarn('RATE_LIMIT_EXCEEDED', {
        key: identifiedKey,
        limitType,
        ip: key,
        path: req.path,
      });

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: 60,
      });
    }

    next();
  };
};

export const apiLimiter = rateLimitMiddleware('api');
export const authLimiter = rateLimitMiddleware('auth');
export const paymentLimiter = rateLimitMiddleware('payment');
export const defaultLimiter = rateLimitMiddleware('default');
