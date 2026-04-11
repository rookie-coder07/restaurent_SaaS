import logger from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: [],
      slowQueries: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.thresholds = {
      slowQuery: 500, // ms
      slowRequest: 1000, // ms
    };
  }

  recordRequest(method, path, duration, statusCode) {
    if (!method || !path || !duration) return;
    
    const request = {
      method: method || 'UNKNOWN',
      path: path || 'UNKNOWN',
      duration: duration || 0,
      statusCode: statusCode || 500,
      timestamp: new Date().toISOString(),
    };

    this.metrics.requests.push(request);

    // Keep only last 1000 requests
    if (this.metrics.requests.length > 1000) {
      this.metrics.requests.shift();
    }

    if (duration > this.thresholds.slowRequest) {
      this.recordSlowQuery(`${method} ${path}`, duration);
    }
  }

  recordSlowQuery(query, duration) {
    if (!query || !duration) return;
    
    this.metrics.slowQueries.push({
      query: query || 'UNKNOWN',
      duration: duration || 0,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 500 slow queries
    if (this.metrics.slowQueries.length > 500) {
      this.metrics.slowQueries.shift();
    }
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  getStats() {
    const total = this.metrics.requests?.length || 0;
    const avgDuration = total > 0
      ? (this.metrics.requests || []).reduce((sum, r) => sum + (r?.duration || 0), 0) / total
      : 0;

    const p95Duration = this.getPercentile(95);
    const p99Duration = this.getPercentile(99);
    const maxDuration = Math.max(0, ...(this.metrics.requests || []).map(r => r?.duration || 0));

    const cacheTotal = (this.metrics.cacheHits || 0) + (this.metrics.cacheMisses || 0);
    const cacheHitRate = cacheTotal > 0
      ? (((this.metrics.cacheHits || 0) / cacheTotal) * 100).toFixed(2)
      : 0;

    return {
      totalRequests: total,
      avgDuration: avgDuration.toFixed(2),
      p95Duration: p95Duration.toFixed(2),
      p99Duration: p99Duration.toFixed(2),
      maxDuration,
      cacheHits: this.metrics.cacheHits || 0,
      cacheMisses: this.metrics.cacheMisses || 0,
      cacheHitRate: `${cacheHitRate}%`,
      slowQueriesCount: (this.metrics.slowQueries || []).length,
      slowQueriesThreshold: `${this.thresholds.slowQuery}ms`,
    };
  }

  getPercentile(percentile) {
    const requests = this.metrics.requests || [];
    if (requests.length === 0) return 0;
    if (percentile < 0 || percentile > 100) return 0;

    const sorted = [...requests].sort((a, b) => (a?.duration || 0) - (b?.duration || 0));
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)]?.duration || 0;
  }

  getRecentSlowQueries(limit = 10) {
    return this.metrics.slowQueries.slice(-limit).reverse();
  }

  resetMetrics() {
    this.metrics = {
      requests: [],
      slowQueries: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
    logger.info('📊 Performance metrics reset');
  }

  logStats() {
    const stats = this.getStats();
    logger.info('📊 PERFORMANCE STATS:');
    logger.info(`  Total Requests: ${stats.totalRequests}`);
    logger.info(`  Avg Duration: ${stats.avgDuration}ms`);
    logger.info(`  P95: ${stats.p95Duration}ms`);
    logger.info(`  P99: ${stats.p99Duration}ms`);
    logger.info(`  Max: ${stats.maxDuration}ms`);
    logger.info(`  Cache Hit Rate: ${stats.cacheHitRate}`);
    logger.info(`  Slow Queries: ${stats.slowQueriesCount}`);
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
