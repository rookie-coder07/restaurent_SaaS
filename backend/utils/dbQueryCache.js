/**
 * Database Query Cache - Prevents repeated queries for frequently accessed data
 * Helps reduce database load and improves response times
 */

const dbQueryCache = new Map();

class DBQueryCache {
  /**
   * Set a cached query result
   * @param {string} key - Cache key (usually query identifier)
   * @param {any} value - Query result to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  static set(key, value, ttl = 5 * 60 * 1000) {
    const expiresAt = Date.now() + ttl;
    dbQueryCache.set(key, { value, expiresAt });

    // Set a timeout to automatically remove expired entries
    setTimeout(() => {
      if (dbQueryCache.has(key)) {
        const cached = dbQueryCache.get(key);
        if (cached.expiresAt <= Date.now()) {
          dbQueryCache.delete(key);
        }
      }
    }, ttl + 100);

    return value;
  }

  /**
   * Get a cached query result
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if expired or not found
   */
  static get(key) {
    if (!dbQueryCache.has(key)) {
      return null;
    }

    const cached = dbQueryCache.get(key);
    if (cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Remove expired entry
    dbQueryCache.delete(key);
    return null;
  }

  /**
   * Invalidate a specific cache entry
   * @param {string} key - Cache key or pattern
   */
  static invalidate(key) {
    if (key.includes('*')) {
      // If pattern includes wildcard, delete all matching keys
      const pattern = new RegExp(key.replace(/\*/g, '.*'));
      for (const cacheKey of dbQueryCache.keys()) {
        if (pattern.test(cacheKey)) {
          dbQueryCache.delete(cacheKey);
        }
      }
    } else {
      dbQueryCache.delete(key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  static clear() {
    dbQueryCache.clear();
  }

  /**
   * Get cache statistics
   */
  static stats() {
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    for (const [, cached] of dbQueryCache.entries()) {
      if (cached.expiresAt > Date.now()) {
        validEntries++;
      } else {
        expiredEntries++;
      }
      totalSize += JSON.stringify(cached.value).length;
    }

    return {
      totalEntries: dbQueryCache.size,
      validEntries,
      expiredEntries,
      approximateSizeKB: (totalSize / 1024).toFixed(2),
    };
  }
}

export default DBQueryCache;
