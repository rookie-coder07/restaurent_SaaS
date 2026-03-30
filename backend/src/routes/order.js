import express from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { tenantIsolation, checkPermission } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import { orderLimiter } from '../middleware/rateLimit.js';
import {
  cancelPendingBillsSchema,
  createOrderSchema,
  settleOrderSchema,
  updateOnlineOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from '../schemas/order.schema.js';
import * as orderController from '../controllers/orderController.js';

const router = express.Router();

// Create order (POS/customer)
router.post('/', optionalAuth, orderLimiter, validateRequest(createOrderSchema), orderController.createOrder);

// All other routes protected
router.use(authMiddleware, tenantIsolation);

// Retrieve orders
router.get('/table/:tableId/active', checkPermission(['view_orders', 'manage_orders']), orderController.getActiveOrderByTable);
router.get('/active', checkPermission(['view_orders', 'update_order_status']), orderController.getActiveOrders);
router.get('/open', checkPermission(['manage_orders', 'view_orders']), orderController.getOpenBills);
router.get('/inbox/online', checkPermission(['manage_orders', 'view_orders']), orderController.getOnlineOrderInbox);
router.post('/cancel-pending', checkPermission(['manage_orders']), validateRequest(cancelPendingBillsSchema), orderController.cancelPendingBills);
router.post('/:orderId/send-to-kitchen', checkPermission(['manage_orders']), orderController.sendOrderToKitchen);
router.get('/', checkPermission(['manage_orders', 'view_orders']), orderController.getOrders);
router.get('/:orderId', orderController.getOrderById);
router.put('/:orderId', checkPermission(['manage_orders']), validateRequest(updateOrderSchema), orderController.updateOrder);
router.patch('/:orderId/online', checkPermission(['manage_orders', 'update_order_status']), validateRequest(updateOnlineOrderSchema), orderController.updateOnlineOrder);
router.post('/:orderId/settle', checkPermission(['manage_orders']), validateRequest(settleOrderSchema), orderController.settleOrder);

// Update order status
router.put('/:orderId/status', checkPermission(['manage_orders', 'update_order_status']), validateRequest(updateOrderStatusSchema), orderController.updateOrderStatus);
router.patch('/:orderId/status', checkPermission(['update_order_status', 'manage_orders']), validateRequest(updateOrderStatusSchema), orderController.updateOrderStatus);

// Revenue and analytics
router.get('/analytics/daily', checkPermission(['view_analytics']), orderController.getDailyRevenue);
router.get('/analytics/monthly', checkPermission(['view_analytics']), orderController.getMonthlyRevenue);
router.get('/analytics/top-items', checkPermission(['view_analytics']), orderController.getMostSoldItems);

export default router;
