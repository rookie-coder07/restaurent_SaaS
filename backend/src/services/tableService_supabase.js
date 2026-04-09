import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class TableService {
  // ============ TABLES ============

  static async createTable(restaurantId, tableData) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .insert([{
          restaurant_id: restaurantId,
          table_number: tableData.tableNumber,
          capacity: tableData.capacity,
          location: tableData.location || 'main',
          status: 'available',
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Table created: ${table.id}`);
      return table;
    } catch (error) {
      logger.error('❌ Create table error:', error);
      throw error;
    }
  }

  static async getTableById(restaurantId, tableId) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !table) throw error || new Error('Table not found');

      return table;
    } catch (error) {
      logger.error('❌ Get table error:', error);
      throw error;
    }
  }

  static async getTablesByRestaurant(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.location) {
        query = query.eq('location', filters.location);
      }

      const { data: tables, error } = await query.order('table_number', { ascending: true });

      if (error) throw error;

      return tables || [];
    } catch (error) {
      logger.error('❌ Get tables error:', error);
      throw error;
    }
  }

  static async updateTableStatus(restaurantId, tableId, status) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          status: status,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table status updated: ${tableId} → ${status}`);
      return table;
    } catch (error) {
      logger.error('❌ Update table status error:', error);
      throw error;
    }
  }

  static async updateTable(restaurantId, tableId, updateData) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          table_number: updateData.tableNumber,
          capacity: updateData.capacity,
          location: updateData.location,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table updated: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Update table error:', error);
      throw error;
    }
  }

  static async deleteTable(restaurantId, tableId) {
    try {
      // Check if table has active orders (excluding soft-deleted)
      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('is_deleted', false)
        .neq('status', 'completed');

      if (countError) throw countError;

      if (count > 0) {
        throw new Error('Cannot delete table with active orders');
      }

      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      logger.info(`✅ Table deleted: ${tableId}`);
      return { message: 'Table deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete table error:', error);
      throw error;
    }
  }

  static async getAvailableTables(restaurantId, capacity = null) {
    try {
      let query = supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available');

      if (capacity) {
        query = query.gte('capacity', capacity);
      }

      const { data: tables, error } = await query.order('table_number', { ascending: true });

      if (error) throw error;

      return tables || [];
    } catch (error) {
      logger.error('❌ Get available tables error:', error);
      throw error;
    }
  }

  static async reserveTable(restaurantId, tableId, reservationData) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          status: 'reserved',
          reserved_by: reservationData.reservedBy,
          reservation_time: reservationData.reservationTime,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table reserved: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Reserve table error:', error);
      throw error;
    }
  }

  static async releaseTable(restaurantId, tableId) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          status: 'available',
          reserved_by: null,
          reservation_time: null,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table released: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Release table error:', error);
      throw error;
    }
  }

  static async getTableStatus(restaurantId) {
    try {
      const { data: statuses, error } = await supabase
        .from('tables')
        .select('status')
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      const stats = {
        total: statuses?.length || 0,
        available: statuses?.filter(t => t.status === 'available').length || 0,
        occupied: statuses?.filter(t => t.status === 'occupied').length || 0,
        reserved: statuses?.filter(t => t.status === 'reserved').length || 0,
      };

      return stats;
    } catch (error) {
      logger.error('❌ Get table status error:', error);
      throw error;
    }
  }
}

export default TableService;
