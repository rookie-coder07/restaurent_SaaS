import { jest } from '@jest/globals';
import OrderService from '../src/services/orderService.js';
import supabase from '../src/config/supabase.js';
import { composeNotesWithKotMeta } from '../src/utils/kotMetadata.js';
import TableService from '../src/services/tableService.js';

describe('OrderService stability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  test('getDisplayOrderDateKey uses the restaurant timezone instead of raw UTC date slices', () => {
    expect(OrderService.getDisplayOrderDateKey('2026-04-04T19:44:00.000Z', 'Asia/Kolkata')).toBe('2026-04-05');
    expect(OrderService.getDisplayOrderDateKey('2026-04-05T18:45:00.000Z', 'Asia/Kolkata')).toBe('2026-04-06');
  });

  test('extractDisplayOrderSequence only counts numbers from the same business date', () => {
    expect(OrderService.extractDisplayOrderSequence('ORD-20260405-009', '2026-04-05')).toBe(9);
    expect(OrderService.extractDisplayOrderSequence('ORD-20260404-009', '2026-04-05')).toBe(0);
    expect(OrderService.extractDisplayOrderSequence('bad-value', '2026-04-05')).toBe(0);
  });

  test('buildFallbackDisplayOrderNumber stays readable when a stored order number is missing', () => {
    expect(OrderService.buildFallbackDisplayOrderNumber('030a2702-a51e-4a65-9fe7-af9484da7fe9')).toBe('ORD-DA7FE9');
  });

  test('table lifecycle preserves manager-closed tables until a real active order exists', () => {
    expect(TableService.getEffectiveStatus({ status: 'closed' }, false)).toBe('closed');
    expect(TableService.getEffectiveStatus({ status: 'closed' }, true)).toBe('occupied');
  });

  test('waiter roles cannot apply billing discounts through create or update totals', () => {
    expect(() => OrderService.assertBillingChangesAllowed('staff', 80, 100)).toThrow(
      'Unauthorized: Only manager can perform billing actions'
    );
    expect(() => OrderService.assertBillingChangesAllowed('manager', 80, 100)).not.toThrow();
    expect(() => OrderService.assertBillingChangesAllowed('staff', 100, 100)).not.toThrow();
  });

  test('createOrder reuses the existing dine-in bill for the same table instead of creating a duplicate', async () => {
    const existingOrder = {
      id: 'order-1',
      tableId: 'table-1',
      status: 'pending',
      paymentStatus: 'unpaid',
    };

    const activeOrderSpy = jest.spyOn(OrderService, 'getActiveOrderByTable').mockResolvedValue(existingOrder);

    const result = await OrderService.createOrder(
      'rest-1',
      {
        tableId: 'table-1',
        orderType: 'dine-in',
        items: [{ menuItemId: 'item-1', quantity: 1, unitPrice: 100 }],
      },
      {}
    );

    expect(activeOrderSpy).toHaveBeenCalledWith('rest-1', 'table-1');
    expect(result).toMatchObject({
      id: 'order-1',
      reusedExistingBill: true,
    });
  });

  test('getLoyaltyProfile only reads settled orders for the current restaurant', async () => {
    const orderRows = [
      {
        id: 'order-1',
        created_at: '2026-04-05T08:00:00.000Z',
        total_amount: 420,
        status: 'completed',
        payment_status: 'paid',
        notes: composeNotesWithKotMeta('', {
          loyalty: {
            customerPhone: '9876543210',
            earnedPoints: 4,
            redeemedPoints: 1,
            redeemedAmount: 1,
          },
        }),
      },
      {
        id: 'order-2',
        created_at: '2026-04-04T08:00:00.000Z',
        total_amount: 300,
        status: 'completed',
        payment_status: 'paid',
        notes: composeNotesWithKotMeta('', {
          loyalty: {
            customerPhone: '9999999999',
            earnedPoints: 3,
          },
        }),
      },
    ];

    const orderBy = jest.fn().mockResolvedValue({ data: orderRows, error: null });
    const or = jest.fn(() => ({ order: orderBy }));
    const eq = jest.fn(() => ({ or }));
    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn(() => ({ eq })),
    });

    const profile = await OrderService.getLoyaltyProfile('rest-tenant-a', '9876543210');

    expect(eq).toHaveBeenCalledWith('restaurant_id', 'rest-tenant-a');
    expect(profile.customerPhone).toBe('9876543210');
    expect(profile.pointsBalance).toBe(3);
    expect(profile.totalEarnedPoints).toBe(4);
    expect(profile.totalRedeemedPoints).toBe(1);
    expect(profile.visitCount).toBe(1);
    expect(profile.recentOrders).toHaveLength(1);
    expect(profile.recentOrders[0].id).toBe('order-1');
  });

  test('settleOrder allows cash settlement when loyalty rounds the payable amount down to zero', async () => {
    const existingOrder = {
      id: 'order-1',
      restaurant_id: 'rest-1',
      table_id: 'table-14',
      status: 'pending',
      payment_status: 'unpaid',
      total_amount: 1,
      payment_method: 'cash',
      notes: '',
      created_at: '2026-04-05T08:00:00.000Z',
      updated_at: '2026-04-05T08:00:00.000Z',
      order_items: [
        {
          id: 'line-1',
          menu_item_id: 'item-1',
          quantity: 1,
          unit_price: 1,
          menu_items: {
            name: 'Mint',
            preparation_time: 5,
          },
        },
      ],
    };
    const updatedOrderRow = {
      ...existingOrder,
      status: 'completed',
      payment_status: 'paid',
      total_amount: 0,
      updated_at: '2026-04-05T08:05:00.000Z',
    };

    jest.spyOn(OrderService, 'fetchOrderRecord').mockResolvedValue(existingOrder);
    jest.spyOn(OrderService, 'getLoyaltyProfile').mockResolvedValue({
      customerPhone: '9876543210',
      pointsBalance: 2,
      totalEarnedPoints: 2,
      totalRedeemedPoints: 0,
      totalRedeemedAmount: 0,
      totalSpend: 200,
      visitCount: 1,
      lastVisitAt: '2026-04-04T08:00:00.000Z',
      recentOrders: [],
    });
    jest.spyOn(OrderService, 'getOrderById').mockResolvedValue(OrderService.transformOrder(updatedOrderRow));
    jest.spyOn(TableService, 'syncTableLifecycle').mockResolvedValue();

    const updateEqRestaurant = jest.fn().mockResolvedValue({ error: null });
    const updateEqId = jest.fn(() => ({ eq: updateEqRestaurant }));
    const update = jest.fn(() => ({ eq: updateEqId }));
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'rest-1',
        enable_gst: true,
        default_gst_percent: 5,
      },
      error: null,
    });
    const selectRestaurants = jest.fn(() => ({ eq: jest.fn(() => ({ single })) }));

    jest.spyOn(supabase, 'from').mockImplementation((table) => {
      if (table === 'restaurants') {
        return { select: selectRestaurants };
      }

      if (table === 'orders') {
        return { update };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const result = await OrderService.settleOrder('rest-1', 'order-1', {
      method: 'cash',
      loyaltyPhone: '9876543210',
      redeemPoints: 1,
    });

    expect(update).toHaveBeenCalled();
    expect(updateEqId).toHaveBeenCalledWith('id', 'order-1');
    expect(updateEqRestaurant).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(result.settlement.finalTotal).toBe(0);
    expect(result.settlement.amountReceived).toBe(0);
    expect(result.settlement.loyalty.redeemedPoints).toBe(1);
  });
});
