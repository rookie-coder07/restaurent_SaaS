import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateQuery } from '../middleware/validation.js';
import { analyticsQuerySchema } from '../schemas/restaurant.schema.js';
import * as analyticsController from '../controllers/analyticsController.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);
router.use(requireFeatureFlag('analytics', 'Analytics is currently disabled by the platform administrator.'));

// Reports
router.get('/daily-sales', checkPermission(['view_analytics']), analyticsController.getDailySalesReport);
router.get('/monthly-sales', checkPermission(['view_analytics']), analyticsController.getMonthlySalesReport);
router.get('/top-items', checkPermission(['view_analytics']), analyticsController.getTopItems);
router.get('/eod/latest', checkPermission(['view_analytics']), analyticsController.getLatestEodSummary);
router.get('/eod/history', checkPermission(['view_analytics']), analyticsController.getEodSummaryHistory);
router.get('/loyalty', checkPermission(['view_analytics']), analyticsController.getLoyaltySummary);

// PowerBI Dashboard endpoints
router.get('/dashboard', checkPermission(['view_analytics']), analyticsController.getPowerBIDashboard);
router.get('/kpi', checkPermission(['view_analytics']), analyticsController.getKPI);
router.get('/revenue-trend', checkPermission(['view_analytics']), analyticsController.getRevenueTrend);
router.get('/orders-vs-revenue', checkPermission(['view_analytics']), analyticsController.getOrdersVsRevenue);
router.get('/category-performance', checkPermission(['view_analytics']), analyticsController.getCategoryPerformance);
router.get('/items', checkPermission(['view_analytics']), analyticsController.getTopItemsList);
router.get('/payment-methods', checkPermission(['view_analytics']), analyticsController.getPaymentMethods);
router.get('/hourly-data', checkPermission(['view_analytics']), analyticsController.getHourlyData);

export default router;
