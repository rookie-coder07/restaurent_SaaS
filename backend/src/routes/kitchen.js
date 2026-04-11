import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import { updateKitchenTicketStatusSchema } from '../schemas/order.schema.js';
import * as kitchenController from '../controllers/kitchenController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Get active orders for kitchen (5-second polling)
router.get('/orders', checkPermission(['view_orders', 'update_order_status']), kitchenController.getKitchenOrders);
router.get('/orders/all', checkPermission(['view_orders', 'update_order_status']), kitchenController.getKitchenAllOrders);
router.get('/orders/:orderId', checkPermission(['view_orders']), kitchenController.getOrderDetails);

// Kitchen ticket actions
router.put('/orders/:orderId/tickets/:ticketId/status', checkPermission(['update_order_status']), validateRequest(updateKitchenTicketStatusSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await kitchenController.updateKitchenTicketStatus(req, res, next);
    
    // ✅ Log operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logDataAccess(
        req.user?.id || 'unknown',
        'kitchen_ticket',
        'status_update',
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/orders/:orderId/tickets/:ticketId/reprint', checkPermission(['update_order_status']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await kitchenController.reprintKitchenTicket(req, res, next);
    
    // ✅ Log operation
    SecurityAuditLogger.logDataAccess(
      req.user?.id || 'unknown',
      'kitchen_ticket',
      'reprint',
      req.ip
    );
    next();
  } catch (error) {
    next(error);
  }
});
router.post('/orders/:orderId/tickets/:ticketId/refire', checkPermission(['update_order_status']), async (req, res, next) => {
  try {
    // ✅ Call controller
    await kitchenController.refireKitchenTicket(req, res, next);
    
    // ✅ Log operation
    SecurityAuditLogger.logDataAccess(
      req.user?.id || 'unknown',
      'kitchen_ticket',
      'refire',
      req.ip
    );
    next();
  } catch (error) {
    next(error);
  }
});

export default router;
