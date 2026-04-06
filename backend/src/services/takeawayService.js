import OrderService from './orderService.js';

const takeawayService = {
  async createOrder(restaurantId, payload, context = {}) {
    const orderPayload = {
      orderType: 'takeaway',
      items: payload.items || [],
      totalAmount: payload.total || 0,
      paymentMethod: 'cash',
      notes: '',
      online: {
        customerName: payload.customerName || '',
        customerPhone: payload.customerPhone || '',
      },
    };
    return OrderService.createOrder(restaurantId, orderPayload, {
      actorRole: context.actorRole || 'manager',
      actorId: context.actorId,
    });
  },

  async settleOrder(restaurantId, orderId, payload, context = {}) {
    return OrderService.settleOrder(restaurantId, orderId, {
      method: payload.paymentMode || 'cash',
      amountReceived: payload.amountReceived,
      paymentNote: payload.paymentNote || '',
    });
  },
};

export default takeawayService;
