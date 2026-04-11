import { Router } from 'express';
import supabase from '../config/supabase.js';
import { logError, logInfo } from '../utils/logger.js';
import { metricsInstance } from '../middleware/monitoring.js';
import { alertService } from '../services/alertService.js';

const router = Router();

export const getHealth = async (req, res) => {
  try {
    const startTime = Date.now();
    const checks = {
      api: { status: 'ok', latency: 0 },
      database: { status: 'unknown', latency: 0 },
      memory: { status: 'ok', usage: 0 },
      uptime: process.uptime(),
    };

    // Check database
    const dbStart = Date.now();
    try {
      const { data, error } = await supabase.from('restaurants').select('count', { count: 'exact' }).limit(1);

      checks.database.latency = Date.now() - dbStart;
      if (error) {
        checks.database.status = 'error';
        checks.database.error = error.message;
      } else {
        checks.database.status = 'ok';
      }
    } catch (dbError) {
      checks.database.status = 'error';
      checks.database.error = dbError?.message || 'Database connection failed';
      checks.database.latency = Date.now() - dbStart;
    }

    // Check memory
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory.usage = Math.round(memPercent);

    if (memPercent > 90) {
      checks.memory.status = 'warning';
      logWarn('Memory usage high', { usage: `${memPercent}%` });
    }

    checks.api.latency = Date.now() - startTime;

    const metrics = metricsInstance.getMetrics();
    const overallStatus =
      checks.database.status === 'ok' && checks.api.status === 'ok' ? 'ok' : 'degraded';

    const healthData = {
      status: overallStatus,
      checks,
      metrics: {
        totalRequests: metrics.totalRequests,
        errorRate: `${metrics.errorRate}%`,
        avgResponseTime: `${metrics.avgResponseTime}ms`,
        uptime: `${Math.floor(metrics.uptime / 60)} minutes`,
      },
      timestamp: new Date().toISOString(),
    };

    logInfo('Health check performed', {
      status: overallStatus,
      dbLatency: checks.database.latency,
      memory: `${checks.memory.usage}%`,
    });

    res.status(overallStatus === 'ok' ? 200 : 503).json({
      success: overallStatus === 'ok',
      data: healthData,
    });
  } catch (error) {
    logError('Health check failed', error);

    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
};

export const getAlertsEndpoint = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const type = req.query.type || null;

    const alerts = alertService.getAlerts(limit, type);
    const summary = alertService.getAlertSummary();

    res.json({
      success: true,
      data: {
        alerts,
        summary,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logError('Get alerts failed', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts',
    });
  }
};

export const getMetricsEndpoint = (req, res) => {
  try {
    const metrics = metricsInstance.getMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logError('Get metrics failed', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics',
    });
  }
};

export const clearAlerts = (req, res) => {
  try {
    const hoursOld = parseInt(req.query.hoursOld) || 24;
    alertService.clearAlerts(hoursOld);

    res.json({
      success: true,
      message: `Cleared alerts older than ${hoursOld} hours`,
    });
  } catch (error) {
    logError('Clear alerts failed', error);

    res.status(500).json({
      success: false,
      message: 'Failed to clear alerts',
    });
  }
};

router.get('/health', getHealth);
router.get('/metrics', getMetricsEndpoint);
router.get('/alerts', getAlertsEndpoint);
router.delete('/alerts', clearAlerts);

export default router;
