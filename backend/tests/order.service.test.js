import OrderService from '../src/services/orderService.js';

describe('OrderService stability', () => {
  test('resolveOrderItemUnitPrice falls back to the menu price when the request sends zero', () => {
    expect(OrderService.resolveOrderItemUnitPrice(0, 67)).toBe(67);
    expect(OrderService.resolveOrderItemUnitPrice(undefined, 67)).toBe(67);
  });

  test('resolvePersistedOrderTotal falls back to the computed order total when the request total is zero', () => {
    expect(OrderService.resolvePersistedOrderTotal(0, 67)).toBe(67);
    expect(OrderService.resolvePersistedOrderTotal(undefined, 67)).toBe(67);
  });

  test('transformOrder synthesizes billing details for settled orders when metadata is missing', () => {
    const transformed = OrderService.transformOrder({
      id: '030a2702-a51e-4a65-9fe7-af9484da7fe9',
      restaurant_id: 'rest-1',
      table_id: 'table-1',
      status: 'completed',
      order_type: 'dine-in',
      total_amount: 67,
      payment_method: 'cash',
      payment_status: 'paid',
      notes: '',
      created_at: '2026-04-05T08:00:00.000Z',
      updated_at: '2026-04-05T08:05:00.000Z',
      order_items: [
        {
          id: 'item-line-1',
          menu_item_id: 'item-1',
          quantity: 1,
          unit_price: 67,
          menu_items: {
            name: 'gg',
            preparation_time: 15,
          },
        },
      ],
    });

    expect(transformed.billing).toBeDefined();
    expect(transformed.billing.invoiceNumber).toBe('INV-20260405-DA7FE9');
    expect(transformed.billing.invoiceDate).toBe('2026-04-05T08:05:00.000Z');
    expect(transformed.billing.grandTotal).toBe(67);
    expect(transformed.billing.paymentMode).toBe('cash');
    expect(transformed.billing.paidAmount).toBe(67);
  });
});
