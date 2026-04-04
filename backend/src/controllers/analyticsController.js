import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import AnalyticsService from '../services/analyticsService.js';

export const getDailySalesReport = asyncHandler(async (req, res) => {
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
