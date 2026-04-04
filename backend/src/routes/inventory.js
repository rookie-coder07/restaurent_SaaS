import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission, requireRole } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import * as inventoryController from '../controllers/inventoryController.js';
import {
  addStockSchema,
  adjustStockSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from '../schemas/inventory.schema.js';

const router = express.Router();

router.use(authMiddleware, tenantIsolation);

router.get('/summary', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventorySummary);
router.get('/history', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventoryHistory);
router.get('/items', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventoryItems);
router.post('/items', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(createInventoryItemSchema), inventoryController.createInventoryItem);
router.put('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateInventoryItemSchema), inventoryController.updateInventoryItem);
router.post('/items/:itemId/add-stock', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(addStockSchema), inventoryController.addStock);
router.post('/items/:itemId/adjust', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(adjustStockSchema), inventoryController.adjustStock);

export default router;
