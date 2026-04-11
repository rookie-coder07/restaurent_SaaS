import express from 'express';
import { authMiddleware, optionalAuth, streamAuthMiddleware } from '../middleware/auth.js';
import { tenantIsolation, checkPermission, requireBillingRole, requireOwnerRole } from '../middleware/tenantIsolation.js';
import { validateRequest } from '../middleware/validation.js';
import { orderLimiter } from '../middleware/rateLimit.js';
import {
  approveDiscountSchema,
  cancelPendingBillsSchema,
  createOrderSchema,
  softDeleteOrderSchema,
  settleOrderSchema,
  markOrderPaidSchema,
  updateOnlineOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from '../schemas/order.schema.js';
import * as orderController from '../controllers/orderController.js';
import SecurityAuditLogger from '../utils/securityAudit.js';

const router = express.Router();

// Create order (POS/customer)
router.post('/', optionalAuth, (req, res, next) => {
  // ✅ Apply tenantIsolation for authenticated users
  if (req.user) {
    return tenantIsolation(req, res, next);
  }
  next();
}, orderLimiter, validateRequest(createOrderSchema), orderController.createOrder);

// SSE stream for real-time events (MUST be before router.use to support query param auth)
router.get('/events/stream', streamAuthMiddleware, tenantIsolation, checkPermission(['manage_orders', 'view_orders']), orderController.streamEvents);

// All other routes protected
router.use(authMiddleware, tenantIsolation);

// Retrieve orders
router.get('/table/:tableId/active', checkPermission(['view_orders', 'manage_orders']), orderController.getActiveOrderByTable);
router.get('/active', checkPermission(['view_orders', 'update_order_status']), orderController.getActiveOrders);
router.get('/open', checkPermission(['manage_orders', 'view_orders']), orderController.getOpenBills);
router.get('/inbox/online', checkPermission(['manage_orders', 'view_orders']), orderController.getOnlineOrderInbox);
router.get('/loyalty/profile', checkPermission(['manage_orders', 'view_orders']), orderController.getLoyaltyProfile);
router.post('/cancel-pending', checkPermission(['manage_orders']), validateRequest(cancelPendingBillsSchema), orderController.cancelPendingBills);
router.post('/:orderId/delete', requireOwnerRole(), validateRequest(softDeleteOrderSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await orderController.softDeleteOrder(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'order_deletion',
        {
          orderId: req.params.orderId,
          reason: req.body.reason,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/:orderId/discount-approval', requireBillingRole(), checkPermission(['manage_orders']), validateRequest(approveDiscountSchema), async (req, res, next) => {
  try {
    // ✅ Additional validation for discount amount
    if (req.body.discountAmount && (req.body.discountAmount < 0 || req.body.discountAmount > 100)) {
      SecurityAuditLogger.logSuspiciousActivity(
        req.user?.id || 'unknown',
        'invalid_discount_attempt',
        {
          discountAmount: req.body.discountAmount,
          orderId: req.params.orderId
        },
        req.ip
      );
      return res.status(400).json({
        success: false,
        message: 'Invalid discount amount'
      });
    }

    // ✅ Call controller
    await orderController.approveDiscount(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'discount_approved',
        {
          orderId: req.params.orderId,
          discountAmount: req.body.discountAmount,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/:orderId/send-to-kitchen', checkPermission(['manage_orders']), orderController.sendOrderToKitchen);
router.get('/', checkPermission(['manage_orders', 'view_orders']), orderController.getOrders);
router.get('/:orderId', checkPermission(['manage_orders', 'view_orders']), orderController.getOrderById);
router.put('/:orderId', checkPermission(['manage_orders']), validateRequest(updateOrderSchema), orderController.updateOrder);
router.patch('/:orderId/online', checkPermission(['manage_orders', 'update_order_status']), validateRequest(updateOnlineOrderSchema), orderController.updateOnlineOrder);
router.post('/:orderId/settle', requireBillingRole(), checkPermission(['manage_orders']), validateRequest(settleOrderSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await orderController.settleOrder(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'order_settlement',
        {
          orderId: req.params.orderId,
          amount: req.body.amount || req.body.totalAmount,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});
router.post('/:orderId/mark-paid', requireBillingRole(), checkPermission(['manage_orders']), validateRequest(markOrderPaidSchema), async (req, res, next) => {
  try {
    // ✅ Call controller
    await orderController.markOrderPaid(req, res, next);
    
    // ✅ Log critical operation if successful
    if (res.statusCode === 200 || res.statusCode === 201) {
      SecurityAuditLogger.logCriticalOperation(
        req.user?.id || 'unknown',
        'order_marked_paid',
        {
          orderId: req.params.orderId,
          amount: req.body.amount,
          restaurantId: req.restaurantId
        },
        req.ip
      );
    }
  } catch (error) {
    next(error);
  }
});

// Update order status
router.put('/:orderId/status', checkPermission(['manage_orders', 'update_order_status']), validateRequest(updateOrderStatusSchema), orderController.updateOrderStatus);
router.patch('/:orderId/status', checkPermission(['update_order_status', 'manage_orders']), validateRequest(updateOrderStatusSchema), orderController.updateOrderStatus);

// Revenue and analytics
router.get('/analytics/daily', checkPermission(['view_analytics']), orderController.getDailyRevenue);
router.get('/analytics/monthly', checkPermission(['view_analytics']), orderController.getMonthlyRevenue);
router.get('/analytics/top-items', checkPermission(['view_analytics']), orderController.getMostSoldItems);

export default router;
