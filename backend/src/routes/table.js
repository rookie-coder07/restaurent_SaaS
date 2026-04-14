import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import {
  createTableSchema,
  batchCreateTablesSchema,
  reserveTableSchema,
} from '../schemas/order.schema.js';
import * as tableController from '../controllers/tableController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Create table
router.post('/', checkPermission(['manage_menu']), validateRequest(createTableSchema), tableController.createTable);
router.post('/batch', checkPermission(['manage_menu']), validateRequest(batchCreateTablesSchema), tableController.createMultipleTables);

// Get tables
router.get('/', checkPermission(['manage_tables', 'manage_menu', 'view_orders']), tableController.getTables);

// Update/delete table
router.put('/:tableId', checkPermission(['manage_tables', 'manage_menu']), tableController.updateTable);
router.delete('/:tableId', checkPermission(['manage_menu']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await tableController.deleteTable(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'table_deletion',
        {
          tableId: req.params.tableId,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/:tableId/reserve', checkPermission(['manage_tables', 'manage_menu', 'manage_orders']), validateRequest(reserveTableSchema), tableController.reserveTable);
router.post('/:tableId/release', checkPermission(['manage_tables', 'manage_menu', 'manage_orders']), tableController.releaseTable);
router.post('/:tableId/claim', checkPermission(['manage_orders']), tableController.claimTable);

// Generate QR URLs
router.post('/qr/generate', checkPermission(['manage_menu']), tableController.generateQRUrls);

// ✅ CLEANUP: Fix stale tables marked as occupied with no active orders
router.post('/admin/cleanup-stale', checkPermission(['view_orders', 'manage_tables']), async (req, res, next) => {
  try {
    const result = await tableController.cleanupStaleTables(req, res, next);
    return result;
  } catch (error) {
    next(error);
  }
});

export default router;
