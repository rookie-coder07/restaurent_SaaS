import { logError, logCriticalError, logWarn } from '../utils/logger.js';

export class AlertService {
  constructor() {
    this.alerts = [];
    this.subscribers = [];
    this.lastTriggeredAt = new Map();
    this.thresholds = {
      errorRate: 5, // 5% error rate
      latencyP95: 2000, // 2 second P95
      latencyAvg: 1000, // 1 second average
      cpuUsage: 80, // 80% CPU
      memoryUsage: 85, // 85% memory
      dbConnectionErrors: 3, // 3 errors
    };
    this.cooldowns = {
      ERROR_RATE_HIGH: 5 * 60 * 1000,
      HIGH_LATENCY: 5 * 60 * 1000,
      P95_LATENCY_HIGH: 5 * 60 * 1000,
      DB_CONNECTION_FAILED: 2 * 60 * 1000,
      SERVER_UNHEALTHY: 2 * 60 * 1000,
      HIGH_MEMORY_USAGE: 5 * 60 * 1000,
      HIGH_CPU_USAGE: 5 * 60 * 1000,
      BILLING_ERROR_DETECTED: 2 * 60 * 1000,
    };
  }

  shouldTrigger(type, cooldownOverride = null) {
    const cooldown = cooldownOverride ?? this.cooldowns[type] ?? 0;
    const now = Date.now();
    const lastTriggered = this.lastTriggeredAt.get(type) || 0;

    if (cooldown > 0 && now - lastTriggered < cooldown) {
      return false;
    }

    this.lastTriggeredAt.set(type, now);
    return true;
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  emit(alert) {
    this.alerts.push({
      ...alert,
      timestamp: new Date().toISOString(),
      id: `${Date.now()}-${Math.random()}`,
    });

    this.subscribers.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        logError('Alert subscriber error', error);
      }
    });
  }

  checkErrorRate(errorRate, totalRequests) {
    if (totalRequests < 10) return;

    if (errorRate > this.thresholds.errorRate) {
      if (!this.shouldTrigger('ERROR_RATE_HIGH')) {
        return;
      }

      this.emit({
        type: 'ERROR_RATE_HIGH',
        severity: 'critical',
        value: errorRate,
        threshold: this.thresholds.errorRate,
        message: `Error rate is ${errorRate}% (threshold: ${this.thresholds.errorRate}%)`,
      });

      logCriticalError('High error rate detected', new Error(`Error rate: ${errorRate}%`));
    }
  }

  checkLatency(avgLatency, p95Latency) {
    if (avgLatency > this.thresholds.latencyAvg) {
      if (this.shouldTrigger('HIGH_LATENCY')) {
        this.emit({
          type: 'HIGH_LATENCY',
          severity: 'warning',
          metric: 'average',
          value: avgLatency,
          threshold: this.thresholds.latencyAvg,
          message: `Average latency ${avgLatency}ms exceeds threshold ${this.thresholds.latencyAvg}ms`,
        });

        logWarn('High average latency detected', {
          latency: `${avgLatency}ms`,
          threshold: `${this.thresholds.latencyAvg}ms`,
        });
      }
    }

    if (p95Latency > this.thresholds.latencyP95) {
      if (!this.shouldTrigger('P95_LATENCY_HIGH')) {
        return;
      }

      this.emit({
        type: 'P95_LATENCY_HIGH',
        severity: 'critical',
        metric: 'p95',
        value: p95Latency,
        threshold: this.thresholds.latencyP95,
        message: `P95 latency ${p95Latency}ms exceeds threshold ${this.thresholds.latencyP95}ms`,
      });

      logCriticalError('High P95 latency detected', new Error(`P95 latency: ${p95Latency}ms`));
    }
  }

  checkDatabaseConnection(isConnected, lastError) {
    if (!isConnected) {
      if (!this.shouldTrigger('DB_CONNECTION_FAILED')) {
        return;
      }

      this.emit({
        type: 'DB_CONNECTION_FAILED',
        severity: 'critical',
        message: 'Database connection failed',
        error: lastError?.message,
      });

      logCriticalError('Database connection failed', lastError || new Error('DB connection lost'));
    }
  }

  checkServerHealth(healthStatus) {
    if (!healthStatus.ok) {
      if (!this.shouldTrigger('SERVER_UNHEALTHY')) {
        return;
      }

      this.emit({
        type: 'SERVER_UNHEALTHY',
        severity: 'critical',
        message: 'Server health check failed',
        checks: healthStatus.checks,
      });

      logCriticalError('Server health check failed', new Error('Unhealthy status'));
    }
  }

  checkMemoryUsage(usagePercent) {
    if (usagePercent > this.thresholds.memoryUsage) {
      if (!this.shouldTrigger('HIGH_MEMORY_USAGE')) {
        return;
      }

      this.emit({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        value: usagePercent,
        threshold: this.thresholds.memoryUsage,
        message: `Memory usage ${usagePercent}% exceeds threshold`,
      });

      logWarn('High memory usage detected', {
        usage: `${usagePercent}%`,
        threshold: `${this.thresholds.memoryUsage}%`,
      });
    }
  }

  checkCPUUsage(usagePercent) {
    if (usagePercent > this.thresholds.cpuUsage) {
      if (!this.shouldTrigger('HIGH_CPU_USAGE')) {
        return;
      }

      this.emit({
        type: 'HIGH_CPU_USAGE',
        severity: 'warning',
        value: usagePercent,
        threshold: this.thresholds.cpuUsage,
        message: `CPU usage ${usagePercent}% exceeds threshold`,
      });

      logWarn('High CPU usage detected', {
        usage: `${usagePercent}%`,
        threshold: `${this.thresholds.cpuUsage}%`,
      });
    }
  }

  checkBillingErrors(errorCount) {
    if (errorCount > 0) {
      if (!this.shouldTrigger('BILLING_ERROR_DETECTED')) {
        return;
      }

      this.emit({
        type: 'BILLING_ERROR_DETECTED',
        severity: 'critical',
        count: errorCount,
        message: `${errorCount} billing errors detected in this period`,
      });

      logCriticalError(`Billing errors detected: ${errorCount}`, new Error('Billing operation failed'));
    }
  }

  getAlerts(limit = 100, type = null) {
    let filtered = this.alerts;

    if (type) {
      filtered = filtered.filter((a) => a.type === type);
    }

    return filtered.slice(-limit);
  }

  clearAlerts(hoursOld = 24) {
    const cutoff = Date.now() - hoursOld * 60 * 60 * 1000;
    this.alerts = this.alerts.filter((a) => new Date(a.timestamp).getTime() > cutoff);
  }

  getAlertSummary() {
    const summary = {
      total: this.alerts.length,
      critical: this.alerts.filter((a) => a.severity === 'critical').length,
      warning: this.alerts.filter((a) => a.severity === 'warning').length,
      info: this.alerts.filter((a) => a.severity === 'info').length,
      types: {},
    };

    this.alerts.forEach((alert) => {
      if (!summary.types[alert.type]) {
        summary.types[alert.type] = 0;
      }
      summary.types[alert.type]++;
    });

    return {
      ...summary,
      timestamp: new Date().toISOString(),
    };
  }

  setThreshold(key, value) {
    if (this.thresholds.hasOwnProperty(key)) {
      this.thresholds[key] = value;
    }
  }
}

export const alertService = new AlertService();
