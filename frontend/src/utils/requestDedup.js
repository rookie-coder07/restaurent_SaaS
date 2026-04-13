/**
 * Request Deduplication Layer
 * Prevents redundant API calls during rapid bill/KOT operations
 * Critical for performance during settle operations
 * 
 * ⚠️ IMPORTANT: Does NOT cache auth endpoints to prevent stale credentials
 */

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/logout',
  '/auth/me',
  '/auth/register',
  '/auth/change-password',
  '/auth/reset-password',
  '/manager/reset-user-password',
];

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * Check if endpoint should be cached
   */
  isAuthEndpoint(key) {
    return AUTH_ENDPOINTS.some(endpoint => key.includes(endpoint));
  }

  /**
   * Execute function only once per key, sharing result with simultaneous calls
   */
  deduplicate(key, asyncFn) {
    // ⚠️ SAFETY: Do NOT deduplicate auth endpoints
    if (this.isAuthEndpoint(key)) {
      return asyncFn();
    }

    // Return existing promise if request is already in flight
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new promise and store it
    const promise = asyncFn()
      .then((result) => {
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear() {
    this.pendingRequests.clear();
  }

  clearAuth() {
    // Clear any pending auth requests
    for (const [key] of this.pendingRequests) {
      if (this.isAuthEndpoint(key)) {
        this.pendingRequests.delete(key);
      }
    }
  }
}

class ResponseCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Check if key is an auth endpoint
   */
  isAuthEndpoint(key) {
    return AUTH_ENDPOINTS.some(endpoint => key.includes(endpoint));
  }

  set(key, value, ttlMs = 5000) {
    // ⚠️ SAFETY: Never cache auth endpoints
    if (this.isAuthEndpoint(key)) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key) {
    // ⚠️ SAFETY: Never retrieve cached auth data
    if (this.isAuthEndpoint(key)) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }

  clearAuth() {
    // Clear any cached auth data
    for (const [key] of this.cache) {
      if (this.isAuthEndpoint(key)) {
        this.cache.delete(key);
      }
    }
  }

  invalidatePrefix(prefix) {
    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const deduplicator = new RequestDeduplicator();
export const responseCache = new ResponseCache();

/**
 * Wrap API call with deduplication
 * Usage: dedupedOrderAPI.markOrderPaid(orderId, data)
 */
export function createDedupedAPI(apiObject) {
  const proxied = {};

  for (const [method, fn] of Object.entries(apiObject)) {
    if (typeof fn === 'function') {
      proxied[method] = (...args) => {
        const key = `${method}:${JSON.stringify(args).slice(0, 200)}`;
        return deduplicator.deduplicate(key, () => fn(...args));
      };
    } else {
      proxied[method] = fn;
    }
  }

  return proxied;
}
