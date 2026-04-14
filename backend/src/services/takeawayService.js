import OrderService from './orderService.js';
import logger from '../utils/logger.js';

const takeawayService = {
  async createOrder(restaurantId, payload, context = {}) {
    try {
      // ✅ TASK 1: NORMALIZE INPUT - Handle multiple field names
      const items = 
        payload.items ||
        payload.orderItems ||
        payload.cartItems ||
        [];

      logger.debug('📦 Takeaway order input normalization', {
        restaurantId,
        receivedFields: {
          items: payload.items?.length || 0,
          orderItems: payload.orderItems?.length || 0,
          cartItems: payload.cartItems?.length || 0,
        },
        normalizedItemsCount: items.length,
        actorRole: context.actorRole,
      });

      // ✅ TASK 2: VALIDATE ITEMS - Check if empty
      if (!items || items.length === 0) {
        logger.warn('⚠️ Takeaway order creation attempted with empty items', {
          restaurantId,
          actorRole: context.actorRole,
          actorId: context.actorId,
        });
        throw new Error('Cannot create order: Cart is empty, add at least one item');
      }

      logger.info(`✅ Items validated: ${items.length} items ready for order creation`, {
        restaurantId,
        itemCount: items.length,
        customerName: payload.customerName,
      });

      // ✅ TASK 3: FIX ORDER FLOW - createOrder → insertItems → generateKOT
      const orderPayload = {
        orderType: 'takeaway',
        items, // Use normalized items array
        totalAmount: payload.total || 0,
        paymentMethod: 'cash',
        notes: payload.notes || '',
        online: {
          customerName: payload.customerName || '',
          customerPhone: payload.customerPhone || '',
        },
      };

      logger.debug('📝 Order payload prepared', {
        orderType: orderPayload.orderType,
        itemCount: items.length,
        totalAmount: orderPayload.totalAmount,
      });

      // ✅ TASK 5: ADD DEBUG LOGS
      console.log('🍔 [TAKEAWAY] Creating order:', {
        restaurantId,
        itemsCount: items.length,
        customerName: payload.customerName,
        total: payload.total,
      });

      const createdOrder = await OrderService.createOrder(restaurantId, orderPayload, {
        actorRole: context.actorRole || 'manager',
        actorId: context.actorId,
      });

      logger.info('✅ Takeaway order created successfully', {
        orderId: createdOrder?.id,
        restaurantId,
        itemCount: items.length,
        displayOrderNumber: createdOrder?.displayOrderNumber,
      });

      console.log('✅ [TAKEAWAY] Order created:', {
        orderId: createdOrder?.id,
        displayOrderNumber: createdOrder?.displayOrderNumber,
        itemsCount: createdOrder?.items?.length,
      });

      return createdOrder;
    } catch (error) {
      logger.error('❌ Takeaway order creation failed', {
        message: error.message,
        restaurantId,
        actorRole: context.actorRole,
        itemsCount: payload.items?.length || payload.orderItems?.length || payload.cartItems?.length || 0,
      });
      
      console.error('❌ [TAKEAWAY] Order creation error:', error.message);
      throw error;
    }
  },

  async settleOrder(restaurantId, orderId, payload, context = {}) {
    try {
      const numericAmount = Number(payload.amountReceived);
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Invalid settlement amount');
      }

      logger.info('💰 Settling takeaway order', {
        orderId,
        restaurantId,
        amount: numericAmount,
        method: payload.paymentMode,
      });

      return OrderService.settleOrder(restaurantId, orderId, {
        method: payload.paymentMode || 'cash',
        amountReceived: numericAmount,
        paymentNote: payload.paymentNote || '',
      });
    } catch (error) {
      logger.error('❌ Takeaway order settlement failed', {
        orderId,
        restaurantId,
        message: error.message,
      });
      throw error;
    }
  },
};

export default takeawayService;
