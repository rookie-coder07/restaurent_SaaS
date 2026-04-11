import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { requireRole } from '../middleware/securityEnforcement.js';
import { validateRequest } from '../middleware/validation.js';
import {
  updateInvoiceSettingsSchema,
  updateRestaurantSchema,
  updateRestaurantSettingsSchema,
} from '../schemas/restaurant.schema.js';
import { createStaffSchema, updateStaffSchema } from '../schemas/auth.schema.js';
import * as restaurantController from '../controllers/restaurantController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Profile routes
router.get('/profile', restaurantController.getProfile);
router.get('/broadcasts', requireFeatureFlag('notifications', 'Notifications are currently disabled by the platform administrator.'), restaurantController.getBroadcastNotifications);
router.put('/profile', checkPermission(['manage_restaurant']), validateRequest(updateRestaurantSchema), restaurantController.updateProfile);
router.put('/settings', checkPermission(['manage_restaurant']), validateRequest(updateRestaurantSettingsSchema), restaurantController.updateSettings);
router.put(
  '/settings/invoice',
  checkPermission(['manage_restaurant']),
  validateRequest(updateInvoiceSettingsSchema),
  restaurantController.updateInvoiceSettings
);

// Staff management (owner only)
router.post('/staff', requireRole(['admin', 'manager']), checkPermission(['manage_staff']), validateRequest(createStaffSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await restaurantController.createStaff(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'staff_created',
        {
          email: req.body.email,
          role: req.body.role,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.get('/staff', requireRole(['admin', 'manager']), checkPermission(['manage_staff', 'view_staff']), restaurantController.getStaffUsers);
router.put('/staff/:staffId', requireRole(['admin', 'manager']), validateRequest(updateStaffSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await restaurantController.updateStaff(req, res, next);
    
    // ✅ Log operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logDataAccess(
        req.user?.id || 'unknown',
        'staff',
        'update',
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.put('/staff/:staffId/reset-password', checkPermission(['manage_staff']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await restaurantController.resetStaffPassword(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'staff_password_reset',
        {
          staffId: req.params.staffId,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.delete('/staff/:staffId', checkPermission(['manage_staff']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await restaurantController.deactivateStaff(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'staff_deactivated',
        {
          staffId: req.params.staffId,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

// Subscription
router.put('/subscription', checkPermission(['manage_restaurant']), restaurantController.updateSubscription);

export default router;
