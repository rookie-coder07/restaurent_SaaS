import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class OrderService {
  // Helper function to transform snake_case to camelCase
  static transformOrder(order) {
    if (!order) return null;
    return {
      id: order.id,
      restaurantId: order.restaurant_id,
      tableId: order.table_id,
      status: order.status,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      orderItems: order.order_items?.map(item => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })) || [],
    };
  }

  static transformOrders(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.map(order => this.transformOrder(order));
  }

  // ============ ORDERS ============

  static async createOrder(restaurantId, orderData) {
    try {
      // If restaurantId is not provided, look it up from the table
      let finalRestaurantId = restaurantId;
      if (!finalRestaurantId && orderData.tableId) {
        const { data: table, error: tableError } = await supabase
          .from('tables')
          .select('restaurant_id')
          .eq('id', orderData.tableId)
          .single();

        if (tableError || !table) {
          throw new Error('Table not found or invalid table ID');
        }

        finalRestaurantId = table.restaurant_id;
      }

      if (!finalRestaurantId) {
        throw new Error('Restaurant ID is required or table ID must be provided');
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: finalRestaurantId,
          table_id: orderData.tableId,
          status: 'pending',
          total_amount: orderData.totalAmount || 0,
          payment_method: orderData.paymentMethod || 'cash',
          notes: orderData.notes || '',
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Order created: ${order.id}`);

      // If items are provided, add them to the order
      if (orderData.items && orderData.items.length > 0) {
        await this.addOrderItems(order.id, orderData.items);
      }

      // Fetch and return the complete order with items
      const completeOrder = await this.getOrderById(finalRestaurantId, order.id);
      
      return completeOrder;
    } catch (error) {
      logger.error('❌ Create order error:', error);
      throw error;
    }
  }

  static async addOrderItems(orderId, items) {
    try {
      const itemsToInsert = items.map(item => ({
        order_id: orderId,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { data: orderItems, error } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select();

      if (error) throw error;

      logger.info(`✅ ${items.length} items added to order ${orderId}`);
      return orderItems;
    } catch (error) {
      logger.error('❌ Add order items error:', error);
      throw error;
    }
  }

  static async getOrderById(restaurantId, orderId) {
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

      // Transform and include table information
      const transformedOrder = this.transformOrder(order);
      return {
        ...transformedOrder,
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
    } catch (error) {
      logger.error('❌ Get order error:', error);
      throw error;
    }
  }

  static async getOrdersByRestaurant(restaurantId, filters = {}) {
    try {
      let query = supabase
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

      const { data: orders, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }

  static async updateOrderStatus(restaurantId, orderId, newStatus) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order status updated: ${orderId} → ${newStatus}`);
      return this.transformOrder(order);
    } catch (error) {
      logger.error('❌ Update order status error:', error);
      throw error;
    }
  }

  static async updateOrderPayment(restaurantId, orderId, paymentData) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          payment_method: paymentData.method,
          payment_status: paymentData.status,
          total_amount: paymentData.amount,
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order payment updated: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Update payment error:', error);
      throw error;
    }
  }

  static async updateOrderItem(restaurantId, orderItemId, quantity) {
    try {
      const { data: orderItem, error } = await supabase
        .from('order_items')
        .update({ quantity })
        .eq('id', orderItemId)
        .select()
        .single();

      if (error || !orderItem) throw error || new Error('Order item not found');

      return orderItem;
    } catch (error) {
      logger.error('❌ Update order item error:', error);
      throw error;
    }
  }

  static async removeOrderItem(restaurantId, orderItemId) {
    try {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (error) throw error;

      logger.info(`✅ Order item removed: ${orderItemId}`);
      return { message: 'Item removed successfully' };
    } catch (error) {
      logger.error('❌ Remove order item error:', error);
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

  static async cancelOrder(restaurantId, orderId) {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order cancelled: ${orderId}`);
      return order;
    } catch (error) {
      logger.error('❌ Cancel order error:', error);
      throw error;
    }
  }

  static async getOrdersByStatus(restaurantId, status) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return orders || [];
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

  // ============ ADDITIONAL METHODS FOR UNIFIED API ============

  static async getOrders(restaurantId, filters = {}) {
    try {
      let query = supabase
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
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.tableNumber) {
        query = query.eq('table_number', filters.tableNumber);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .gte('created_at', filters.startDate)
          .lte('created_at', filters.endDate);
      }

      const { data: orders, error } = await query
        .order('created_at', { ascending: false })
        .range(filters.skip || 0, (filters.skip || 0) + (filters.limit || 50) - 1);

      if (error) throw error;

      // Transform to include tableNumber
      const transformedOrders = (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));

      return {
        items: transformedOrders,
        total: transformedOrders?.length || 0,
        limit: filters.limit || 50,
        skip: filters.skip || 0,
      };
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }

  static async getKitchenOrders(restaurantId, filters = {}) {
    try {
      const statuses = filters.statuses || ['pending', 'preparing'];
      
      let query = supabase
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
        .eq('restaurant_id', restaurantId)
        .in('status', statuses)
        .order('created_at', { ascending: true });

      const { data: orders, error } = await query;

      if (error) throw error;

      // Transform to include tableNumber for easier consumption
      return (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
    } catch (error) {
      logger.error('❌ Get kitchen orders error:', error);
      throw error;
    }
  }

  static async getDailyRevenue(restaurantId, date) {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const totalRevenue = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

      return {
        date,
        totalRevenue,
        orderCount: orders?.length || 0,
        averageOrderValue: orders?.length ? totalRevenue / orders.length : 0,
      };
    } catch (error) {
      logger.error('❌ Get daily revenue error:', error);
      throw error;
    }
  }

  static async getMonthlyRevenue(restaurantId, startDate, endDate) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, status, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const totalRevenue = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

      return {
        startDate,
        endDate,
        totalRevenue,
        orderCount: orders?.length || 0,
        averageOrderValue: orders?.length ? totalRevenue / orders.length : 0,
        orders: orders || [],
      };
    } catch (error) {
      logger.error('❌ Get monthly revenue error:', error);
      throw error;
    }
  }

  static async getMostSoldItems(restaurantId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          orders (
            restaurant_id,
            created_at
          )
        `)
        .eq('orders.restaurant_id', restaurantId)
        .gte('orders.created_at', startDate.toISOString());

      if (error) throw error;

      // Group by menu_item_id and sum quantities
      const itemMap = new Map();
      (orderItems || []).forEach(item => {
        const key = item.menu_item_id;
        itemMap.set(key, (itemMap.get(key) || 0) + item.quantity);
      });

      // Sort and return top items
      const topItems = Array.from(itemMap.entries())
        .map(([itemId, quantity]) => ({
          menuItemId: itemId,
          totalQuantity: quantity,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);

      return topItems;
    } catch (error) {
      logger.error('❌ Get most sold items error:', error);
      throw error;
    }
  }
}

export default OrderService;
