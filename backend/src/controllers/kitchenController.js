import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import OrderService from '../services/orderService.js';
import { logError, logFailedRequest, logCriticalAction } from '../utils/structuredLogging.js';

// Kitchen dashboard - get active orders
export const getKitchenOrders = asyncHandler(async (req, res) => {
  try {
    logger.info(`API HIT: GET /kitchen/orders - Restaurant: ${req.restaurantId}`);
    // Include ready orders so the kitchen can complete the full workflow.
    const orders = await OrderService.getKitchenOrders(req.restaurantId, {
      statuses: ['pending', 'preparing', 'ready'],
    });

    return sendSuccess(res, 200, orders, 'Kitchen orders fetched successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to fetch kitchen orders',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'get_kitchen_orders',
    });
    throw error;
  }
});

// Get all orders for kitchen (with pagination)
export const getKitchenAllOrders = asyncHandler(async (req, res) => {
  logger.info('API HIT: GET /kitchen/all-orders - Restaurant: ${req.user.restaurantId}, Limit: ${req.query.limit || 50}');
  const filters = {
    status: req.query.status, // Can filter by specific status
    limit: parseInt(req.query.limit) || 50,
    skip: parseInt(req.query.skip) || 0,
  };

  const result = await OrderService.getOrders(req.user.restaurantId, filters);

  return sendSuccess(res, 200, result, 'Orders fetched successfully');
});

export const updateKitchenTicketStatus = asyncHandler(async (req, res) => {
  const { orderId, ticketId } = req.params;
  
  try {
    if (!orderId || !ticketId) {
      logFailedRequest(new Error('Missing ticket or order ID'), {
        message: 'Update ticket status validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'update_ticket_validation',
      });
      return sendError(res, 400, 'Order ID and Ticket ID are required');
    }

    if (!req.body.status) {
      return sendError(res, 400, 'Ticket status is required');
    }

    const result = await OrderService.updateKitchenTicketStatus(req.user.restaurantId, orderId, ticketId, req.body.status);
    
    logCriticalAction('kitchen_ticket_updated', {
      message: `Kitchen ticket status updated to ${req.body.status}`,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      orderId,
      details: { ticketId, newStatus: req.body.status },
    });

    return sendSuccess(res, 200, result, 'Kitchen ticket status updated successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to update kitchen ticket status',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      orderId,
      statusCode: 500,
      action: 'update_kitchen_ticket',
    });
    throw error;
  }
});

export const reprintKitchenTicket = asyncHandler(async (req, res) => {
  const { orderId, ticketId } = req.params;
  
  try {
    if (!orderId || !ticketId) {
      logFailedRequest(new Error('Missing IDs'), {
        message: 'Reprint ticket validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.user.restaurantId,
        statusCode: 400,
        action: 'reprint_ticket_validation',
      });
      return sendError(res, 400, 'Order ID and Ticket ID are required');
    }

    const result = await OrderService.reprintKitchenTicket(req.user.restaurantId, orderId, ticketId);
    
    logCriticalAction('kitchen_ticket_reprinted', {
      message: 'Kitchen ticket reprinted',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      orderId,
      details: { ticketId },
    });

    return sendSuccess(res, 200, result, 'Kitchen ticket reprinted successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to reprint kitchen ticket',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      orderId,
      statusCode: 500,
      action: 'reprint_kitchen_ticket',
    });
    throw error;
  }
});

export const refireKitchenTicket = asyncHandler(async (req, res) => {
  const { orderId, ticketId } = req.params;
  const result = await OrderService.refireKitchenTicket(req.user.restaurantId, orderId, ticketId);
  return sendSuccess(res, 200, result, 'Kitchen ticket re-fired successfully');
});

// Get single order details
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await OrderService.getOrderById(req.user.restaurantId, orderId);

  return sendSuccess(res, 200, order, 'Order details fetched successfully');
});
