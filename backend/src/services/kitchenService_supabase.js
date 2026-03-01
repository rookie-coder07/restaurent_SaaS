import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class KitchenService {
  // ============ KITCHEN DISPLAY SYSTEM ============

  static async getPendingOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get pending orders error:', error);
      throw error;
    }
  }

  static async getOrdersInProgress(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get in-progress orders error:', error);
      throw error;
    }
  }

  static async startCooking(restaurantId, orderId) {
    try {
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

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order cooking started: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Start cooking error:', error);
      throw error;
    }
  }

  static async completeOrder(restaurantId, orderId) {
    try {
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

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order completed: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Complete order error:', error);
      throw error;
    }
  }

  static async getOrderDetails(restaurantId, orderId) {
    try {
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

      if (error || !order) throw error || new Error('Order not found');

      // Add tableNumber for easier consumption
      return {
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
    } catch (error) {
      logger.error('❌ Get order details error:', error);
      throw error;
    }
  }

  static async getKitchenStats(restaurantId) {
    try {
      // Get pending count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Get in-progress count
      const { count: inProgressCount, error: inProgressError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'in_progress');

      if (inProgressError) throw inProgressError;

      return {
        pendingOrders: pendingCount || 0,
        inProgressOrders: inProgressCount || 0,
        totalQueue: (pendingCount || 0) + (inProgressCount || 0),
      };
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

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order marked as ready: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Mark order ready error:', error);
      throw error;
    }
  }

  static async getReadyOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          created_at,
          order_items (
            id,
            quantity,
            menu_item_id
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ready')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      return orders || [];
    } catch (error) {
      logger.error('❌ Get ready orders error:', error);
      throw error;
    }
  }

  static async getOrderHistory(restaurantId, limit = 50) {
    try {
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
        .limit(limit);

      if (error) throw error;

      return orders || [];
    } catch (error) {
      logger.error('❌ Get order history error:', error);
      throw error;
    }
  }
}

export default KitchenService;
