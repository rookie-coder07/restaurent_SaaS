/**
 * Request Deduplication Layer
 * Prevents redundant API calls during rapid bill/KOT operations
 * Critical for performance during settle operations
 */

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * Execute function only once per key, sharing result with simultaneous calls
   */
  deduplicate(key, asyncFn) {
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
}

class ResponseCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlMs = 5000) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key) {
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
