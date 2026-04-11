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
import SecurityAuditLogger from '../utils/securityAudit.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';

const router = express.Router();

router.use(authMiddleware, tenantIsolation);
router.use(requireFeatureFlag('inventory', 'Inventory is currently disabled by the platform administrator.'));

router.get('/summary', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventorySummary);
router.get('/history', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventoryHistory);
router.get('/items', checkPermission(['manage_menu', 'view_orders']), inventoryController.getInventoryItems);
router.post('/items', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(createInventoryItemSchema), inventoryController.createInventoryItem);
router.put('/items/:itemId', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(updateInventoryItemSchema), inventoryController.updateInventoryItem);
router.post('/items/:itemId/add-stock', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(addStockSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await inventoryController.addStock(req, res, next);
    
    // ✅ Log operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logDataAccess(
        req.user?.id || 'unknown',
        'inventory',
        'add_stock',
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/items/:itemId/adjust', requireRole(['owner']), checkPermission(['manage_menu']), validateRequest(adjustStockSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await inventoryController.adjustStock(req, res, next);
    
    // ✅ Log operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logDataAccess(
        req.user?.id || 'unknown',
        'inventory',
        'adjust_stock',
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

export default router;
