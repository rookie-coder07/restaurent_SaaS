import logger from './logger.js';

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    // Fail-safe checks
    if (!key) return;
    if (value === undefined) return;
    if (!ttlSeconds || ttlSeconds <= 0) ttlSeconds = 300;
    
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      try {
        this.cache.delete(key);
        this.timers.delete(key);
      } catch (e) {
        logger.debug(`Cache expiration error: ${key}`);
      }
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
    logger.debug(`💾 Cache set: ${key} (TTL: ${ttlSeconds}s)`);
  }

  get(key) {
    if (!key) return null;
    try {
      const item = this.cache.get(key);
      if (item) {
        return item?.value || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  has(key) {
    if (!key) return false;
    return this.cache.has(key);
  }

  delete(key) {
    if (!key) return false;
    try {
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      return this.cache.delete(key);
    } catch (e) {
      return false;
    }
  }

  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
    logger.info('🧹 Cache cleared');
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cacheManager = new CacheManager();
export default cacheManager;
