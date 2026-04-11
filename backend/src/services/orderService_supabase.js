import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { cacheManager } from '../utils/cacheManager.js';

const ORDER_CACHE_TTL = 60;
const ORDER_LIST_CACHE_TTL = 120;

export class OrderService {
  // ============ ORDERS ============

  static async createOrder(restaurantId, orderData) {
    try {
      if (!restaurantId) return null;
      if (!orderData) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: restaurantId,
          table_id: orderData?.tableId || null,
          status: 'pending',
          total_amount: orderData?.totalAmount || 0,
          payment_method: orderData?.paymentMethod || 'cash',
          notes: orderData?.notes || '',
        }])
        .select()
        .single();

      if (error || !order) return null;

      logger.info(`✅ Order created: ${order.id}`);
      return order;
    } catch (error) {
      logger.error('❌ Create order error:', error);
      throw error;
    }
  }

  static async addOrderItems(orderId, items) {
    try {
      if (!orderId) return null;
      if (!items || !Array.isArray(items) || items.length === 0) return null;
      
      const itemsToInsert = items.map(item => ({
        order_id: orderId,
        menu_item_id: item?.menuItemId || null,
        quantity: item?.quantity || 0,
        unit_price: item?.unitPrice || 0,
      })).filter(item => item.menu_item_id);

      if (itemsToInsert.length === 0) return null;

      const { data: orderItems, error } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select();

      if (error || !orderItems) return null;

      logger.info(`✅ ${items.length} items added to order ${orderId}`);
      return orderItems;
    } catch (error) {
      logger.error('❌ Add order items error:', error);
      throw error;
    }
  }

  static async getOrderById(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const cacheKey = `order:${orderId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          total_amount,
          payment_method,
          notes,
          created_at,
          updated_at,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            id,
            table_number
          )
        `)
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !order) return null;

      const result = {
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };

      cacheManager.set(cacheKey, result, ORDER_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get order error:', error);
      throw error;
    }
  }

  static async getOrdersByRestaurant(restaurantId, filters = {}) {
    try {
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      
      const cacheKey = `orders:${restaurantId}:${filters.status || 'all'}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          total_amount,
          payment_method,
          created_at,
          updated_at,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          ),
          tables!table_id (
            id,
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.tableId) {
        query = query.eq('table_id', filters.tableId);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .gte('created_at', filters.startDate)
          .lte('created_at', filters.endDate);
      }

      const { data: orders, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = (orders || []).map(order => ({
        ...order,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));

      cacheManager.set(cacheKey, result, ORDER_LIST_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }

  static async updateOrderStatus(restaurantId, orderId, newStatus) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      if (!newStatus) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select('id, status, table_id, total_amount, created_at, updated_at')
        .single();

      if (error || !order) return null;

      // Invalidate caches
      cacheManager.delete(`order:${orderId}`);
      cacheManager.delete(`orders:${restaurantId}:all:20:0`);
      cacheManager.delete(`orders:${restaurantId}:${newStatus}:50:0`);

      logger.info(`✅ Order status updated: ${orderId} → ${newStatus}`);
      return order;
    } catch (error) {
      logger.error('❌ Update order status error:', error);
      throw error;
    }
  }

  static async updateOrderPayment(restaurantId, orderId, paymentData) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      if (!paymentData) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          payment_method: paymentData?.method || 'cash',
          payment_status: paymentData?.status || 'pending',
          total_amount: paymentData?.amount || 0,
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) return null;

      logger.info(`✅ Order payment updated: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Update payment error:', error);
      throw error;
    }
  }

  static async updateOrderItem(restaurantId, orderItemId, quantity) {
    try {
      if (!orderItemId) return null;
      if (quantity === undefined || quantity === null) return null;
      
      const { data: orderItem, error } = await supabase
        .from('order_items')
        .update({ quantity })
        .eq('id', orderItemId)
        .select()
        .single();

      if (error || !orderItem) return null;

      return orderItem;
    } catch (error) {
      logger.error('❌ Update order item error:', error);
      throw error;
    }
  }

  static async removeOrderItem(restaurantId, orderItemId) {
    try {
      if (!orderItemId) return null;
      
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (error) return null;

      logger.info(`✅ Order item removed: ${orderItemId}`);
      return { message: 'Item removed successfully' };
    } catch (error) {
      logger.error('❌ Remove order item error:', error);
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
        .select('id, status, table_id, created_at, updated_at')
        .single();

      if (error || !order) return null;

      cacheManager.delete(`order:${orderId}`);
      cacheManager.delete(`orders:${restaurantId}:all:20:0`);

      logger.info(`✅ Order completed: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Complete order error:', error);
      throw error;
    }
  }

  static async cancelOrder(restaurantId, orderId) {
    try {
      if (!restaurantId) return null;
      if (!orderId) return null;
      
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select('id, status, table_id, created_at, updated_at')
        .single();

      if (error || !order) return null;

      cacheManager.delete(`order:${orderId}`);
      cacheManager.delete(`orders:${restaurantId}:all:20:0`);

      logger.info(`✅ Order cancelled: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Cancel order error:', error);
      throw error;
    }
  }

  static async getOrdersByStatus(restaurantId, status, limit = 50, offset = 0) {
    try {
      const cacheKey = `orders:status:${restaurantId}:${status}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          table_id,
          status,
          total_amount,
          created_at,
          updated_at,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = orders || [];
      cacheManager.set(cacheKey, result, ORDER_LIST_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get orders by status error:', error);
      throw error;
    }
  }

  static async getOrderStats(restaurantId) {
    try {
      const { data: stats, error } = await supabase
        .rpc('get_order_stats', { p_restaurant_id: restaurantId });

      if (error) throw error;

      return stats;
    } catch (error) {
      logger.error('❌ Get order stats error:', error);
      // Return fallback stats if RPC fails
      return {
        total_orders: 0,
        pending_count: 0,
        completed_count: 0,
        total_revenue: 0,
      };
    }
  }
}

export default OrderService;
