import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { cacheManager } from '../utils/cacheManager.js';

const KITCHEN_CACHE_TTL = 30; // Shorter TTL for kitchen display
const KITCHEN_STATS_CACHE_TTL = 15;

export class KitchenService {
  // ============ KITCHEN DISPLAY SYSTEM ============

  static async getPendingOrders(restaurantId, limit = 50, offset = 0) {
    try {
      if (!restaurantId) return [];
      
      const cacheKey = `pending_orders:${restaurantId}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          total_amount,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            id,
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) return [];

      const result = (orders || []).map(order => ({
        ...order,
        tableNumber: order?.tables?.table_number || null,
        table: order?.tables,
      }));

      cacheManager.set(cacheKey, result, KITCHEN_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get pending orders error:', error);
      throw error;
    }
  }

  static async getOrdersInProgress(restaurantId, limit = 50, offset = 0) {
    try {
      if (!restaurantId) return [];
      
      const cacheKey = `in_progress_orders:${restaurantId}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          total_amount,
          updated_at,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            id,
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) return [];

      const result = (orders || []).map(order => ({
        ...order,
        tableNumber: order?.tables?.table_number || null,
        table: order?.tables,
      }));

      cacheManager.set(cacheKey, result, KITCHEN_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get in-progress orders error:', error);
      throw error;
    }
  }

  static async startCooking(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'in_progress',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) return null;

      logger.info(`✅ Order cooking started: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Start cooking error:', error);
      throw error;
    }
  }

  static async completeOrder(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) return null;

      logger.info(`✅ Order completed: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Complete order error:', error);
      throw error;
    }
  }

  static async getOrderDetails(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) return null;

      // Add tableNumber for easier consumption
      return {
        ...order,
        tableNumber: order?.tables?.table_number || null,
        table: order?.tables,
      };
    } catch (error) {
      logger.error('❌ Get order details error:', error);
      throw error;
    }
  }

  static async getKitchenStats(restaurantId) {
    try {
      if (!restaurantId) return { pendingOrders: 0, inProgressOrders: 0, totalQueue: 0 };
      
      const cacheKey = `kitchen_stats:${restaurantId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      // Batch query using count for efficiency
      const [pendingResult, inProgressResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('status', 'pending'),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('status', 'in_progress'),
      ]);

      const pendingCount = pendingResult?.count || 0;
      const inProgressCount = inProgressResult?.count || 0;

      const stats = {
        pendingOrders: pendingCount,
        inProgressOrders: inProgressCount,
        totalQueue: pendingCount + inProgressCount,
      };

      cacheManager.set(cacheKey, stats, KITCHEN_STATS_CACHE_TTL);
      return stats;
    } catch (error) {
      logger.error('❌ Get kitchen stats error:', error);
      throw error;
    }
  }

  static async getAveragePreparationTime(restaurantId, limit = 100) {
    try {
      const { data: completedOrders, error } = await supabase
        .from('orders')
        .select('created_at, updated_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!completedOrders || completedOrders.length === 0) {
        return { averageTime: 0, ordersAnalyzed: 0 };
      }

      const times = completedOrders.map(order => {
        const created = new Date(order.created_at);
        const updated = new Date(order.updated_at);
        return (updated - created) / 1000 / 60; // Convert to minutes
      });

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      return {
        averageTime: parseFloat(averageTime.toFixed(2)),
        ordersAnalyzed: times.length,
      };
    } catch (error) {
      logger.error('❌ Get average preparation time error:', error);
      return { averageTime: 0, ordersAnalyzed: 0 };
    }
  }

  static async markOrderReady(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'ready',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) return null;

      logger.info(`✅ Order marked as ready: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Mark order ready error:', error);
      throw error;
    }
  }

  static async getReadyOrders(restaurantId, limit = 50, offset = 0) {
    try {
      const cacheKey = `ready_orders:${restaurantId}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          updated_at,
          order_items (
            id,
            quantity,
            menu_item_id
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ready')
        .order('updated_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = orders || [];
      cacheManager.set(cacheKey, result, KITCHEN_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get ready orders error:', error);
      throw error;
    }
  }

  static async getOrderHistory(restaurantId, limit = 50, offset = 0) {
    try {
      const cacheKey = `order_history:${restaurantId}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          updated_at
        `)
        .eq('restaurant_id', restaurantId)
        .neq('status', 'pending')
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = orders || [];
      cacheManager.set(cacheKey, result, KITCHEN_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get order history error:', error);
      throw error;
    }
  }
}

export default KitchenService;
