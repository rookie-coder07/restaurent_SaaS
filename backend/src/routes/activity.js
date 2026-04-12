import express from 'express';
import { getActivityLogs, getRestaurantActivityLogs, getActivityStats } from '../controllers/activityController.js';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation } from '../middleware/tenantIsolation.js';

const router = express.Router();

// All activity routes require authentication and tenant isolation
router.use(authMiddleware, tenantIsolation);

// Get all activity logs for the restaurant (must come before /:userId/logs)
router.get('/logs/all', getRestaurantActivityLogs);

// Get activity statistics (must come before /:userId/logs)
router.get('/stats/overview', getActivityStats);

// Get activity logs for a specific user
router.get('/:userId/logs', getActivityLogs);

export default router;
