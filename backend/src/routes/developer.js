import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireDeveloperAccess } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import {
  createBroadcastSchema,
  resetDeveloperUserPasswordSchema,
  updateFeatureFlagSchema,
  updateMaintenanceSchema,
  updateRestaurantAccessSchema,
  updateUserStatusSchema,
} from '../schemas/developer.schema.js';
import * as developerController from '../controllers/developerController.js';

const router = express.Router();

router.use(authMiddleware, requireDeveloperAccess());

router.get('/dashboard', developerController.getDashboard);
router.get('/restaurants', developerController.getRestaurants);
router.patch('/restaurants/:restaurantId/access', validateRequest(updateRestaurantAccessSchema), developerController.updateRestaurantAccess);
router.get('/users', developerController.getUsers);
router.patch('/users/:userId/status', validateRequest(updateUserStatusSchema), developerController.updateUserStatus);
router.post('/users/:userId/reset-password', validateRequest(resetDeveloperUserPasswordSchema), developerController.resetUserPassword);
router.get('/settings', developerController.getSystemSettings);
router.put('/settings/maintenance', validateRequest(updateMaintenanceSchema), developerController.updateMaintenance);
router.put('/feature-flags', validateRequest(updateFeatureFlagSchema), developerController.updateFeatureFlag);
router.get('/audit-logs', developerController.getAuditLogs);
router.get('/health', developerController.getSystemHealth);
router.post('/broadcasts', validateRequest(createBroadcastSchema), developerController.createBroadcast);

export default router;
