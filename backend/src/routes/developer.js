import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireDeveloperAccess } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import {
  createBroadcastSchema,
  createRestaurantSchema,
  createDeveloperUserSchema,
  resetDeveloperUserPasswordSchema,
  updateFeatureFlagSchema,
  updateMaintenanceSchema,
  updateRestaurantAccessSchema,
  updateSystemSettingsSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../schemas/developer.schema.js';
import * as developerController from '../controllers/developerController.js';

const router = express.Router();
router.use(authMiddleware, requireDeveloperAccess());

router.get('/dashboard', developerController.getDashboard);
router.get('/control-center/overview', developerController.getControlCenterOverview);
router.get('/control-center/live', developerController.getLiveMonitor);
router.get('/control-center/security', developerController.getSecurityOverview);
router.get('/control-center/errors', developerController.getErrorTracking);
router.get('/control-center/exports/:resource', developerController.exportData);

router.post('/users', validateRequest(createDeveloperUserSchema), developerController.createDeveloperUser);
router.get('/users', developerController.getUsers);
router.patch('/users/:userId/status', validateRequest(updateUserStatusSchema), developerController.updateUserStatus);
router.patch('/users/:userId/role', validateRequest(updateUserRoleSchema), developerController.updateUserRole);
router.post('/users/:userId/reset-password', validateRequest(resetDeveloperUserPasswordSchema), developerController.resetUserPassword);
router.post('/users/:userId/force-logout', developerController.forceLogoutUser);
router.get('/users/:userId/login-history', developerController.getUserLoginHistory);

router.post('/restaurants', validateRequest(createRestaurantSchema), developerController.createRestaurant);
router.get('/restaurants', developerController.getRestaurants);
router.patch('/restaurants/:restaurantId/access', validateRequest(updateRestaurantAccessSchema), developerController.updateRestaurantAccess);
router.post('/restaurants/:restaurantId/force-logout', developerController.forceLogoutRestaurantUsers);

router.get('/settings', developerController.getSystemSettings);
router.put('/settings', validateRequest(updateSystemSettingsSchema), developerController.updateSystemSettings);
router.put('/settings/maintenance', validateRequest(updateMaintenanceSchema), developerController.updateMaintenance);
router.get('/feature-flags', developerController.getFeatureFlags);
router.put('/feature-flags', validateRequest(updateFeatureFlagSchema), developerController.updateFeatureFlag);
router.get('/audit-logs', developerController.getAuditLogs);
router.get('/health', developerController.getSystemHealth);
router.post('/broadcasts', validateRequest(createBroadcastSchema), developerController.createBroadcast);

export default router;

