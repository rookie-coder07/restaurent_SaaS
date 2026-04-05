import { jest } from '@jest/globals';
import supabase from '../src/config/supabase.js';
import InventoryService from '../src/services/inventoryService.js';

describe('InventoryService stability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('addStock increases quantity and records inventory history', async () => {
    jest.spyOn(InventoryService, 'getInventoryItemById').mockResolvedValue({
      id: 'item-1',
      restaurantId: 'rest-1',
      name: 'Rice',
      quantity: 5,
      unit: 'kg',
      threshold: 2,
    });
    const recordHistorySpy = jest.spyOn(InventoryService, 'recordHistory').mockResolvedValue();

    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'item-1',
        restaurant_id: 'rest-1',
        name: 'Rice',
        quantity: 8,
        unit: 'kg',
        threshold: 2,
        updated_at: '2026-04-05T06:00:00.000Z',
      },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const eqSecond = jest.fn(() => ({ select }));
    const eqFirst = jest.fn(() => ({ eq: eqSecond }));
    const update = jest.fn(() => ({ eq: eqFirst }));
    jest.spyOn(supabase, 'from').mockReturnValue({ update });

    const result = await InventoryService.addStock(
      'rest-1',
      'item-1',
      { quantity: 3, reason: 'Weekly restock' },
      'owner-1'
    );

    expect(result.quantity).toBe(8);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ quantity: 8 }));
    expect(recordHistorySpy).toHaveBeenCalledWith(expect.objectContaining({
      inventoryItemId: 'item-1',
      type: 'added',
      quantityBefore: 5,
      quantityChange: 3,
      quantityAfter: 8,
      source: 'add_stock',
      createdBy: 'owner-1',
    }));
  });

  test('adjustStock rejects decreases that would push inventory below zero', async () => {
    jest.spyOn(InventoryService, 'getInventoryItemById').mockResolvedValue({
      id: 'item-1',
      restaurantId: 'rest-1',
      name: 'Rice',
      quantity: 2,
      unit: 'kg',
      threshold: 1,
    });
    const fromSpy = jest.spyOn(supabase, 'from');

    await expect(
      InventoryService.adjustStock(
        'rest-1',
        'item-1',
        { action: 'decrease', quantity: 5, reason: 'Spoilage' },
        'owner-1'
      )
    ).rejects.toThrow('Cannot decrease stock below zero');

    expect(fromSpy).not.toHaveBeenCalled();
  });

  test('updateInventoryItem blocks unit changes across measurement types', async () => {
    jest.spyOn(InventoryService, 'getInventoryItemById').mockResolvedValue({
      id: 'item-1',
      restaurantId: 'rest-1',
      name: 'Rice',
      quantity: 5,
      unit: 'kg',
      threshold: 2,
    });
    const fromSpy = jest.spyOn(supabase, 'from');

    await expect(
      InventoryService.updateInventoryItem('rest-1', 'item-1', { unit: 'ml' })
    ).rejects.toThrow('Inventory unit must stay within the same measurement type');

    expect(fromSpy).not.toHaveBeenCalled();
  });

  test('consumeMenuItems deducts recipe quantities and writes used-history entries', async () => {
    jest.spyOn(InventoryService, 'getRecipesByMenuItemIds').mockResolvedValue(new Map([
      ['menu-1', [
        {
          inventoryItemId: 'inv-1',
          inventoryItemName: 'Chicken',
          quantity: 0.25,
          unit: 'kg',
        },
        {
          inventoryItemId: 'inv-2',
          inventoryItemName: 'Butter',
          quantity: 0.03,
          unit: 'kg',
        },
      ]],
    ]));
    const recordHistorySpy = jest.spyOn(InventoryService, 'recordHistory').mockResolvedValue();

    const inventoryRows = [
      { id: 'inv-1', restaurant_id: 'rest-1', name: 'Chicken', quantity: 15, unit: 'kg' },
      { id: 'inv-2', restaurant_id: 'rest-1', name: 'Butter', quantity: 5, unit: 'kg' },
    ];

    const selectIn = jest.fn().mockResolvedValue({
      data: inventoryRows,
      error: null,
    });
    const selectEq = jest.fn(() => ({
      in: selectIn,
    }));
    const select = jest.fn(() => ({
      eq: selectEq,
    }));

    const updateEqSecond = jest.fn(() => Promise.resolve({ error: null }));
    const updateEqFirst = jest.fn(() => ({
      eq: updateEqSecond,
    }));
    const update = jest.fn(() => ({
      eq: updateEqFirst,
    }));

    jest.spyOn(supabase, 'from').mockImplementation((tableName) => {
      if (tableName === 'inventory_items') {
        return {
          select,
          update,
        };
      }

      throw new Error(`Unexpected table ${tableName}`);
    });

    const result = await InventoryService.consumeMenuItems(
      'rest-1',
      [{ menuItemId: 'menu-1', quantity: 1, name: 'Butter Chicken' }],
      {
        source: 'send_to_kitchen',
        referenceId: 'order-1:ticket-1',
        reason: 'Recipe-based auto deduction on kitchen send',
      }
    );

    expect(result.insufficientItems).toEqual([]);
    expect(result.consumedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        inventoryItemId: 'inv-1',
        quantity: 0.25,
        quantityAfter: 14.75,
      }),
      expect.objectContaining({
        inventoryItemId: 'inv-2',
        quantity: 0.03,
        quantityAfter: 4.97,
      }),
    ]));
    expect(recordHistorySpy).toHaveBeenCalledWith(expect.objectContaining({
      inventoryItemId: 'inv-1',
      type: 'used',
      quantityBefore: 15,
      quantityChange: -0.25,
      quantityAfter: 14.75,
      source: 'send_to_kitchen',
      referenceId: 'order-1:ticket-1',
    }));
    expect(recordHistorySpy).toHaveBeenCalledWith(expect.objectContaining({
      inventoryItemId: 'inv-2',
      type: 'used',
      quantityBefore: 5,
      quantityChange: -0.03,
      quantityAfter: 4.97,
      source: 'send_to_kitchen',
      referenceId: 'order-1:ticket-1',
    }));
  });
});
