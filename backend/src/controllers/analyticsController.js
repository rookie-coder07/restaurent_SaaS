import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AnalyticsService from '../services/analyticsService.js';

export const getDailySalesReport = asyncHandler(async (req, res) => {
  logger.info('API HIT: GET /analytics/daily - Restaurant: ${req.restaurantId}, Date: ${req.query.date}');
  const { date } = req.query;

  const report = await AnalyticsService.getDailySalesReport(req.restaurantId, date || new Date());

  return sendSuccess(res, 200, report, 'Daily sales report fetched successfully');
});

export const getMonthlySalesReport = asyncHandler(async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({
      statusCode: 400,
      message: 'Year and month are required',
      success: false,
    });
  }

  const report = await AnalyticsService.getMonthlySalesReport(
    req.user.restaurantId,
    parseInt(year),
    parseInt(month)
  );

  return sendSuccess(res, 200, report, 'Monthly sales report fetched successfully');
});

export const getTopItems = asyncHandler(async (req, res) => {
  logger.info('API HIT: GET /analytics/top-items - Restaurant: ${req.user.restaurantId}, Days: ${req.query.days || 30}');
  const { days } = req.query;

  const items = await AnalyticsService.getTopItems(req.user.restaurantId, parseInt(days) || 30);

  return sendSuccess(res, 200, items, 'Top items fetched successfully');
});

export const getLatestEodSummary = asyncHandler(async (req, res) => {
  const ensure = String(req.query.ensure || '').toLowerCase() === 'true';
  const summary = await AnalyticsService.getLatestEodSummary(req.user.restaurantId, { ensure });

  return sendSuccess(res, 200, summary, 'Latest EOD summary fetched successfully');
});

export const getEodSummaryHistory = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 7;
  const history = await AnalyticsService.getEodSummaryHistory(req.user.restaurantId, limit);

  return sendSuccess(res, 200, { history, total: history.length }, 'EOD summary history fetched successfully');
});

export const getLoyaltySummary = asyncHandler(async (req, res) => {
  const summary = await AnalyticsService.getLoyaltySummary(req.user.restaurantId);
  return sendSuccess(res, 200, summary, 'Loyalty summary fetched successfully');
});

// PowerBI Dashboard Controllers
export const getPowerBIDashboard = asyncHandler(async (req, res) => {
  const { period = 'today', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  const dashboardData = await AnalyticsService.getPowerBIDashboard(req.user.restaurantId, {
    startDate: start,
    endDate: end,
  });

  return sendSuccess(res, 200, dashboardData, 'Dashboard data fetched successfully');
});

export const getKPI = asyncHandler(async (req, res) => {
  const { period = 'today', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  const kpiData = await AnalyticsService.getKPIMetrics(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, kpiData, 'KPI metrics fetched successfully');
});

export const getRevenueTrend = asyncHandler(async (req, res) => {
  const { period = 'week', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
    }
  }

  const trendData = await AnalyticsService.getRevenueTrend(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, trendData, 'Revenue trend fetched successfully');
});

export const getOrdersVsRevenue = asyncHandler(async (req, res) => {
  const { period = 'week', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
    }
  }

  const data = await AnalyticsService.getOrdersVsRevenue(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, data, 'Orders vs revenue data fetched successfully');
});

export const getCategoryPerformance = asyncHandler(async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
    }
  }

  const data = await AnalyticsService.getCategoryPerformance(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, data, 'Category performance data fetched successfully');
});

export const getTopItemsList = asyncHandler(async (req, res) => {
  const { limit = 10, period = 'month', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
    }
  }

  const data = await AnalyticsService.getTopItems(
    req.user.restaurantId,
    start,
    end,
    parseInt(limit, 10) || 10
  );

  return sendSuccess(res, 200, data, 'Top items fetched successfully');
});

export const getPaymentMethods = asyncHandler(async (req, res) => {
  const { period = 'month', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
    }
  }

  const data = await AnalyticsService.getPaymentMethods(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, data, 'Payment methods data fetched successfully');
});

export const getHourlyData = asyncHandler(async (req, res) => {
  const { period = 'today', startDate, endDate } = req.query;

  let start, end;
  const now = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    end = new Date(now);
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  const data = await AnalyticsService.getHourlyData(req.user.restaurantId, start, end);

  return sendSuccess(res, 200, data, 'Hourly data fetched successfully');
});
