import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export class TableService {
  static ACTIVE_ORDER_STATUSES = ['awaiting_waiter_approval', 'pending', 'preparing', 'ready'];

  static normalizeTableNumber(value) {
    return String(value ?? '').trim();
  }

  static compareTableNumbers(left, right) {
    return this.normalizeTableNumber(left).localeCompare(this.normalizeTableNumber(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  // Helper function to transform snake_case to camelCase
  static transformTable(table) {
    if (!table) return null;
    return {
      id: table.id,
      tableNumber: this.normalizeTableNumber(table.table_number),
      seatCapacity: table.capacity,
      restaurantId: table.restaurant_id,
      location: table.location,
      status: table.status,
      lockedByQr: Boolean(table.locked_by_qr),
      reservedBy: table.reserved_by,
      reservationTime: table.reservation_time,
      assignedTo: table.assigned_to || '',
      assignedWaiterName: table.assigned_waiter_name || table.assignedWaiterName || '',
      qrCode: table.qr_code,
      qrCodeData: table.qr_code,
      isActive: table.is_active,
      createdAt: table.created_at,
      updatedAt: table.updated_at,
    };
  }

  static transformTables(tables) {
    if (!Array.isArray(tables)) return [];
    return tables
      .map((table) => this.transformTable(table))
      .sort((left, right) => this.compareTableNumbers(left.tableNumber, right.tableNumber));
  }

  static getEffectiveStatus(table, hasActiveOrder = false) {
    if (table.locked_by_qr) {
      return 'occupied';
    }

    if (hasActiveOrder) {
      return 'occupied';
    }

    if (table.status === 'closed') {
      return 'closed';
    }

    if (table.reserved_by || table.reservedBy || table.status === 'reserved') {
      return 'reserved';
    }

    return 'available';
  }

  static getNormalizedOrderSource(order = {}) {
    if (String(order.order_source || '').trim()) {
      return String(order.order_source).trim().toLowerCase() === 'qr' ? 'qr' : 'manual';
    }

    const notes = String(order.notes || '');
    return notes.includes('"orderOrigin":"qr"') ? 'qr' : 'manual';
  }

  static async getActiveTableStates(restaurantId) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('table_id, order_source, notes')
      .eq('restaurant_id', restaurantId)
      .neq('payment_status', 'paid')
      .in('status', this.ACTIVE_ORDER_STATUSES);

    if (error) {
      throw error;
    }

    const tableStates = new Map();

    (orders || []).forEach((order) => {
      if (!order.table_id) {
        return;
      }

      const current = tableStates.get(order.table_id) || {
        hasActiveOrder: false,
        hasQrOrder: false,
      };

      current.hasActiveOrder = true;
      current.hasQrOrder = current.hasQrOrder || this.getNormalizedOrderSource(order) === 'qr';
      tableStates.set(order.table_id, current);
    });

    return tableStates;
  }

  static async getAssignedWaiterIdForTable(restaurantId, tableId) {
    if (!restaurantId || !tableId) {
      return '';
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, assigned_tables')
      .eq('restaurant_id', restaurantId)
      .eq('role', 'staff');

    if (error) {
      throw error;
    }

    const assignedWaiter = (users || []).find((user) => Array.isArray(user.assigned_tables) && user.assigned_tables.includes(tableId));
    return assignedWaiter?.id || '';
  }

  static async attachAssignedWaiterNames(restaurantId, tables = []) {
    const assignedWaiterIds = Array.from(
      new Set((tables || []).map((table) => table.assigned_to).filter(Boolean))
    );

    if (assignedWaiterIds.length === 0) {
      return tables;
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
      .in('id', assignedWaiterIds);

    if (error) {
      throw error;
    }

    const waiterNameById = new Map((users || []).map((user) => [user.id, user.name || '']));

    return (tables || []).map((table) => ({
      ...table,
      assigned_waiter_name: table.assigned_waiter_name || waiterNameById.get(table.assigned_to) || '',
    }));
  }

  static async syncTableLifecycle(restaurantId, tableId) {
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      throw tableError || new Error('Table not found');
    }

    const activeTableStates = await this.getActiveTableStates(restaurantId);
    const tableState = activeTableStates.get(tableId) || { hasActiveOrder: false, hasQrOrder: false };
    const hasActiveOrder = tableState.hasActiveOrder;
    const hasQrOrder = tableState.hasQrOrder;
    const nextStatus = this.getEffectiveStatus(table, hasActiveOrder);
    const shouldClearReservation = hasActiveOrder || nextStatus === 'available';
    const qrAssignedWaiterId = hasQrOrder ? await this.getAssignedWaiterIdForTable(restaurantId, tableId) : '';
    const nextAssignedTo = hasQrOrder ? (qrAssignedWaiterId || table.assigned_to || null) : null;
    const nextLockedByQr = hasQrOrder;
    const nextAssignmentType =
      Object.prototype.hasOwnProperty.call(table, 'assignment_type')
        ? (hasQrOrder ? 'qr' : 'manual')
        : undefined;
    const needsUpdate =
      table.status !== nextStatus ||
      Boolean(table.locked_by_qr) !== nextLockedByQr ||
      (shouldClearReservation && (table.reserved_by || table.reservation_time)) ||
      String(table.assigned_to || '') !== String(nextAssignedTo || '') ||
      (nextAssignmentType !== undefined && String(table.assignment_type || '') !== String(nextAssignmentType || ''));

    if (!needsUpdate) {
      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [table]);
      return this.transformTable(enrichedTable);
    }

    const updatePayload = {
      status: nextStatus,
      reserved_by: shouldClearReservation ? null : table.reserved_by,
      reservation_time: shouldClearReservation ? null : table.reservation_time,
      assigned_to: nextAssignedTo,
      locked_by_qr: nextLockedByQr,
      updated_at: new Date().toISOString(),
    };

    if (nextAssignmentType !== undefined) {
      updatePayload.assignment_type = nextAssignmentType;
    }

    const { data: updatedTable, error: updateError } = await supabase
      .from('tables')
      .update(updatePayload)
      .eq('id', tableId)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (updateError || !updatedTable) {
      throw updateError || new Error('Failed to sync table lifecycle');
    }

    const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [updatedTable]);
    return this.transformTable(enrichedTable);
  }

  static async syncRestaurantTableLifecycles(restaurantId) {
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (tablesError) {
      throw tablesError;
    }

    if (!tables || tables.length === 0) {
      return [];
    }

    const activeTableStates = await this.getActiveTableStates(restaurantId);
    const updates = tables
      .map((table) => {
        const tableState = activeTableStates.get(table.id) || { hasActiveOrder: false, hasQrOrder: false };
        const hasActiveOrder = tableState.hasActiveOrder;
        const hasQrOrder = tableState.hasQrOrder;
        const nextStatus = this.getEffectiveStatus(table, hasActiveOrder);
        const shouldClearReservation = hasActiveOrder || nextStatus === 'available';
        const desiredLockedByQr = hasQrOrder;
        const desiredAssignmentType =
          Object.prototype.hasOwnProperty.call(table, 'assignment_type')
            ? (hasQrOrder ? 'qr' : 'manual')
            : undefined;

        return (async () => {
          const nextAssignedTo = hasQrOrder
            ? (await this.getAssignedWaiterIdForTable(restaurantId, table.id)) || table.assigned_to || null
            : null;
          const needsUpdate =
            table.status !== nextStatus ||
            Boolean(table.locked_by_qr) !== desiredLockedByQr ||
            (shouldClearReservation && (table.reserved_by || table.reservation_time)) ||
            String(table.assigned_to || '') !== String(nextAssignedTo || '') ||
            (desiredAssignmentType !== undefined && String(table.assignment_type || '') !== String(desiredAssignmentType || ''));

          if (!needsUpdate) {
            return;
          }

          const updatePayload = {
            status: nextStatus,
            reserved_by: shouldClearReservation ? null : table.reserved_by,
            reservation_time: shouldClearReservation ? null : table.reservation_time,
            assigned_to: nextAssignedTo,
            locked_by_qr: desiredLockedByQr,
            updated_at: new Date().toISOString(),
          };

          if (desiredAssignmentType !== undefined) {
            updatePayload.assignment_type = desiredAssignmentType;
          }

          const { error: updateError } = await supabase
            .from('tables')
            .update(updatePayload)
            .eq('id', table.id)
            .eq('restaurant_id', restaurantId);

          if (updateError) {
            throw updateError;
          }
        })();
      })
      .filter(Boolean);

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return tables;
  }

  // ============ TABLES ============

  static async createTable(restaurantId, tableData) {
    try {
      logger.info(`📝 Creating table: ${tableData.tableNumber} with capacity ${tableData.seatCapacity} for restaurant ${restaurantId}`);
      
      const { data: table, error } = await supabase
        .from('tables')
        .insert([{
          restaurant_id: restaurantId,
          table_number: this.normalizeTableNumber(tableData.tableNumber),
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
      return await this.syncTableLifecycle(restaurantId, table.id);
    } catch (error) {
      logger.error('❌ Create table error:', error.message);
      throw error;
    }
  }

  static async getTableById(restaurantId, tableId) {
    try {
      await this.syncTableLifecycle(restaurantId, tableId);

      const { data: table, error } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !table) throw error || new Error('Table not found');

      return await this.syncTableLifecycle(restaurantId, tableId);
    } catch (error) {
      logger.error('❌ Get table error:', error);
      throw error;
    }
  }

  static async getTablesByRestaurant(restaurantId, filters = {}) {
    try {
      await this.syncRestaurantTableLifecycles(restaurantId);

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

      const { data: tables, error } = await query;

      if (error) throw error;

      return this.transformTables(await this.attachAssignedWaiterNames(restaurantId, tables));
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
      return await this.syncTableLifecycle(restaurantId, tableId);
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

      if (updateData.tableNumber !== undefined) payload.table_number = this.normalizeTableNumber(updateData.tableNumber);
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
      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [table]);
      return this.transformTable(enrichedTable);
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
        .in('status', this.ACTIVE_ORDER_STATUSES);

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
      await this.syncRestaurantTableLifecycles(restaurantId);

      let query = supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available');

      if (capacity) {
        query = query.gte('capacity', capacity);
      }

      const { data: tables, error } = await query;

      if (error) throw error;

      return this.transformTables(await this.attachAssignedWaiterNames(restaurantId, tables));
    } catch (error) {
      logger.error('❌ Get available tables error:', error);
      throw error;
    }
  }

  static async reserveTable(restaurantId, tableId, reservationData) {
    try {
      const { count, error: activeOrderError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .in('status', this.ACTIVE_ORDER_STATUSES);

      if (activeOrderError) throw activeOrderError;

      if ((count || 0) > 0) {
        throw new Error('Cannot reserve a table that already has an active order');
      }

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
      const { count, error: activeOrderError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .in('status', this.ACTIVE_ORDER_STATUSES);

      if (activeOrderError) throw activeOrderError;

      const { data: existingTable, error: tableFetchError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (tableFetchError || !existingTable) {
        throw tableFetchError || new Error('Table not found');
      }

      const updatePayload = {
        status: count > 0 ? 'occupied' : 'available',
        assigned_to: null,
        locked_by_qr: false,
        reserved_by: null,
        reservation_time: null,
        updated_at: new Date().toISOString(),
      };

      if (Object.prototype.hasOwnProperty.call(existingTable, 'assignment_type')) {
        updatePayload.assignment_type = 'manual';
      }

      const { data: table, error } = await supabase
        .from('tables')
        .update(updatePayload)
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !table) throw error || new Error('Table not found');

      logger.info(`✅ Table released: ${tableId}`);
      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [table]);
      return this.transformTable(enrichedTable);
    } catch (error) {
      logger.error('❌ Release table error:', error);
      throw error;
    }
  }

  static async getTableStatus(restaurantId) {
    try {
      await this.syncRestaurantTableLifecycles(restaurantId);

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
        closed: statuses?.filter(t => t.status === 'closed').length || 0,
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
      await this.syncRestaurantTableLifecycles(restaurantId);

      let query = supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data: tables, error } = await query;

      if (error) throw error;

      // Manual pagination if needed
      const skip = filters.skip || 0;
      const limit = filters.limit || 100;
      const enrichedTables = await this.attachAssignedWaiterNames(restaurantId, tables || []);
      const paginatedTables = enrichedTables?.slice(skip, skip + limit) || [];

      logger.info(`📊 Retrieved ${paginatedTables?.length || 0} tables for restaurant ${restaurantId}`);

      return {
        tables: this.transformTables(paginatedTables),
        total: enrichedTables?.length || 0,
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
        table_number: this.normalizeTableNumber(table.tableNumber),
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

      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [table]);
      return this.transformTable(enrichedTable);
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

  static async claimTable(restaurantId, tableId, waiterId) {
    try {
      const { data: existingTable, error: existingTableError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingTableError || !existingTable) {
        throw existingTableError || new Error('Table not found');
      }

      if (!existingTable.locked_by_qr) {
        const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [existingTable]);
        return this.transformTable(enrichedTable);
      }

      if (existingTable.assigned_to && existingTable.assigned_to === waiterId) {
        const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [existingTable]);
        return this.transformTable(enrichedTable);
      }

      if (existingTable.assigned_to && existingTable.assigned_to !== waiterId) {
        throw new Error('This QR table is locked to another waiter');
      }

      if (String(existingTable.status || '').toLowerCase() !== 'occupied') {
        const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [existingTable]);
        return this.transformTable(enrichedTable);
      }

      const { data: claimedTable, error: claimError } = await supabase
        .from('tables')
        .update({
          assigned_to: waiterId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .eq('locked_by_qr', true)
        .or(`assigned_to.is.null,assigned_to.eq.${waiterId}`)
        .select()
        .single();

      if (!claimError && claimedTable) {
        const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [claimedTable]);
        return this.transformTable(enrichedTable);
      }

      const { data: latestTable, error: latestTableError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (latestTableError || !latestTable) {
        throw latestTableError || new Error('Table not found');
      }

      if (latestTable.assigned_to === waiterId) {
        const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [latestTable]);
        return this.transformTable(enrichedTable);
      }

      throw new Error('This QR table is locked to another waiter');
    } catch (error) {
      logger.error('Claim table error:', error);
      throw error;
    }
  }
}

export default TableService;
