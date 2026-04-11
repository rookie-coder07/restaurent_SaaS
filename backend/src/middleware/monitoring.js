import { logSlowAPI, logInfo } from '../utils/logger.js';

export class ResponseMetrics {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalSuccess: 0,
      totalDuration: 0,
      avgResponseTime: 0,
      errorRate: 0,
      slowAPICount: 0,
      endpoints: {},
      startTime: Date.now(),
      uptime: 0,
    };
  }

  recordRequest(method, endpoint, statusCode, duration) {
    this.metrics.totalRequests++;
    this.metrics.totalDuration += duration;
    this.metrics.avgResponseTime = Math.round(this.metrics.totalDuration / this.metrics.totalRequests);
    this.metrics.uptime = Math.round((Date.now() - this.metrics.startTime) / 1000);

    if (statusCode >= 400) {
      this.metrics.totalErrors++;
    } else {
      this.metrics.totalSuccess++;
    }

    this.metrics.errorRate = Number(
      ((this.metrics.totalErrors / this.metrics.totalRequests) * 100).toFixed(2)
    );

    const key = `${method} ${endpoint}`;
    if (!this.metrics.endpoints[key]) {
      this.metrics.endpoints[key] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        errors: 0,
        lastCalled: new Date(),
      };
    }

    this.metrics.endpoints[key].count++;
    this.metrics.endpoints[key].totalDuration += duration;
    this.metrics.endpoints[key].avgDuration = Math.round(
      this.metrics.endpoints[key].totalDuration / this.metrics.endpoints[key].count
    );
    this.metrics.endpoints[key].lastCalled = new Date();

    if (statusCode >= 400) {
      this.metrics.endpoints[key].errors++;
    }

    if (duration > 1000) {
      this.metrics.slowAPICount++;
      logSlowAPI(endpoint, method, duration, 1000);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
    };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalSuccess: 0,
      totalDuration: 0,
      avgResponseTime: 0,
      errorRate: 0,
      slowAPICount: 0,
      endpoints: {},
      startTime: Date.now(),
      uptime: 0,
    };
  }
}

export const metricsInstance = new ResponseMetrics();

export const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();

  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode || 200;
    const endpoint = req.route?.path || req.path;
    const method = req.method;

    metricsInstance.recordRequest(method, endpoint, statusCode, duration);

    if (duration > 1000) {
      logSlowAPI(endpoint, method, duration, 1000);
    }

    res.set('X-Response-Time', `${duration}ms`);
    res.set('X-Request-Id', req.id || 'N/A');

    return originalJson.call(this, data);
  };

  next();
};

export const getMetrics = (req, res) => {
  res.json({
    success: true,
    data: metricsInstance.getMetrics(),
  });
};

export const resetMetrics = (req, res) => {
  metricsInstance.reset();
  res.json({
    success: true,
    message: 'Metrics reset',
  });
};
