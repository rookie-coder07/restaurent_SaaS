import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { cacheManager } from '../utils/cacheManager.js';

const TABLE_CACHE_TTL = 300;
const TABLES_LIST_CACHE_TTL = 600;

export class TableService {
  // ============ TABLES ============

  static async createTable(restaurantId, tableData) {
    try {
      if (!restaurantId) return null;
      if (!tableData) return null;
      if (!tableData.tableNumber) return null;
      if (!tableData.capacity) return null;
      
      const { data: table, error } = await supabase
        .from('tables')
        .insert([{
          restaurant_id: restaurantId,
          table_number: tableData.tableNumber,
          capacity: tableData.capacity,
          location: tableData?.location || 'main',
          status: 'available',
        }])
        .select()
        .single();

      if (error || !table) return null;

      logger.info(`✅ Table created: ${table.id}`);
      return table;
    } catch (error) {
      logger.error('❌ Create table error:', error);
      throw error;
    }
  }

  static async getTableById(restaurantId, tableId) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      
      const cacheKey = `table:${tableId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: table, error } = await supabase
        .from('tables')
        .select('id, restaurant_id, table_number, capacity, location, status, created_at, updated_at')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !table) return null;

      cacheManager.set(cacheKey, table, TABLE_CACHE_TTL);
      return table;
    } catch (error) {
      logger.error('❌ Get table error:', error);
      throw error;
    }
  }

  static async getTablesByRestaurant(restaurantId, filters = {}) {
    try {
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      
      const cacheKey = `tables:${restaurantId}:${filters.status || 'all'}:${limit}:${offset}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('tables')
        .select('id, restaurant_id, table_number, capacity, location, status, created_at, updated_at')
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.location) {
        query = query.eq('location', filters.location);
      }

      const { data: tables, error } = await query
        .order('table_number', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const result = tables || [];
      cacheManager.set(cacheKey, result, TABLES_LIST_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get tables error:', error);
      throw error;
    }
  }

  static async updateTableStatus(restaurantId, tableId, status) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      if (!status) return null;
      
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          status: status,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select('id, restaurant_id, table_number, capacity, location, status, updated_at')
        .single();

      if (error || !table) return null;

      cacheManager.delete(`table:${tableId}`);
      cacheManager.delete(`tables:${restaurantId}:all:50:0`);
      cacheManager.delete(`tables:${restaurantId}:${status}:50:0`);

      logger.info(`✅ Table status updated: ${tableId} → ${status}`);
      return table;
    } catch (error) {
      logger.error('❌ Update table status error:', error);
      throw error;
    }
  }

  static async updateTable(restaurantId, tableId, updateData) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      if (!updateData) return null;
      
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          table_number: updateData?.tableNumber || null,
          capacity: updateData?.capacity || null,
          location: updateData?.location || 'main',
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) return null;

      logger.info(`✅ Table updated: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Update table error:', error);
      throw error;
    }
  }

  static async deleteTable(restaurantId, tableId) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      
      // Check if table has active orders (excluding soft-deleted)
      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('is_deleted', false)
        .neq('status', 'completed');

      if (countError) return null;

      if (count > 0) {
        return null;
      }

      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId);

      if (error) return null;

      logger.info(`✅ Table deleted: ${tableId}`);
      return { message: 'Table deleted successfully' };
    } catch (error) {
      logger.error('❌ Delete table error:', error);
      throw error;
    }
  }

  static async getAvailableTables(restaurantId, capacity = null) {
    try {
      const cacheKey = `available_tables:${restaurantId}:${capacity || 'any'}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      let query = supabase
        .from('tables')
        .select('id, table_number, capacity, location, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available');

      if (capacity) {
        query = query.gte('capacity', capacity);
      }

      const { data: tables, error } = await query.order('table_number', { ascending: true });

      if (error) throw error;

      const result = tables || [];
      cacheManager.set(cacheKey, result, TABLE_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get available tables error:', error);
      throw error;
    }
  }

  static async reserveTable(restaurantId, tableId, reservationData) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      if (!reservationData) return null;
      
      const { data: table, error } = await supabase
        .from('tables')
        .update({
          status: 'reserved',
          reserved_by: reservationData?.reservedBy || null,
          reservation_time: reservationData?.reservationTime || null,
          updated_at: new Date(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) return null;

      logger.info(`✅ Table reserved: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Reserve table error:', error);
      throw error;
    }
  }

  static async releaseTable(restaurantId, tableId) {
    try {
      if (!restaurantId) return null;
      if (!tableId) return null;
      
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

      if (error || !table) return null;

      logger.info(`✅ Table released: ${tableId}`);
      return table;
    } catch (error) {
      logger.error('❌ Release table error:', error);
      throw error;
    }
  }

  static async getTableStatus(restaurantId) {
    try {
      const cacheKey = `table_status:${restaurantId}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      // Batch query instead of fetching all then filtering
      const { data: available } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available');

      const { data: occupied } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'occupied');

      const { data: reserved } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'reserved');

      const { count: total } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId);

      const stats = {
        total: total || 0,
        available: available?.length || 0,
        occupied: occupied?.length || 0,
        reserved: reserved?.length || 0,
      };

      cacheManager.set(cacheKey, stats, TABLE_CACHE_TTL);
      return stats;
    } catch (error) {
      logger.error('❌ Get table status error:', error);
      throw error;
    }
  }
}

export default TableService;
