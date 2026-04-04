import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission, requireRole } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  createCategorySchema,
  updateCategorySchema,
  toggleAvailabilitySchema,
} from '../schemas/menu.schema.js';
import * as menuController from '../controllers/menuController.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Category routes
router.post('/categories', requireRole(['owner']), checkPermission(['create_menu']), validateRequest(createCategorySchema), menuController.createCategory);
router.get('/categories', checkPermission(['view_orders', 'manage_menu']), menuController.getCategories);
router.put('/categories/:categoryId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateCategorySchema), menuController.updateCategory);
router.delete('/categories/:categoryId', requireRole(['owner']), checkPermission(['manage_menu']), menuController.deleteCategory);

// Menu item routes
router.post('/items', requireRole(['owner']), checkPermission(['create_menu']), validateRequest(createMenuItemSchema), menuController.createMenuItem);
router.get('/items', checkPermission(['view_orders', 'manage_menu']), menuController.getMenuItems);
router.get('/items/:itemId', checkPermission(['view_orders', 'manage_menu']), menuController.getMenuItemById);
router.put('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateMenuItemSchema), menuController.updateMenuItem);
router.delete('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), menuController.deleteMenuItem);
router.patch('/items/:itemId/availability', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(toggleAvailabilitySchema), menuController.toggleItemAvailability);

export default router;
