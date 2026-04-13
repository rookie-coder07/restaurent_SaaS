/**
 * Query Performance Monitoring and Analysis
 * Identifies slow queries and suggests optimizations
 */

class QueryMonitor {
  constructor(slowQueryThreshold = 500) {
    this.slowQueryThreshold = slowQueryThreshold; // milliseconds
    this.queries = [];
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Infinity,
    };
  }

  /**
   * Track a query execution
   * @param {string} query - SQL query
   * @param {number} executionTime - Execution time in milliseconds
   * @param {any} params - Query parameters
   */
  recordQuery(query, executionTime, params = null) {
    const isSlow = executionTime > this.slowQueryThreshold;

    const queryRecord = {
      query: this.sanitizeQuery(query),
      executionTime,
      isSlow,
      timestamp: Date.now(),
      params,
    };

    this.queries.push(queryRecord);

    // Keep only last 1000 queries to avoid memory bloat
    if (this.queries.length > 1000) {
      this.queries.shift();
    }

    // Update statistics
    this.stats.totalQueries++;
    if (isSlow) {
      this.stats.slowQueries++;
    }
    this.stats.averageTime = (this.stats.averageTime * (this.stats.totalQueries - 1) + executionTime) / this.stats.totalQueries;
    this.stats.maxTime = Math.max(this.stats.maxTime, executionTime);
    this.stats.minTime = Math.min(this.stats.minTime, executionTime);

    if (isSlow) {
      console.warn(`[SLOW QUERY] ${executionTime}ms: ${this.sanitizeQuery(query)}`);
    }

    return queryRecord;
  }

  /**
   * Sanitize query to remove sensitive data
   */
  sanitizeQuery(query) {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .substring(0, 200); // Truncate to 200 chars
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      slowQueryPercentage: ((this.stats.slowQueries / this.stats.totalQueries) * 100).toFixed(2),
    };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit = 10) {
    return this.queries
      .filter((q) => q.isSlow)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get query frequency analysis
   */
  getQueryFrequency() {
    const frequency = {};
    for (const query of this.queries) {
      frequency[query.query] = (frequency[query.query] || 0) + 1;
    }
    return Object.entries(frequency)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Reset statistics
   */
  reset() {
    this.queries = [];
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Infinity,
    };
  }
}

/**
 * Query wrapper with automatic performance tracking
 */
async function executeTrackedQuery(pool, query, params = null, queryMonitor = null) {
  const startTime = Date.now();

  try {
    const result = await pool.query(query, params);
    const executionTime = Date.now() - startTime;

    if (queryMonitor) {
      queryMonitor.recordQuery(query, executionTime, params);
    }

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    if (queryMonitor) {
      queryMonitor.recordQuery(query, executionTime, params);
    }
    throw error;
  }
}

export { QueryMonitor, executeTrackedQuery };
