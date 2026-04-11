import { metricsInstance } from '../middleware/monitoring.js';
import { alertService } from './alertService.js';
import { logInfo, logWarn } from '../utils/logger.js';

export class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 30000;
    this.minUptimeBeforeAlertsMs = 120000;
    this.minRequestsBeforeAlerts = 20;
    this.intervalId = null;
    this.lastMetrics = null;
    this.dbErrorCount = 0;
    this.billingErrorCount = 0;
    this.startedAt = 0;
  }

  start() {
    if (this.isRunning) {
      logWarn('Monitoring service already running');
      return;
    }

    this.isRunning = true;
    this.startedAt = Date.now();
    logInfo('Monitoring service started', {
      checkInterval: `${this.checkInterval}ms`,
    });

    this.performCheck();

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
      const uptimeMs = Date.now() - this.startedAt;
      const canTriggerAlerts =
        uptimeMs >= this.minUptimeBeforeAlertsMs &&
        metrics.totalRequests >= this.minRequestsBeforeAlerts;

      if (canTriggerAlerts) {
        alertService.checkErrorRate(metrics.errorRate, metrics.totalRequests);
        alertService.checkLatency(metrics.avgResponseTime, metrics.p95ResponseTime);
      }

      if (canTriggerAlerts && metrics.slowAPICount > 10) {
        alertService.emit({
          type: 'SLOW_APIS',
          severity: 'warning',
          count: metrics.slowAPICount,
          message: `${metrics.slowAPICount} slow API calls detected (>1s)`,
        });
      }

      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      alertService.checkMemoryUsage(memPercent);

      if (this.billingErrorCount > 0) {
        alertService.checkBillingErrors(this.billingErrorCount);
        this.billingErrorCount = 0;
      }

      this.lastMetrics = metrics;

      logInfo('Monitoring check completed', {
        errorRate: `${metrics.errorRate}%`,
        avgResponseTime: `${metrics.avgResponseTime}ms`,
        p95ResponseTime: `${metrics.p95ResponseTime}ms`,
        memoryUsage: `${memPercent.toFixed(2)}%`,
        slowAPIs: metrics.slowAPICount,
        alertingActive: canTriggerAlerts,
      });

      metricsInstance.reset();
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

  recordBillingError() {
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
