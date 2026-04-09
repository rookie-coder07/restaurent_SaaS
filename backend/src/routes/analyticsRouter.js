const express = require('express');
const { verifyAuth } = require('../middleware/auth');
const AnalyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to authenticate and extract restaurant_id
router.use(verifyAuth);

/**
 * GET /api/analytics/dashboard
 * PowerBI-level dashboard data with KPIs, trends, and insights
 * Query params: startDate, endDate, period (today/week/month)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'today', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    // Determine date range
    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }

    logger.info(`[Analytics] Dashboard request - Restaurant: ${restaurantId}, Period: ${period}`);

    const dashboardData = await AnalyticsService.getPowerBIDashboard(restaurantId, {
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: dashboardData,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Analytics Dashboard] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/kpi
 * KPI metrics only
 */
router.get('/kpi', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'today', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }

    const kpiData = await AnalyticsService.getKPIMetrics(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data: kpiData,
    });
  } catch (error) {
    logger.error('[Analytics KPI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/revenue-trend
 * Revenue trend over time
 * Query params: period (today/week/month)
 */
router.get('/revenue-trend', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'week', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
      }
    }

    const trendData = await AnalyticsService.getRevenueTrend(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data: trendData,
    });
  } catch (error) {
    logger.error('[Analytics Revenue Trend] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/orders-vs-revenue
 * Orders and revenue by day
 */
router.get('/orders-vs-revenue', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'week', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
      }
    }

    const data = await AnalyticsService.getOrdersVsRevenue(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('[Analytics Orders vs Revenue] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/category-performance
 * Revenue by category
 */
router.get('/category-performance', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'month', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
      }
    }

    const data = await AnalyticsService.getCategoryPerformance(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('[Analytics Category Performance] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/top-items
 * Top selling items
 * Query params: limit (default 10), period (today/week/month)
 */
router.get('/top-items', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { limit = 10, period = 'month', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
      }
    }

    const data = await AnalyticsService.getTopItems(restaurantId, startDate, endDate, parseInt(limit));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('[Analytics Top Items] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/payment-methods
 * Revenue by payment method
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'month', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
      }
    }

    const data = await AnalyticsService.getPaymentMethods(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('[Analytics Payment Methods] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/analytics/hourly-data
 * Orders by hour (for heatmap)
 */
router.get('/hourly-data', async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { period = 'today', startDate: customStart, endDate: customEnd } = req.query;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID required' });
    }

    let startDate, endDate;
    const now = new Date();

    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
    } else {
      endDate = new Date(now);
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }

    const data = await AnalyticsService.getHourlyData(restaurantId, startDate, endDate);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('[Analytics Hourly Data] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
