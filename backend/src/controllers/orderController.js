import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import OrderService from '../services/orderService.js';
import { ActivityService } from '../services/activityService.js';
import { AuthService } from '../services/authService.js';
import supabase from '../config/supabase.js';
import { safetyEngine } from '../utils/productionSafety.js';
import {
  attachRestaurantStream,
  detachRestaurantStream,
  writeSseEvent,
} from '../utils/realtimeEvents.js';
import { logOrderCreation, formatOrderResponse } from '../utils/orderDisplay.js';
import { logError, logFailedRequest, logCriticalAction, logSuccessfulOperation } from '../utils/structuredLogging.js';

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

function getOptionalRequestId(body = {}) {
  if (Object.prototype.hasOwnProperty.call(body, 'requestId')) {
    return body.requestId;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'request_id')) {
    return body.request_id;
  }

  return undefined;
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

async function upsertTableAssignment(restaurantId, tableId, waiterId) {
  const now = new Date().toISOString();

  await supabase
    .from('table_assignments')
    .update({ is_active: false, updated_at: now })
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId);

  const { error } = await supabase
    .from('table_assignments')
    .upsert(
      { restaurant_id: restaurantId, table_id: tableId, waiter_id: waiterId, is_active: true, updated_at: now },
      { onConflict: 'restaurant_id,table_id' }
    );

  if (error) {
    throw error;
  }
}

// ACCESS CHECK: Validate waiter has access to table using table_assignments as source of truth
// Options:
// - isManual: skip assignment checks for POS/manual flows
// - isReadOnly: skip "another waiter has it" check for read-only operations (fetching data)
async function validateTableAccess(restaurantId, tableId, currentUser = {}, { isManual = false, isReadOnly = false } = {}) {
  const currentWaiterId = currentUser.id || currentUser.userId;

  if (!tableId) {
    return;
  }

  if (isManual) {
    // Manual POS flow never blocked
    return;
  }

  if (['manager', 'admin'].includes(currentUser.role)) {
    return;
  }

  if (!currentWaiterId) {
    throw new Error('User must be authenticated');
  }

  // Check BOTH table_assignments (active sessions) AND users.assigned_tables (UI assignments)
  const currentWaiterStr = String(currentWaiterId || '').trim();

  // 1. Check for active table_assignments record
  const { data: activeAssignment, error: activeError } = await supabase
    .from('table_assignments')
    .select('waiter_id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  let assignmentError = activeError;

  if (assignmentError && String(assignmentError.message || '').includes('is_active')) {
    const { data: fallbackAssignment, error: fallbackError } = await supabase
      .from('table_assignments')
      .select('waiter_id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId)
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      assignmentError = fallbackError;
    }
  }

  if (assignmentError) {
    logger.warn('Table assignment lookup failed', {
      restaurantId,
      tableId,
      userId: currentWaiterId,
      error: assignmentError.message,
    });
    throw new Error('Unable to validate table assignment');
  }

  const assignedWaiterId = activeAssignment?.waiter_id;
  const assignedWaiterStr = String(assignedWaiterId || '').trim();

  // If table_assignments exists for this waiter, allow access
  if (assignedWaiterStr === currentWaiterStr) {
    return;
  }

  // If table_assignments exists for ANOTHER waiter, block access (unless read-only)
  if (assignedWaiterStr && assignedWaiterStr !== currentWaiterStr) {
    if (!isReadOnly) {
      throw new Error('This table is assigned to another waiter');
    }
    // For read-only operations, log but allow access to see the current state
    logger.info('Read-only access to table assigned to another waiter', {
      restaurantId,
      tableId,
      currentWaiterId,
      assignedWaiterId,
    });
    return;
  }

  // No table_assignments yet - check users.assigned_tables (UI assignments)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('assigned_tables')
    .eq('id', currentWaiterId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (!userError && user) {
    const assignedTables = Array.isArray(user.assigned_tables) ? user.assigned_tables : [];
    const tableIdStr = String(tableId).trim();
    const isAssignedToUser = assignedTables.some(tid => String(tid || '').trim() === tableIdStr);

    if (isAssignedToUser) {
      // Waiter is assigned via UI - create table_assignments entry for current session
      await upsertTableAssignment(restaurantId, tableId, currentWaiterId);
      return;
    }
  }

  // Not assigned anywhere - waiter can create order but mark as unassigned
  logger.info('Table access - creating new assignment', {
    restaurantId,
    tableId,
    userId: currentWaiterId,
  });
  await upsertTableAssignment(restaurantId, tableId, currentWaiterId);
}

export const createOrder = asyncHandler(async (req, res) => {
  try {
    console.log('📦 ORDER CREATION STARTED:', {
      orderOrigin: req.orderOrigin,
      hasUser: !!req.user,
      restaurantId: req.restaurantId,
      tableId: req.body.tableId,
      tableNumber: req.body.tableNumber,
      itemsCount: req.body.items?.length,
    });

    const orderOrigin = req.orderOrigin || (req.user ? 'pos' : 'qr');
    const normalizedOrder = {
      requestId: getOptionalRequestId(req.body),
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
      orderSource: orderOrigin === 'qr' ? 'qr' : 'manual',
      online: extractOnlineOrderFields(req.body),
    };

    console.log('✅ Order normalized:', {
      tableId: normalizedOrder.tableId,
      itemsCount: normalizedOrder.items.length,
      orderType: normalizedOrder.orderType,
    });

    if (normalizedOrder.orderType === 'dine-in' && !normalizedOrder.tableId) {
      logFailedRequest(new Error('Table is required for dine-in orders'), {
        message: 'Create order validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'create_order_validation',
      });
      return sendError(res, 400, 'Table is required for dine-in orders');
    }

    const restaurantId = req.restaurantId || req.user?.restaurantId;
    if (!restaurantId) {
      console.error('❌ Missing restaurantId in createOrder:', {
        'req.restaurantId': req.restaurantId,
        'req.user?.restaurantId': req.user?.restaurantId,
        'req.user': req.user,
      });
      logFailedRequest(new Error('Restaurant ID missing'), {
        message: 'Create order failed - no restaurant ID',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        statusCode: 401,
        action: 'create_order_auth',
      });
      return sendError(res, 401, 'Restaurant ID is required');
    }

    console.log('📊 Calling OrderService.createOrder with:', {
      restaurantId,
      itemsCount: normalizedOrder.items.length,
      tableId: normalizedOrder.tableId,
    });

    if (normalizedOrder.items.length === 0) {
      console.error('❌ Order has no items');
      return sendError(res, 400, 'Cannot create order: Cart is empty. Add at least one item.');
    }

    const order = await OrderService.createOrder(
      restaurantId,
      normalizedOrder,
      {
        userId: req.user?.id || req.user?.userId,
        actorRole: req.user?.role,
        actorName: req.user?.name || req.user?.email || 'System',
      }
    );

    console.log('✅ Order created successfully:', { orderId: order?.id });

    // Log activity
    setImmediate(() => {
      ActivityService.logActivity(
        restaurantId,
        req.user?.id || req.user?.userId || 'system',
        'order_created',
        {
          orderId: order?.id,
          itemCount: normalizedOrder.items.length,
          totalAmount: normalizedOrder.totalAmount,
          tableId: normalizedOrder.tableId,
          actorName: req.user?.name || req.user?.email || 'System',
          actorRole: req.user?.role,
        }
      ).catch(err => logger.error('Failed to log order creation activity:', err));
    });

    logCriticalAction('order_created', {
      message: 'New order created',
      userId: req.user?.id || req.user?.userId,
      restaurantId,
      orderId: order?.id,
      tableId: normalizedOrder.tableId,
      details: {
        itemCount: normalizedOrder.items.length,
        totalAmount: normalizedOrder.totalAmount,
        orderType: normalizedOrder.orderType,
      },
    });

    if (order?.reusedExistingBill) {
      return sendSuccess(
        res,
        200,
        order,
        'Table is currently in use. Opened the existing bill instead.'
      );
    }

    // Log order creation with friendly formatting
    // Temporarily disabled - causing TypeError with formatted strings and logger
    // logOrderCreation(order, normalizedOrder.items || [], logger);

    console.log('📤 Sending order response:', { orderId: order?.id, status: 201 });
    return sendSuccess(res, 201, formatOrderResponse(order), 'Order created successfully');
  } catch (error) {
    console.error('❌ CRITICAL ORDER CREATION ERROR:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
      stack: error.stack,
      restaurantId: req.restaurantId,
      tableId: req.body.tableId,
      orderOrigin: req.orderOrigin,
    });
    
    logError(error, {
      message: 'Failed to create order',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'create_order',
    });

    // Return specific error response instead of throwing
    let errorMessage = error.publicMessage || error.message || 'Failed to create order';
    let statusCode = error.statusCode || error.status || 500;

    // Map common error messages to more user-friendly versions
    if (errorMessage.includes('Cart is empty') || errorMessage.includes('0 items')) {
      errorMessage = 'Your cart is empty. Please add at least one item to place an order.';
      statusCode = 400;
    } else if (errorMessage.includes('Table not found') || errorMessage.includes('invalid table')) {
      errorMessage = 'The selected table is not available. Please try again or select a different table.';
      statusCode = 404;
    } else if (errorMessage.includes('Restaurant') && errorMessage.includes('not found')) {
      errorMessage = 'The restaurant information could not be found. Please refresh and try again.';
      statusCode = 404;
    } else if (statusCode === 500) {
      // For 500 errors, don't expose the technical message
      errorMessage = 'An error occurred while creating your order. Please try again.';
    }
    
    return sendError(res, statusCode, errorMessage);
  }
});

export const getActiveOrderByTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const currentWaiterId = req.user?.userId;
  
  if (!currentWaiterId) {
    return sendError(res, 401, 'User must be authenticated');
  }

  try {
    // ACCESS CHECK: Allow read-only access to see current table state (isReadOnly: true)
    // This prevents false "locked" errors when multiple waiters navigate to the same table
    await validateTableAccess(req.restaurantId, tableId, req.user || {}, { isManual: false, isReadOnly: true });
  } catch (validationError) {
    return sendError(res, 403, validationError.message);
  }

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

  if (!orderId) {
    return sendError(res, 400, 'Order ID is required');
  }

  const order = await OrderService.getOrderById(req.restaurantId, orderId, req.user);

  return sendSuccess(res, 200, order, 'Order fetched successfully');
});

export const getOrders = asyncHandler(async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      orderType: req.query.orderType || req.query.order_type,
      tableNumber: req.query.tableNumber ? String(req.query.tableNumber).trim() : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 20,
      skip: parseInt(req.query.skip) || 0,
    };

    const result = await OrderService.getOrders(req.user.restaurantId, filters, req.user);
    
    logSuccessfulOperation('get_orders', {
      message: 'Orders retrieved successfully',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      details: { orderCount: result?.data?.length || 0, filters },
    });

    return sendSuccess(res, 200, result, 'Orders fetched successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to retrieve orders',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      statusCode: 500,
      action: 'get_orders',
    });
    throw error;
  }
});

export const getActiveOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await OrderService.getActiveOrders(req.user.restaurantId);
    
    logger.info('Active orders retrieved', {
      userId: req.user?.id,
      restaurantId: req.user.restaurantId,
      orderCount: orders?.length || 0,
    });

    return sendSuccess(res, 200, orders, 'Active orders fetched successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to retrieve active orders',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      statusCode: 500,
      action: 'get_active_orders',
    });
    throw error;
  }
});

export const getOpenBills = asyncHandler(async (req, res) => {
  try {
    logger.info(`API HIT: GET /orders/open - Restaurant: ${req.user.restaurantId}`);
    const orders = await OrderService.getOpenBills(req.user.restaurantId);
    
    logSuccessfulOperation('get_open_bills', {
      message: 'Open bills retrieved',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      details: { billCount: orders?.length || 0 },
    });

    return sendSuccess(res, 200, orders, 'Open bills fetched successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to retrieve open bills',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.user.restaurantId,
      statusCode: 500,
      action: 'get_open_bills',
    });
    throw error;
  }
});

export const cancelPendingBills = asyncHandler(async (req, res) => {
  const result = await OrderService.cancelPendingBills(req.user.restaurantId, req.body.reason);
  return sendSuccess(res, 200, result, 'Pending bills cancelled successfully');
});

export const softDeleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const currentPassword = req.body.currentPassword || req.body.current_password || '';

  console.log('\n[ORDER_DELETE] ═══════════════════════════════════');
  console.log('[ORDER_DELETE] Endpoint called for order:', orderId);
  console.log('[ORDER_DELETE] User:', req.user?.email, 'Role:', req.user?.role, 'ID:', req.user?.userId);
  console.log('[ORDER_DELETE] Restaurant ID:', req.restaurantId);
  console.log('[ORDER_DELETE] ═══════════════════════════════════\n');

  try {
    if (!orderId || orderId.trim().length === 0) {
      console.log('[ORDER_DELETE] ❌ Invalid orderId');
      return sendError(res, 400, 'Order ID is required');
    }

    // ✅ STRICT PASSWORD VERIFICATION BEFORE DELETION
    console.log('[ORDER_DELETE] 🔐 Enforcing password verification');
    
    if (!currentPassword || currentPassword.trim().length === 0) {
      console.log('[ORDER_DELETE] ❌ Password required but not provided');
      return sendError(res, 401, 'Current password is required for order deletion');
    }

    // 🔧 FIXED: Verify password via Supabase Auth (not database hash)
    // This is more secure and ensures password matches Supabase records
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: req.user?.email,
      password: currentPassword.trim(),
    });

    if (authError || !authData?.user?.id) {
      console.log('[ORDER_DELETE] ❌ PASSWORD VERIFICATION FAILED - INVALID PASSWORD');
      return sendError(res, 401, 'Current password is incorrect');
    }

    console.log('[ORDER_DELETE] ✅ Password verified via Supabase Auth - proceeding with deletion');

    // ✅ ONLY PROCEED IF PASSWORD IS VALID
    const deletedOrder = await OrderService.softDeleteOrder(req.restaurantId || req.user?.restaurantId || null, orderId, req.body.reason, {
      actorRole: req.user?.role,
      actorUserId: req.user?.userId,
      actorName: req.user?.name || req.user?.email || 'Unknown user',
      currentPassword: '', // Don't pass password to service
    });

    console.log('[ORDER_DELETE] ✅ Deletion successful');
    
    if (!deletedOrder || !deletedOrder.id) {
      console.log('[ORDER_DELETE] ❌ No rows updated in database');
      return sendError(res, 400, 'Order deletion failed - no rows were updated in database');
    }

    return sendSuccess(res, 200, deletedOrder, 'Order deleted safely');

  } catch (error) {
    console.log('[ORDER_DELETE] ❌ Error caught:', error.message);
    console.error('[ORDER_DELETE] Full error:', error);
    // Let asyncHandler pass error to error middleware
    throw error;
  }
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
  try {
    // Verify user and restaurant ID are set by auth middleware
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!req.user.restaurantId) {
      return sendError(res, 401, 'Restaurant ID not found in token');
    }

    if (!req.restaurantId) {
      return sendError(res, 401, 'Tenant isolation failed');
    }

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
  } catch (error) {
    logger.error('SSE stream error:', error);
    return sendError(res, 500, 'Failed to establish stream connection');
  }
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

  // ACCESS CHECK: Validate waiter can access table being updated
  await validateTableAccess(req.restaurantId, normalizedOrder.tableId, req.user || {}, { isManual: true });

  const order = await OrderService.updateOrder(req.restaurantId, orderId, normalizedOrder, {
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
  });
  return sendSuccess(res, 200, order, 'Order updated successfully');
});

export const sendOrderToKitchen = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  
  try {
    // ✅ CRITICAL: Validate order ID before sending to kitchen
    if (!orderId) {
      logFailedRequest(new Error('Order ID missing'), {
        message: 'Send to kitchen validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        statusCode: 400,
        action: 'send_to_kitchen_validation',
      });
      return sendError(res, 400, 'Order ID is required');
    }

    const result = await OrderService.sendOrderToKitchen(req.restaurantId, orderId);
    
    logCriticalAction('order_sent_to_kitchen', {
      message: 'Order sent to kitchen',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      orderId,
      details: { kitchenTickets: result?.kotId },
    });

    return sendSuccess(res, 200, result, 'Order sent to kitchen successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to send order to kitchen',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      orderId,
      statusCode: 500,
      action: 'send_to_kitchen',
    });
    throw error;
  }
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, cancelReason } = req.body;

  try {
    if (!status) {
      logFailedRequest(new Error('Status missing'), {
        message: 'Update order status validation failed',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || req.user?.userId,
        restaurantId: req.restaurantId,
        orderId,
        statusCode: 400,
        action: 'update_status_validation',
      });
      return sendError(res, 400, 'Order status is required');
    }

    const order = await OrderService.updateOrderStatus(
      req.restaurantId,
      orderId,
      status,
      cancelReason
    );

    logCriticalAction('order_status_updated', {
      message: 'Order status updated',
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      orderId,
      details: { newStatus: status, cancelReason },
    });

    return sendSuccess(res, 200, order, 'Order status updated successfully');
  } catch (error) {
    logError(error, {
      message: 'Failed to update order status',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id || req.user?.userId,
      restaurantId: req.restaurantId,
      orderId,
      statusCode: 500,
      action: 'update_order_status',
    });
    throw error;
  }
});

export const settleOrder = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const restaurantId = req.restaurantId;
    const userId = req.user?.id;
    
    // 🔥 CRITICAL: Normalize role (owner → admin)
    const normalizeRole = (role) => {
      if (!role) return null;
      const r = String(role).toLowerCase();
      if (r === "owner") return "admin"; // 🔥 CRITICAL FIX
      return r;
    };
    
    const userRole = normalizeRole(req.user?.role);

    // Role-based access control
    if (!userRole || !['admin', 'manager', 'waiter', 'cashier'].includes(userRole)) {
      return sendError(res, 403, 'Unauthorized: insufficient role permissions');
    }

    if (!orderId || !restaurantId) {
      return sendError(res, 400, 'Order ID and Restaurant ID required');
    }

    // Prevent duplicate billing
    const billingKey = `order_${orderId}_settlement`;
    if (!safetyEngine.canExecuteRequest(billingKey)) {
      return sendError(res, 409, 'Settlement already in progress. Please wait.');
    }

    const tracked = safetyEngine.trackBillingOperation(orderId, 'settlement');
    if (!tracked) {
      return sendError(res, 409, 'Settlement already in progress. Please wait.');
    }

    // Validate settlement data
    const settlementData = { ...req.body };

    const rawAmount = settlementData.totalAmount ?? settlementData.amount ?? settlementData.finalAmount;
    const hasAmount = rawAmount !== undefined && rawAmount !== null && String(rawAmount).trim() !== '';
    if (hasAmount) {
      const numericAmount = Number(rawAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return sendError(res, 400, 'Invalid settlement amount');
      }
      settlementData.totalAmount = numericAmount;
    } else {
      settlementData.totalAmount = undefined;
    }

    if (settlementData.amountReceived !== undefined) {
      const numericReceived = Number(settlementData.amountReceived);
      if (!Number.isFinite(numericReceived) || numericReceived < 0) {
        return sendError(res, 400, 'Invalid amount received');
      }
      settlementData.amountReceived = numericReceived;
    }

    try {
      safetyEngine.validateTransactionIntegrity({
        orderId,
        amount: settlementData.totalAmount, // allow undefined to trigger stored total usage
        paymentMethod: settlementData.paymentMethod,
      });
    } catch (validationError) {
      return sendError(res, 400, `Invalid settlement data: ${validationError.message}`);
    }

    // Execute settlement with retry logic
    let result;
    try {
      result = await safetyEngine.executeWithRetry(
        () => OrderService.settleOrder(restaurantId, orderId, settlementData, { userId }),
        'settlementOrder'
      );
    } catch (settlementError) {
      logger.error('Settlement failed after retries', { orderId, error: settlementError.message });
      return sendError(res, 500, 'Failed to settle order. Please try again.');
    }

    logCriticalAction('order_settled', {
      message: 'Order settled',
      userId,
      restaurantId,
      orderId,
      amount: settlementData.totalAmount,
      severity: 'high',
    });

    return sendSuccess(res, 200, result, 'Order settled successfully');
  } catch (error) {
    logError(error, {
      message: 'Settlement error',
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      restaurantId: req.restaurantId,
      statusCode: 500,
      action: 'settle_order',
    });
    throw error;
  }
});

export const markOrderPaid = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  // ACCESS CHECK: Fetch order to get table and validate access
  let paidQuery = supabase
    .from('orders')
    .select('table_id')
    .eq('id', orderId);
  if (req.user?.role?.toLowerCase() !== 'developer') {
    paidQuery = paidQuery.eq('restaurant_id', req.restaurantId);
  }
  const { data: order, error: orderError } = await paidQuery.single();

  if (orderError || !order) {
    return sendError(res, 404, 'Order not found');
  }

  // Validate waiter can access the table (enforce validation for billing)
  await validateTableAccess(req.restaurantId, order.table_id, req.user || {}, { isManual: false });

  const payment = await OrderService.markOrderPaid(req.restaurantId, orderId, {
    method: getOptionalPaymentMethod(req.body),
    amountReceived: getOptionalAmountReceived(req.body),
    paymentNote: getOptionalPaymentNote(req.body) ?? '',
    actorRole: req.user?.role,
    actorUserId: req.user?.userId,
    actorName: req.user?.name || req.user?.email || 'Unknown user',
  });

  return sendSuccess(res, 200, payment, 'Bill marked paid successfully');
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
