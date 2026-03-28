import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import { updateKitchenTicketStatusSchema } from '../schemas/order.schema.js';
import * as kitchenController from '../controllers/kitchenController.js';

const router = express.Router();

// All routes protected
router.use(authMiddleware, tenantIsolation);

// Get active orders for kitchen (5-second polling)
router.get('/orders', checkPermission(['view_orders', 'update_order_status']), kitchenController.getKitchenOrders);
router.get('/orders/all', checkPermission(['view_orders', 'update_order_status']), kitchenController.getKitchenAllOrders);
router.get('/orders/:orderId', checkPermission(['view_orders']), kitchenController.getOrderDetails);

// Kitchen ticket actions
router.put('/orders/:orderId/tickets/:ticketId/status', checkPermission(['update_order_status']), validateRequest(updateKitchenTicketStatusSchema), kitchenController.updateKitchenTicketStatus);
router.post('/orders/:orderId/tickets/:ticketId/reprint', checkPermission(['update_order_status']), kitchenController.reprintKitchenTicket);
router.post('/orders/:orderId/tickets/:ticketId/refire', checkPermission(['update_order_status']), kitchenController.refireKitchenTicket);

export default router;
