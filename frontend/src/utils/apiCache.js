/**
 * Simple in-memory cache for API responses
 * Prevents duplicate requests and improves performance
 */

class APICache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate cache key from function and arguments
   * @param {string} key - Unique identifier for the cache entry
   * @returns {string} - Cache key
   */
  generateKey(key) {
    return String(key);
  }

  /**
   * Set cache value with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  set(key, value, ttl = this.DEFAULT_TTL) {
    const cacheKey = this.generateKey(key);

    // Clear existing timer if any
    if (this.timers.has(cacheKey)) {
      clearTimeout(this.timers.get(cacheKey));
    }

    // Set new cache value
    this.cache.set(cacheKey, {
      data: value,
      timestamp: Date.now(),
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.cache.delete(cacheKey);
      this.timers.delete(cacheKey);
    }, ttl);

    this.timers.set(cacheKey, timer);
  }

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @param {number} maxAge - Maximum age in milliseconds (optional)
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key, maxAge = null) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check if entry is still valid
    if (maxAge !== null && Date.now() - entry.timestamp > maxAge) {
      this.invalidate(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const cacheKey = this.generateKey(key);
    return this.cache.has(cacheKey);
  }

  /**
   * Invalidate cache entry
   * @param {string} key - Cache key
   */
  invalidate(key) {
    const cacheKey = this.generateKey(key);
    this.cache.delete(cacheKey);
    if (this.timers.has(cacheKey)) {
      clearTimeout(this.timers.get(cacheKey));
      this.timers.delete(cacheKey);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache stats
   * @returns {object}
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const apiCache = new APICache();

// Export class for testing
export default APICache;
