import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';
import {
  areInventoryUnitsCompatible,
  assertSupportedInventoryUnit,
  convertInventoryQuantity,
} from '../utils/inventoryUnits.js';

export class InventoryService {
  static transformInventoryItem(item) {
    if (!item) {
      return null;
    }

    const quantity = Number(item.quantity || 0);
    const threshold = Number(item.threshold || 0);

    return {
      id: item.id,
      restaurantId: item.restaurant_id,
      name: item.name,
      quantity,
      unit: item.unit,
      threshold,
      lastUpdated: item.last_updated || item.updated_at || item.created_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      isLowStock: quantity < threshold,
    };
  }

  static transformInventoryHistoryEntry(entry) {
    if (!entry) {
      return null;
    }

    return {
      id: entry.id,
      inventoryItemId: entry.inventory_item_id,
      inventoryItemName: entry.inventory_items?.name || '',
      type: entry.type,
      quantityBefore: Number(entry.quantity_before || 0),
      quantityChange: Number(entry.quantity_change || 0),
      quantityAfter: Number(entry.quantity_after || 0),
      unit: entry.unit,
      reason: entry.reason || '',
      source: entry.source || 'manual',
      referenceId: entry.reference_id || '',
      createdBy: entry.created_by || '',
      createdAt: entry.created_at,
    };
  }

  static transformRecipeEntry(entry) {
    return {
      id: entry.id,
      itemId: entry.inventory_item_id,
      inventoryItemId: entry.inventory_item_id,
      inventoryItemName: entry.inventory_items?.name || '',
      quantity: Number(entry.quantity || 0),
      unit: entry.unit,
    };
  }

  static async getInventoryItems(restaurantId) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map((item) => this.transformInventoryItem(item));
    } catch (error) {
      logger.error('Get inventory items error:', error);
      throw error;
    }
  }

  static async getInventoryItemById(restaurantId, itemId) {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('id', itemId)
      .single();

    if (error || !data) {
      throw error || new Error('Inventory item not found');
    }

    return this.transformInventoryItem(data);
  }

  static async createInventoryItem(restaurantId, itemData) {
    try {
      const unit = assertSupportedInventoryUnit(itemData.unit);
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([{
          restaurant_id: restaurantId,
          name: itemData.name.trim(),
          quantity: Number(itemData.quantity || 0),
          unit,
          threshold: Number(itemData.threshold || 0),
          last_updated: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      const item = this.transformInventoryItem(data);
      await this.recordHistory({
        restaurantId,
        inventoryItemId: item.id,
        type: 'created',
        quantityBefore: 0,
        quantityChange: item.quantity,
        quantityAfter: item.quantity,
        unit: item.unit,
        reason: 'Inventory item created',
        source: 'inventory_create',
      });

      return item;
    } catch (error) {
      logger.error('Create inventory item error:', error);
      throw error;
    }
  }

  static async updateInventoryItem(restaurantId, itemId, updateData) {
    try {
      const existing = await this.getInventoryItemById(restaurantId, itemId);
      const nextUnit = updateData.unit ? assertSupportedInventoryUnit(updateData.unit) : existing.unit;

      if (updateData.unit && !areInventoryUnitsCompatible(existing.unit, nextUnit)) {
        throw new Error('Inventory unit must stay within the same measurement type');
      }

      let nextQuantity = existing.quantity;
      let nextThreshold = existing.threshold;

      if (updateData.quantity !== undefined) {
        nextQuantity = Number(updateData.quantity);
      }

      if (updateData.threshold !== undefined) {
        nextThreshold = Number(updateData.threshold);
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          name: updateData.name !== undefined ? updateData.name.trim() : existing.name,
          quantity: nextQuantity,
          unit: nextUnit,
          threshold: nextThreshold,
          last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', restaurantId)
        .eq('id', itemId)
        .select()
        .single();

      if (error || !data) {
        throw error || new Error('Inventory item not found');
      }

      if (updateData.quantity !== undefined && Number(updateData.quantity) !== existing.quantity) {
        await this.recordHistory({
          restaurantId,
          inventoryItemId: itemId,
          type: 'adjustment',
          quantityBefore: existing.quantity,
          quantityChange: Number(updateData.quantity) - existing.quantity,
          quantityAfter: Number(updateData.quantity),
          unit: nextUnit,
          reason: 'Inventory item updated',
          source: 'inventory_update',
        });
      }

      return this.transformInventoryItem(data);
    } catch (error) {
      logger.error('Update inventory item error:', error);
      throw error;
    }
  }

  static async recordHistory({
    restaurantId,
    inventoryItemId,
    type,
    quantityBefore,
    quantityChange,
    quantityAfter,
    unit,
    reason = '',
    source = 'manual',
    referenceId = null,
    createdBy = null,
  }) {
    const { error } = await supabase
      .from('inventory_history')
      .insert([{
        restaurant_id: restaurantId,
        inventory_item_id: inventoryItemId,
        type,
        quantity_before: Number(quantityBefore || 0),
        quantity_change: Number(quantityChange || 0),
        quantity_after: Number(quantityAfter || 0),
        unit: assertSupportedInventoryUnit(unit),
        reason: String(reason || '').trim(),
        source,
        reference_id: referenceId,
        created_by: createdBy,
      }]);

    if (error) {
      throw error;
    }
  }

  static async addStock(restaurantId, itemId, payload, createdBy = null) {
    return this.adjustStock(restaurantId, itemId, {
      action: 'increase',
      quantity: payload.quantity,
      reason: payload.reason || 'Stock added',
    }, createdBy, 'add_stock');
  }

  static async adjustStock(restaurantId, itemId, payload, createdBy = null, source = 'adjust_stock') {
    try {
      const item = await this.getInventoryItemById(restaurantId, itemId);
      const quantity = Number(payload.quantity || 0);

      let nextQuantity = item.quantity;
      switch (payload.action) {
        case 'increase':
          nextQuantity = item.quantity + quantity;
          break;
        case 'decrease':
          if (item.quantity < quantity) {
            throw new Error('Cannot decrease stock below zero');
          }
          nextQuantity = item.quantity - quantity;
          break;
        case 'set':
          nextQuantity = quantity;
          break;
        default:
          throw new Error('Unsupported stock adjustment action');
      }

      const { data, error } = await supabase
        .from('inventory_items')
        .update({
          quantity: nextQuantity,
          last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('restaurant_id', restaurantId)
        .eq('id', itemId)
        .select()
        .single();

      if (error || !data) {
        throw error || new Error('Inventory item not found');
      }

      await this.recordHistory({
        restaurantId,
        inventoryItemId: itemId,
        type: payload.action === 'increase' ? 'added' : 'adjustment',
        quantityBefore: item.quantity,
        quantityChange: nextQuantity - item.quantity,
        quantityAfter: nextQuantity,
        unit: item.unit,
        reason: payload.reason || '',
        source,
        createdBy,
      });

      return this.transformInventoryItem(data);
    } catch (error) {
      logger.error('Adjust stock error:', error);
      throw error;
    }
  }

  static async getInventoryHistory(restaurantId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('inventory_history')
        .select(`
          *,
          inventory_items!inventory_item_id (
            name
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map((entry) => this.transformInventoryHistoryEntry(entry));
    } catch (error) {
      logger.error('Get inventory history error:', error);
      throw error;
    }
  }

  static async getInventorySummary(restaurantId) {
    try {
      const items = await this.getInventoryItems(restaurantId);
      const history = await this.getInventoryHistory(restaurantId, 20);
      const lowStockItems = items.filter((item) => item.isLowStock);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: dailyUsageRows, error } = await supabase
        .from('inventory_history')
        .select(`
          quantity_change,
          inventory_item_id,
          unit,
          inventory_items!inventory_item_id (
            name
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('type', 'used')
        .gte('created_at', startOfDay.toISOString());

      if (error) {
        throw error;
      }

      const usageMap = new Map();
      (dailyUsageRows || []).forEach((row) => {
        const key = row.inventory_item_id;
        const current = usageMap.get(key) || {
          inventoryItemId: key,
          name: row.inventory_items?.name || 'Unknown',
          totalUsed: 0,
          unit: row.unit,
        };

        current.totalUsed += Math.abs(Number(row.quantity_change || 0));
        usageMap.set(key, current);
      });

      const topConsumedItems = Array.from(usageMap.values())
        .sort((left, right) => right.totalUsed - left.totalUsed)
        .slice(0, 5);

      return {
        totalItems: items.length,
        lowStockCount: lowStockItems.length,
        lowStockItems,
        recentHistory: history,
        topConsumedItems,
      };
    } catch (error) {
      logger.error('Get inventory summary error:', error);
      throw error;
    }
  }

  static async getRecipesByMenuItemIds(restaurantId, menuItemIds = []) {
    if (!Array.isArray(menuItemIds) || menuItemIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('menu_item_recipes')
      .select(`
        *,
        inventory_items!inventory_item_id (
          id,
          restaurant_id,
          name,
          unit,
          quantity,
          threshold
        )
      `)
      .in('menu_item_id', menuItemIds);

    if (error) {
      throw error;
    }

    const recipeMap = new Map();
    (data || []).forEach((entry) => {
      if (entry.inventory_items?.restaurant_id !== restaurantId) {
        return;
      }

      const current = recipeMap.get(entry.menu_item_id) || [];
      current.push(this.transformRecipeEntry(entry));
      recipeMap.set(entry.menu_item_id, current);
    });

    return recipeMap;
  }

  static async replaceMenuItemRecipe(restaurantId, menuItemId, ingredients = []) {
    try {
      const normalizedIngredients = ingredients.map((ingredient) => ({
        inventoryItemId: ingredient.itemId || ingredient.inventoryItemId,
        quantity: Number(ingredient.quantity || 0),
        unit: assertSupportedInventoryUnit(ingredient.unit),
      }));

      const inventoryIds = normalizedIngredients.map((ingredient) => ingredient.inventoryItemId);
      if (inventoryIds.length > 0) {
        const { data: inventoryItems, error: inventoryError } = await supabase
          .from('inventory_items')
          .select('id, restaurant_id, unit')
          .eq('restaurant_id', restaurantId)
          .in('id', inventoryIds);

        if (inventoryError) {
          throw inventoryError;
        }

        if ((inventoryItems || []).length !== inventoryIds.length) {
          throw new Error('One or more recipe ingredients are invalid');
        }

        const inventoryMap = new Map((inventoryItems || []).map((item) => [item.id, item]));
        normalizedIngredients.forEach((ingredient) => {
          const inventoryItem = inventoryMap.get(ingredient.inventoryItemId);
          if (!inventoryItem || !areInventoryUnitsCompatible(ingredient.unit, inventoryItem.unit)) {
            throw new Error('Recipe ingredient unit does not match the inventory item measurement type');
          }
        });
      }

      const { error: deleteError } = await supabase
        .from('menu_item_recipes')
        .delete()
        .eq('menu_item_id', menuItemId);

      if (deleteError) {
        throw deleteError;
      }

      if (normalizedIngredients.length > 0) {
        const { error: insertError } = await supabase
          .from('menu_item_recipes')
          .insert(
            normalizedIngredients.map((ingredient) => ({
              menu_item_id: menuItemId,
              inventory_item_id: ingredient.inventoryItemId,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            }))
          );

        if (insertError) {
          throw insertError;
        }
      }
    } catch (error) {
      logger.error('Replace menu recipe error:', error);
      throw error;
    }
  }

  static async consumeMenuItems(restaurantId, orderItems = [], context = {}) {
    try {
      const normalizedOrderItems = orderItems
        .map((item) => ({
          menuItemId: item.menuItemId || item.id,
          quantity: Number(item.quantity || item.qty || 0),
          name: item.name || '',
        }))
        .filter((item) => item.menuItemId && item.quantity > 0);

      if (normalizedOrderItems.length === 0) {
        return { consumedItems: [], insufficientItems: [] };
      }

      const recipeMap = await this.getRecipesByMenuItemIds(
        restaurantId,
        normalizedOrderItems.map((item) => item.menuItemId)
      );

      const usageMap = new Map();
      normalizedOrderItems.forEach((orderItem) => {
        const recipe = recipeMap.get(orderItem.menuItemId) || [];
        recipe.forEach((ingredient) => {
          const key = ingredient.inventoryItemId;
          const current = usageMap.get(key) || {
            inventoryItemId: ingredient.inventoryItemId,
            inventoryItemName: ingredient.inventoryItemName,
            inventoryUnit: ingredient.unit,
            requiredQuantity: 0,
          };

          current.requiredQuantity += ingredient.quantity * orderItem.quantity;
          usageMap.set(key, current);
        });
      });

      if (usageMap.size === 0) {
        return { consumedItems: [], insufficientItems: [] };
      }

      const { data: inventoryRows, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('id', Array.from(usageMap.keys()));

      if (error) {
        throw error;
      }

      const inventoryMap = new Map((inventoryRows || []).map((row) => [row.id, row]));
      const insufficientItems = [];

      usageMap.forEach((usage, inventoryItemId) => {
        const inventoryItem = inventoryMap.get(inventoryItemId);
        if (!inventoryItem) {
          return;
        }

        const requiredInInventoryUnit = convertInventoryQuantity(
          usage.requiredQuantity,
          usage.inventoryUnit,
          inventoryItem.unit
        );
        usage.requiredInInventoryUnit = requiredInInventoryUnit;
        usage.inventoryUnit = inventoryItem.unit;
        usage.availableQuantity = Number(inventoryItem.quantity || 0);

        if (usage.availableQuantity < requiredInInventoryUnit) {
          insufficientItems.push({
            name: inventoryItem.name,
            requiredQuantity: requiredInInventoryUnit,
            availableQuantity: usage.availableQuantity,
            unit: inventoryItem.unit,
          });
        }
      });

      if (insufficientItems.length > 0) {
        const firstIssue = insufficientItems[0];
        throw new Error(
          `Not enough stock for ${firstIssue.name}. Need ${firstIssue.requiredQuantity} ${firstIssue.unit}, available ${firstIssue.availableQuantity} ${firstIssue.unit}.`
        );
      }

      const consumedItems = [];
      for (const usage of usageMap.values()) {
        const inventoryItem = inventoryMap.get(usage.inventoryItemId);
        const quantityBefore = Number(inventoryItem.quantity || 0);
        const quantityAfter = Number((quantityBefore - usage.requiredInInventoryUnit).toFixed(4));

        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({
            quantity: quantityAfter,
            last_updated: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('restaurant_id', restaurantId)
          .eq('id', usage.inventoryItemId);

        if (updateError) {
          throw updateError;
        }

        await this.recordHistory({
          restaurantId,
          inventoryItemId: usage.inventoryItemId,
          type: 'used',
          quantityBefore,
          quantityChange: -usage.requiredInInventoryUnit,
          quantityAfter,
          unit: inventoryItem.unit,
          reason: context.reason || 'Recipe-based auto deduction',
          source: context.source || 'order_deduction',
          referenceId: context.referenceId || null,
        });

        consumedItems.push({
          inventoryItemId: usage.inventoryItemId,
          name: inventoryItem.name,
          quantity: usage.requiredInInventoryUnit,
          unit: inventoryItem.unit,
          quantityAfter,
        });
      }

      return {
        consumedItems,
        insufficientItems: [],
      };
    } catch (error) {
      logger.error('Consume menu items error:', error);
      throw error;
    }
  }
}

export default InventoryService;
