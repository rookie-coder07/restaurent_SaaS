import logger from '../utils/logger.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import OrderService from '../services/orderService.js';

// Kitchen dashboard - get active orders
export const getKitchenOrders = asyncHandler(async (req, res) => {
  // Include ready orders so the kitchen can complete the full workflow.
  const orders = await OrderService.getKitchenOrders(req.restaurantId, {
    statuses: ['pending', 'preparing', 'ready'],
  });

  return sendSuccess(res, 200, orders, 'Kitchen orders fetched successfully');
});

// Get all orders for kitchen (with pagination)
export const getKitchenAllOrders = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status, // Can filter by specific status
    limit: parseInt(req.query.limit) || 50,
    skip: parseInt(req.query.skip) || 0,
  };

  const result = await OrderService.getOrders(req.user.restaurantId, filters);

  return sendSuccess(res, 200, result, 'Orders fetched successfully');
});

// Update order status from kitchen
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, cancelReason } = req.body;

  const order = await OrderService.updateOrderStatus(
    req.user.restaurantId,
    orderId,
    status,
    cancelReason
  );

  return sendSuccess(res, 200, order, 'Order status updated successfully');
});

// Get single order details
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await OrderService.getOrderById(req.user.restaurantId, orderId);

  return sendSuccess(res, 200, order, 'Order details fetched successfully');
});
