import { metricsInstance } from '../middleware/monitoring.js';
import { alertService } from './alertService.js';
import { logInfo, logWarn } from '../utils/logger.js';

export class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 30000; // Check every 30 seconds
    this.intervalId = null;
    this.lastMetrics = null;
    this.dbErrorCount = 0;
    this.billingErrorCount = 0;
  }

  start() {
    if (this.isRunning) {
      logWarn('Monitoring service already running');
      return;
    }

    this.isRunning = true;
    logInfo('Monitoring service started', {
      checkInterval: `${this.checkInterval}ms`,
    });

    // Initial check
    this.performCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logInfo('Monitoring service stopped');
  }

  performCheck() {
    if (!this.isRunning) {
      return;
    }

    try {
      const metrics = metricsInstance.getMetrics();

      // Check error rate
      if (metrics.totalRequests > 10) {
        alertService.checkErrorRate(metrics.errorRate, metrics.totalRequests);
      }

      // Check latency
      if (metrics.totalRequests > 0) {
        alertService.checkLatency(metrics.avgResponseTime, metrics.avgResponseTime * 1.5);
      }

      // Check slow API count
      if (metrics.slowAPICount > 10) {
        alertService.emit({
          type: 'SLOW_APIS',
          severity: 'warning',
          count: metrics.slowAPICount,
          message: `${metrics.slowAPICount} slow API calls detected (>1s)`,
        });
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      alertService.checkMemoryUsage(memPercent);

      // Check billing errors
      if (this.billingErrorCount > 0) {
        alertService.checkBillingErrors(this.billingErrorCount);
        this.billingErrorCount = 0;
      }

      this.lastMetrics = metrics;

      logInfo('Monitoring check completed', {
        errorRate: `${metrics.errorRate}%`,
        avgResponseTime: `${metrics.avgResponseTime}ms`,
        memoryUsage: `${memPercent.toFixed(2)}%`,
        slowAPIs: metrics.slowAPICount,
      });
    } catch (error) {
      logWarn('Monitoring check failed', {
        error: error?.message,
      });
    }
  }

  recordDatabaseError(error) {
    this.dbErrorCount++;
    if (this.dbErrorCount > 3) {
      alertService.emit({
        type: 'DATABASE_ERROR',
        severity: 'critical',
        count: this.dbErrorCount,
        error: error?.message,
        message: `Database error count: ${this.dbErrorCount}`,
      });
      this.dbErrorCount = 0;
    }
  }

  recordBillingError(error) {
    this.billingErrorCount++;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastMetrics?.timestamp,
      dbErrorCount: this.dbErrorCount,
      billingErrorCount: this.billingErrorCount,
    };
  }
}

export const monitoringService = new MonitoringService();
