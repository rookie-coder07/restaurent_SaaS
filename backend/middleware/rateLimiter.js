/**
 * Request Rate Limiter - Prevents API abuse and optimizes server load
 * Implements token bucket algorithm with per-IP/user tracking
 */

class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.clients = new Map();
  }

  /**
   * Check if a request is allowed
   * @param {string} identifier - IP address or user ID
   * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
   */
  check(identifier) {
    const now = Date.now();
    let clientData = this.clients.get(identifier);

    if (!clientData || now - clientData.resetTime >= this.windowMs) {
      // Create a new window
      clientData = {
        count: 1,
        resetTime: now,
      };
      this.clients.set(identifier, clientData);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    const isAllowed = clientData.count < this.maxRequests;
    if (isAllowed) {
      clientData.count++;
    }

    const timeUntilReset = this.windowMs - (now - clientData.resetTime);
    return {
      allowed: isAllowed,
      remaining: Math.max(0, this.maxRequests - clientData.count),
      resetTime: clientData.resetTime + this.windowMs,
      retryAfter: isAllowed ? null : timeUntilReset,
    };
  }

  /**
   * Reset limit for a specific identifier
   * @param {string} identifier - IP address or user ID
   */
  reset(identifier) {
    this.clients.delete(identifier);
  }

  /**
   * Get statistics
   */
  getStats() {
    let totalRequests = 0;
    let blockedClients = 0;

    for (const clientData of this.clients.values()) {
      totalRequests += clientData.count;
      if (clientData.count >= this.maxRequests) {
        blockedClients++;
      }
    }

    return {
      trackedClients: this.clients.size,
      blockedClients,
      totalRequests,
      averageRequestsPerClient: this.clients.size > 0 ? (totalRequests / this.clients.size).toFixed(2) : 0,
    };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    for (const [identifier, clientData] of this.clients.entries()) {
      if (now - clientData.resetTime > this.windowMs * 2) {
        this.clients.delete(identifier);
      }
    }
  }
}

/**
 * Express middleware for rate limiting
 */
function createRateLimitMiddleware(maxRequests = 100, windowMs = 60 * 1000) {
  const limiter = new RateLimiter(maxRequests, windowMs);

  // Cleanup every 5 minutes
  setInterval(() => {
    limiter.cleanup();
  }, 5 * 60 * 1000);

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const result = limiter.check(identifier);

    res.setHeader('X-RateLimit-Limit', limiter.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      
      res.setHeader('Retry-After', Math.ceil((result.retryAfter || 0) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(result.retryAfter / 1000),
      });
    }

    next();
  };
}

export { RateLimiter, createRateLimitMiddleware };
