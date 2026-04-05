import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import { updateRestaurantSchema, updateRestaurantSettingsSchema } from '../schemas/restaurant.schema.js';
import { createStaffSchema, updateStaffSchema } from '../schemas/auth.schema.js';
import * as restaurantController from '../controllers/restaurantController.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Profile routes
router.get('/profile', restaurantController.getProfile);
router.put('/profile', checkPermission(['manage_restaurant']), validateRequest(updateRestaurantSchema), restaurantController.updateProfile);
router.put('/settings', checkPermission(['manage_restaurant']), validateRequest(updateRestaurantSettingsSchema), restaurantController.updateSettings);

// Staff management (owner only)
router.post('/staff', checkPermission(['manage_staff']), validateRequest(createStaffSchema), restaurantController.createStaff);
router.get('/staff', checkPermission(['manage_staff', 'view_staff']), restaurantController.getStaffUsers);
router.put('/staff/:staffId', checkPermission(['manage_staff']), validateRequest(updateStaffSchema), restaurantController.updateStaff);
router.delete('/staff/:staffId', checkPermission(['manage_staff']), restaurantController.deactivateStaff);

// Subscription
router.put('/subscription', checkPermission(['manage_restaurant']), restaurantController.updateSubscription);

export default router;
