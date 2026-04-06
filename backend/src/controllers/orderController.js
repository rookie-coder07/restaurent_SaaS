import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import OrderService from '../services/orderService.js';
import {
  attachRestaurantStream,
  detachRestaurantStream,
  writeSseEvent,
} from '../utils/realtimeEvents.js';

function getTableIdFromBody(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'tableId')) {
    return body.tableId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'table_id')) {
    return body.table_id;
  }

  return undefined;
}

function getOptionalNotes(body = {}) {
  return Object.prototype.hasOwnProperty.call(body, 'notes') ? body.notes : undefined;
}

function getOptionalTotalAmount(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'totalAmount')) {
    return Number(body.totalAmount);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'total')) {
    return Number(body.total);
  }

  return undefined;
}

function getOptionalPaymentMethod(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'paymentMethod')) {
    return body.paymentMethod;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'payment_method')) {
    return body.payment_method;
  }

  return undefined;
}

function getOptionalAmountReceived(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'amountReceived')) {
    return Number(body.amountReceived);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'amount_received')) {
    return Number(body.amount_received);
  }

  return undefined;
}

function getOptionalPaymentNote(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'paymentNote')) {
    return body.paymentNote;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'payment_note')) {
    return body.payment_note;
  }

  return undefined;
}

function getOptionalLoyaltyPhone(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'loyaltyPhone')) {
    return body.loyaltyPhone;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'loyalty_phone')) {
    return body.loyalty_phone;
  }

  return undefined;
}

function getOptionalRedeemPoints(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'redeemPoints')) {
    return Number(body.redeemPoints);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'redeem_points')) {
    return Number(body.redeem_points);
  }

  return undefined;
}

function getOptionalDiscountPercent(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'discountPercent')) {
    return Number(body.discountPercent);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'discount_percent')) {
    return Number(body.discount_percent);
  }

  return undefined;
}

function getOptionalChargeValue(body = {}, camelKey, snakeKey) {
  if (Object.prototype.hasOwnProperty.call(body, camelKey)) {
    return Number(body[camelKey]);
  }

  if (Object.prototype.hasOwnProperty.call(body, snakeKey)) {
    return Number(body[snakeKey]);
  }

  return undefined;
}

function getOptionalSource(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'source')) {
    return body.source;
  }

  return undefined;
}

function getOptionalPromisedAt(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'promisedAt')) {
    return body.promisedAt;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'promised_at')) {
    return body.promised_at;
  }

  return undefined;
}

function getOptionalPaymentState(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'paymentState')) {
    return body.paymentState;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'payment_state')) {
    return body.payment_state;
  }

  return undefined;
}

function getOptionalCustomerName(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'customerName')) {
    return body.customerName;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'customer_name')) {
    return body.customer_name;
  }

  return undefined;
}

function getOptionalCustomerPhone(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'customerPhone')) {
    return body.customerPhone;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'customer_phone')) {
    return body.customer_phone;
  }

  return undefined;
}

function getOptionalCustomerAddress(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'customerAddress')) {
    return body.customerAddress;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'customer_address')) {
    return body.customer_address;
  }

  return undefined;
}

function getOptionalChannelOrderId(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'channelOrderId')) {
    return body.channelOrderId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'channel_order_id')) {
    return body.channel_order_id;
  }

  return undefined;
}

function extractOnlineOrderFields(body = {}) {
  return {
    source: getOptionalSource(body),
    promisedAt: getOptionalPromisedAt(body),
    paymentState: getOptionalPaymentState(body),
    customerName: getOptionalCustomerName(body),
    customerPhone: getOptionalCustomerPhone(body),
    customerAddress: getOptionalCustomerAddress(body),
    channelOrderId: getOptionalChannelOrderId(body),
  };
}

export const createOrder = asyncHandler(async (req, res) => {
  const orderOrigin = req.orderOrigin || (req.user ? 'pos' : 'qr');
  const normalizedOrder = {
    tableId: getTableIdFromBody(req.body) ?? null,
    items: (req.body.items || []).map((item) => ({
      menuItemId: item.menuItemId || item.itemId || item.id,
      quantity: item.quantity || item.qty,
      unitPrice: item.unitPrice ?? item.price ?? 0,
      specialInstructions: item.specialInstructions || '',
      itemNote: item.itemNote || item.note || item.specialInstructions || '',
      modifiers: item.modifiers || [],
      name: item.name || '',
    })),
    totalAmount: getOptionalTotalAmount(req.body),
    orderType: req.body.orderType || req.body.order_type || 'dine-in',
    paymentMethod: getOptionalPaymentMethod(req.body),
    notes: getOptionalNotes(req.body) ?? '',
    requiresWaiterApproval: !req.user,
    origin: orderOrigin,
    online: extractOnlineOrderFields(req.body),
  };

  if (normalizedOrder.orderType === 'dine-in' && !normalizedOrder.tableId) {
    return sendError(res, 400, 'Table is required for dine-in orders');
  }

  const order = await OrderService.createOrder(
    req.restaurantId || req.user?.restaurantId,
    normalizedOrder,
    { actorRole: req.user?.role }
  );

  if (order?.reusedExistingBill) {
    return sendSuccess(
      res,
      200,
      order,
      'Table is currently in use. Opened the existing bill instead.'
    );
  }

  return sendSuccess(res, 201, order, 'Order created successfully');
});

export const getActiveOrderByTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const order = await OrderService.getActiveOrderByTable(req.restaurantId, tableId);

  return sendSuccess(
    res,
    200,
    order,
    order ? 'Active table order fetched successfully' : 'No active table order found'
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await OrderService.getOrderById(req.restaurantId, orderId);

  return sendSuccess(res, 200, order, 'Order fetched successfully');
});

export const getOrders = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    orderType: req.query.orderType || req.query.order_type,
    tableNumber: req.query.tableNumber ? String(req.query.tableNumber).trim() : undefined,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    limit: parseInt(req.query.limit) || 50,
    skip: parseInt(req.query.skip) || 0,
  };

  const result = await OrderService.getOrders(req.user.restaurantId, filters);

  return sendSuccess(res, 200, result, 'Orders fetched successfully');
});

export const getActiveOrders = asyncHandler(async (req, res) => {
  const orders = await OrderService.getActiveOrders(req.user.restaurantId);
  return sendSuccess(res, 200, orders, 'Active orders fetched successfully');
});

export const getOpenBills = asyncHandler(async (req, res) => {
  const orders = await OrderService.getOpenBills(req.user.restaurantId);
  return sendSuccess(res, 200, orders, 'Open bills fetched successfully');
});

export const cancelPendingBills = asyncHandler(async (req, res) => {
  const result = await OrderService.cancelPendingBills(req.user.restaurantId, req.body.reason);
  return sendSuccess(res, 200, result, 'Pending bills cancelled successfully');
});

export const softDeleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const deletedOrder = await OrderService.softDeleteOrder(req.user.restaurantId, orderId, req.body.reason, {
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
    currentPassword: req.body.currentPassword || req.body.current_password || '',
  });

  return sendSuccess(res, 200, deletedOrder, 'Order deleted safely');
});

export const approveDiscount = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await OrderService.approveDiscount(req.user.restaurantId, orderId, {
    percent: Number(req.body.percent),
    note: req.body.note || '',
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
  });

  return sendSuccess(res, 200, order, 'Discount approved successfully');
});

export const streamEvents = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const client = {
    id: `${req.user.userId}:${Date.now()}`,
    res,
  };

  attachRestaurantStream(req.user.restaurantId, client);
  writeSseEvent(res, 'connected', {
    message: 'Realtime notifications connected',
    restaurantId: req.user.restaurantId,
    userId: req.user.userId,
  });

  const heartbeat = setInterval(() => {
    writeSseEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    detachRestaurantStream(req.user.restaurantId, client);
    res.end();
  });
};

export const updateOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const normalizedOrder = {
    tableId: getTableIdFromBody(req.body),
    items: (req.body.items || []).map((item) => ({
      menuItemId: item.menuItemId || item.itemId || item.id,
      quantity: item.quantity || item.qty,
      unitPrice: item.unitPrice ?? item.price ?? 0,
      specialInstructions: item.specialInstructions || '',
      itemNote: item.itemNote || item.note || item.specialInstructions || '',
      modifiers: item.modifiers || [],
      name: item.name || '',
    })),
    totalAmount: getOptionalTotalAmount(req.body),
    orderType: req.body.orderType || req.body.order_type || undefined,
    paymentMethod: getOptionalPaymentMethod(req.body),
    notes: getOptionalNotes(req.body),
    online: extractOnlineOrderFields(req.body),
  };

  if (normalizedOrder.orderType === 'dine-in' && normalizedOrder.tableId === null) {
    return sendError(res, 400, 'Table is required for dine-in orders');
  }

  const order = await OrderService.updateOrder(req.restaurantId, orderId, normalizedOrder, {
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
  });
  return sendSuccess(res, 200, order, 'Order updated successfully');
});

export const sendOrderToKitchen = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const result = await OrderService.sendOrderToKitchen(req.restaurantId, orderId);
  return sendSuccess(res, 200, result, 'Order sent to kitchen successfully');
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, cancelReason } = req.body;

  const order = await OrderService.updateOrderStatus(
    req.restaurantId,
    orderId,
    status,
    cancelReason
  );

  return sendSuccess(res, 200, order, 'Order status updated successfully');
});

export const settleOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const settlement = await OrderService.settleOrder(req.restaurantId, orderId, {
    method: getOptionalPaymentMethod(req.body),
    amountReceived: getOptionalAmountReceived(req.body),
    discountPercent: getOptionalDiscountPercent(req.body),
    paymentNote: getOptionalPaymentNote(req.body) ?? '',
    loyaltyPhone: getOptionalLoyaltyPhone(req.body) ?? '',
    redeemPoints: getOptionalRedeemPoints(req.body),
    packingCharge: getOptionalChargeValue(req.body, 'packingCharge', 'packing_charge'),
    serviceCharge: getOptionalChargeValue(req.body, 'serviceCharge', 'service_charge'),
    deliveryCharge: getOptionalChargeValue(req.body, 'deliveryCharge', 'delivery_charge'),
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
  });

  return sendSuccess(res, 200, settlement, 'Order settled successfully');
});

export const getLoyaltyProfile = asyncHandler(async (req, res) => {
  const profile = await OrderService.getLoyaltyProfile(req.restaurantId, req.query.phone || req.query.customerPhone || '');
  return sendSuccess(res, 200, profile, 'Loyalty profile fetched successfully');
});

export const getOnlineOrderInbox = asyncHandler(async (req, res) => {
  const orders = await OrderService.getOnlineOrderInbox(req.restaurantId, {
    status: req.query.status,
    source: req.query.source,
  });

  return sendSuccess(res, 200, orders, 'Online order inbox fetched successfully');
});

export const updateOnlineOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const onlineOrder = await OrderService.updateOnlineOrder(req.restaurantId, orderId, {
    workflowStatus: req.body.workflowStatus || req.body.workflow_status,
    ...extractOnlineOrderFields(req.body),
  });

  return sendSuccess(res, 200, onlineOrder, 'Online order updated successfully');
});

export const getDailyRevenue = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return sendError(res, 400, 'Date is required in query parameters');
  }

  const revenue = await OrderService.getDailyRevenue(req.user.restaurantId, date);

  return sendSuccess(res, 200, revenue, 'Daily revenue fetched successfully');
});

export const getMonthlyRevenue = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return sendError(res, 400, 'Start date and end date are required');
  }

  const revenue = await OrderService.getMonthlyRevenue(req.user.restaurantId, startDate, endDate);

  return sendSuccess(res, 200, revenue, 'Monthly revenue fetched successfully');
});

export const getMostSoldItems = asyncHandler(async (req, res) => {
  const { days } = req.query;

  const items = await OrderService.getMostSoldItems(req.user.restaurantId, parseInt(days) || 30);

  return sendSuccess(res, 200, items, 'Most sold items fetched successfully');
});
