import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class TableService {
  // Helper function to transform snake_case to camelCase
  static transformTable(table) {
    if (!table) return null;
    return {
      id: table.id,
      tableNumber: table.table_number,
      seatCapacity: table.capacity,
      restaurantId: table.restaurant_id,
      location: table.location,
      status: table.status,
      reservedBy: table.reserved_by,
      reservationTime: table.reservation_time,
      qrCode: table.qr_code,
      qrCodeData: table.qr_code,
      isActive: table.is_active,
      createdAt: table.created_at,
      updatedAt: table.updated_at,
    };
  }

  static transformTables(tables) {
    if (!Array.isArray(tables)) return [];
    return tables.map(table => this.transformTable(table));
  }

  // ============ TABLES ============

  static async createTable(restaurantId, tableData) {
    try {
      logger.info(`📝 Creating table: ${tableData.tableNumber} with capacity ${tableData.seatCapacity} for restaurant ${restaurantId}`);
      
      const { data: table, error } = await supabase
        .from('tables')
        .insert([{
          restaurant_id: restaurantId,
          table_number: tableData.tableNumber,
          capacity: tableData.seatCapacity,
          location: tableData.location || 'main',
          status: 'available',
        }])
        .select()
        .single();

      if (error) {
        logger.error(`❌ Supabase insert error for table ${tableData.tableNumber}:`, error);
        throw error;
      }

      if (!table) {
        throw new Error('Failed to retrieve created table from database');
      }

      logger.info(`✅ Table created successfully: ID=${table.id}, Number=${tableData.tableNumber}`);
      return this.transformTable(table);
    } catch (error) {
      logger.error('❌ Create table error:', error.message);
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

      return this.transformTable(table);
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

      return this.transformTables(tables);
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
      return this.transformTable(table);
    } catch (error) {
      logger.error('❌ Update table status error:', error);
      throw error;
    }
  }

  static async updateTable(restaurantId, tableId, updateData) {
    try {
      const payload = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.tableNumber !== undefined) payload.table_number = updateData.tableNumber;
      if (updateData.seatCapacity !== undefined) payload.capacity = updateData.seatCapacity;
      if (updateData.location !== undefined) payload.location = updateData.location;
      if (updateData.status !== undefined) payload.status = updateData.status;
      if (updateData.reservedBy !== undefined) payload.reserved_by = updateData.reservedBy;
      if (updateData.reservationTime !== undefined) payload.reservation_time = updateData.reservationTime;

      const { data: table, error } = await supabase
        .from('tables')
        .update(payload)
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table updated: ${tableId}`);
      return this.transformTable(table);
    } catch (error) {
      logger.error('❌ Update table error:', error);
      throw error;
    }
  }

  static async deleteTable(restaurantId, tableId) {
    try {
      // Check if table has active orders
      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
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

      return this.transformTables(tables);
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table reserved: ${tableId}`);
      return this.transformTable(table);
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table released: ${tableId}`);
      return this.transformTable(table);
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

  // ============ ADDITIONAL METHODS FOR UNIFIED API ============

  static async getTables(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data: tables, error } = await query
        .order('table_number', { ascending: true });

      if (error) throw error;

      // Manual pagination if needed
      const skip = filters.skip || 0;
      const limit = filters.limit || 100;
      const paginatedTables = tables?.slice(skip, skip + limit) || [];

      logger.info(`📊 Retrieved ${paginatedTables?.length || 0} tables for restaurant ${restaurantId}`);

      return {
        tables: this.transformTables(paginatedTables),
        total: tables?.length || 0,
        limit: limit,
        skip: skip,
      };
    } catch (error) {
      logger.error('❌ Get tables error:', error);
      throw error;
    }
  }

  static async createMultipleTables(restaurantId, tables) {
    try {
      const tablesToInsert = tables.map(table => ({
        restaurant_id: restaurantId,
        table_number: table.tableNumber,
        capacity: table.seatCapacity,
        location: table.location || 'main',
        status: 'available',
      }));

      const { data: createdTables, error } = await supabase
        .from('tables')
        .insert(tablesToInsert)
        .select();

      if (error) throw error;

      logger.info(`✅ ${createdTables?.length || 0} tables created`);
      return this.transformTables(createdTables);
    } catch (error) {
      logger.error('❌ Create multiple tables error:', error);
      throw error;
    }
  }

  static async getTableByQRCode(restaurantId, qrCode) {
    try {
      const { data: table, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('qr_code', qrCode)
        .single();

      if (error || !table) throw error || new Error('Table not found');

      return this.transformTable(table);
    } catch (error) {
      logger.error('❌ Get table by QR code error:', error);
      throw error;
    }
  }

  static async generateQRUrl(restaurantId, tableId) {
    try {
      const table = await this.getTableById(restaurantId, tableId);
      
      // Generate QR code URL - you can use a service like qr-server.com
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=restaurant:${restaurantId}/table:${tableId}`;

      // Update table with QR code
      const { data: updatedTable, error } = await supabase
        .from('tables')
        .update({ qr_code: `restaurant:${restaurantId}/table:${tableId}` })
        .eq('id', tableId)
        .select()
        .single();

      if (error) throw error;

      return {
        tableId,
        tableNumber: table.tableNumber,
        qrCodeUrl,
        qrCode: `restaurant:${restaurantId}/table:${tableId}`,
      };
    } catch (error) {
      logger.error('❌ Generate QR URL error:', error);
      throw error;
    }
  }
}

export default TableService;
