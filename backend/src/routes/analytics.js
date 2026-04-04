import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateQuery } from '../middleware/validation.js';
import { analyticsQuerySchema } from '../schemas/restaurant.schema.js';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Reports
router.get('/daily-sales', checkPermission(['view_analytics']), analyticsController.getDailySalesReport);
router.get('/monthly-sales', checkPermission(['view_analytics']), analyticsController.getMonthlySalesReport);
router.get('/top-items', checkPermission(['view_analytics']), analyticsController.getTopItems);
router.get('/eod/latest', checkPermission(['view_analytics']), analyticsController.getLatestEodSummary);
router.get('/eod/history', checkPermission(['view_analytics']), analyticsController.getEodSummaryHistory);
router.get('/loyalty', checkPermission(['view_analytics']), analyticsController.getLoyaltySummary);

export default router;
