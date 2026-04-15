import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { broadcastRestaurantEvent } from '../utils/realtimeEvents.js';

export class TableService {
  static ACTIVE_ORDER_STATUSES = ['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress'];
  
  // ✅ OPTIMIZATION: Cache for getActiveTableStates with 5 second TTL
  static activeTableStateCache = new Map();
  static ACTIVE_TABLE_STATE_CACHE_TTL_MS = 5000; // 5 seconds

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
      lockedByQr: false,
      reservedBy: table.reserved_by,
      reservationTime: table.reservation_time,
      assignedTo: table.assigned_to || '',
      assignedWaiterName: table.assignedWaiterName || '',
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
    // ✅ OPTIMIZATION: Check cache first (5 second TTL)
    const cacheKey = `table_states:${restaurantId}`;
    const cachedEntry = this.activeTableStateCache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return cachedEntry.value;
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('table_id, order_source, notes')
      .eq('restaurant_id', restaurantId)
      .eq('is_deleted', false) // ✅ FIXED: Exclude deleted orders
      .eq('is_archived', false)
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

    // ✅ OPTIMIZATION: Cache the result
    this.activeTableStateCache.set(cacheKey, {
      value: tableStates,
      expiresAt: now + this.ACTIVE_TABLE_STATE_CACHE_TTL_MS,
    });

    return tableStates;
  }

  // ✅ OPTIMIZATION: Invalidate table state cache when orders change
  static invalidateActiveTableStateCache(restaurantId) {
    const cacheKey = `table_states:${restaurantId}`;
    this.activeTableStateCache.delete(cacheKey);
  }

  static async getAssignedWaiterIdForTable(restaurantId, tableId) {
    if (!restaurantId || !tableId) {
      return '';
    }

    const { data: assignment, error } = await supabase
      .from('table_assignments')
      .select('waiter_id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return assignment?.waiter_id || '';
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
      assignedWaiterName: waiterNameById.get(table.assigned_to) || '',
    }));
  }

  static async applyAssignments(restaurantId, tables = []) {
    const tableIds = (tables || []).map(t => t.id).filter(Boolean);
    if (tableIds.length === 0) return tables;

    const { data: assignments, error } = await supabase
      .from('table_assignments')
      .select('table_id, waiter_id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .in('table_id', tableIds);

    if (error) {
      throw error;
    }

    const byTable = new Map((assignments || []).map(a => [a.table_id, a.waiter_id]));
    return (tables || []).map(table => ({
      ...table,
      assigned_to: byTable.get(table.id) || table.assigned_to || null,
    }));
  }

  static async upsertAssignment(restaurantId, tableId, waiterId) {
    const now = new Date().toISOString();

    await supabase
      .from('table_assignments')
      .update({ is_active: false, updated_at: now })
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId);

    const { error } = await supabase
      .from('table_assignments')
      .upsert(
        { restaurant_id: restaurantId, table_id: tableId, waiter_id: waiterId, is_active: true, updated_at: now },
        { onConflict: 'restaurant_id,table_id' }
      );

    if (error) throw error;
  }

  static async syncTableLifecycle(restaurantId, tableId) {
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id,restaurant_id,table_number,status')
      .eq('restaurant_id', restaurantId)
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      throw tableError || new Error('Table not found');
    }

    // ✅ CRITICAL: Invalidate cache before checking table states
    // Ensures we get fresh data after recent order changes (delete, cancel, create)
    this.invalidateActiveTableStateCache(restaurantId);
    
    const activeTableStates = await this.getActiveTableStates(restaurantId);
    const tableState = activeTableStates.get(tableId) || { hasActiveOrder: false, hasQrOrder: false };
    const hasActiveOrder = tableState.hasActiveOrder;
    const nextStatus = this.getEffectiveStatus(table, hasActiveOrder);
    const shouldClearReservation = hasActiveOrder || nextStatus === 'available';

    const nextAssignedTo = await this.getAssignedWaiterIdForTable(restaurantId, tableId) || null;

    // Debug logging for UUID comparisons
    logger.debug('SYNC LIFECYCLE - UUID CHECK', {
      table_id: tableId,
      current_assigned_to: String(table.assigned_to || ''),
      next_assigned_to: String(nextAssignedTo || ''),
      comparison_result: String(table.assigned_to || '') === String(nextAssignedTo || ''),
    });

    const needsUpdate =
      table.status !== nextStatus ||
      (shouldClearReservation && (table.reserved_by || table.reservation_time)) ||
      String(table.assigned_to || '') !== String(nextAssignedTo || '');

    if (!needsUpdate) {
      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [table]);
      return this.transformTable(enrichedTable);
    }

    const updatePayload = {
      status: nextStatus,
      reserved_by: shouldClearReservation ? null : table.reserved_by,
      reservation_time: shouldClearReservation ? null : table.reservation_time,
      assigned_to: nextAssignedTo,
      updated_at: new Date().toISOString(),
    };

    logger.info('SYNC LIFECYCLE - UPDATING TABLE', {
      table_id: tableId,
      update_payload: {
        status: updatePayload.status,
        assigned_to: updatePayload.assigned_to,
      },
    });

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

    // ✅ EMIT SOCKET EVENT FOR REAL-TIME TABLE UPDATE
    broadcastRestaurantEvent(restaurantId, 'table_updated', {
      tableId,
      status: updatedTable.status,
      eventType: 'lifecycle_sync',
      assignedTo: updatedTable.assigned_to,
      reservedBy: updatedTable.reserved_by,
      updatedAt: new Date().toISOString(),
    });

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
        const nextStatus = this.getEffectiveStatus(table, hasActiveOrder);
        const shouldClearReservation = hasActiveOrder || nextStatus === 'available';

        return (async () => {
          const nextAssignedTo = await this.getAssignedWaiterIdForTable(restaurantId, table.id) || null;
          const needsUpdate =
            table.status !== nextStatus ||
            (shouldClearReservation && (table.reserved_by || table.reservation_time)) ||
            String(table.assigned_to || '') !== String(nextAssignedTo || '');

          if (!needsUpdate) {
            return;
          }

          const updatePayload = {
            status: nextStatus,
            reserved_by: shouldClearReservation ? null : table.reserved_by,
            reservation_time: shouldClearReservation ? null : table.reservation_time,
            assigned_to: nextAssignedTo,
            updated_at: new Date().toISOString(),
          };

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
      const { data: table, error } = await supabase
        .from('tables')
        .select('id,restaurant_id,table_number,capacity,status,assigned_to')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (error || !table) throw error || new Error('Table not found');
      const tableWithAssignment = (await this.applyAssignments(restaurantId, [table]))[0];
      const [enrichedTable] = await this.attachAssignedWaiterNames(restaurantId, [tableWithAssignment]);
      return this.transformTable(enrichedTable);
    } catch (error) {
      logger.error('Get table error:', error?.message);
      throw error;
    }
  }

  static async getTablesByRestaurant(restaurantId, filters = {}) {
    try {
      let query = supabase
        .from('tables')
        .select('id,restaurant_id,table_number,capacity,status,assigned_to')
        .eq('restaurant_id', restaurantId)
        .limit(100);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.location) {
        query = query.eq('location', filters.location);
      }

      const { data: tables, error } = await query;
      if (error) throw error;

      const withAssignments = await this.applyAssignments(restaurantId, tables || []);
      return this.transformTables(await this.attachAssignedWaiterNames(restaurantId, withAssignments));
    } catch (error) {
      logger.error('Get tables error:', error?.message);
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
      // Check if table has active orders (excluding soft-deleted)
      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('is_deleted', false)
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

      let query = supabase
        .from('tables')
        .select('id, table_number, capacity, location, assigned_to')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'available');

      if (capacity) {
        query = query.gte('capacity', capacity);
      }

      const { data: tables, error } = await query;

      if (error) throw error;

      const withAssignments = await this.applyAssignments(restaurantId, tables || []);
      return this.transformTables(await this.attachAssignedWaiterNames(restaurantId, withAssignments));
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
        reserved_by: null,
        reservation_time: null,
        updated_at: new Date().toISOString(),
      };

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
      logger.error('Get table status error:', error?.message);
      throw error;
    }
  }

  static async getTables(restaurantId, filters = {}) {
    try {
      const skip = Math.max(parseInt(filters.skip) || 0, 0);
      const limit = Math.min(parseInt(filters.limit) || 100, 150);
      const offset = skip;

      // ⚡ OPTIMIZATION: Fetch ONLY essential columns for list view
      // Skip enrichment queries for performance (assignments, waiter names)
      const { data: tables, error, count } = await supabase
        .from('tables')
        .select('id, restaurant_id, table_number, capacity, status, assigned_to', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .order('table_number', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Transform minimal data for display
      const transformedTables = (tables || []).map(table => ({
        id: table.id,
        restaurantId: table.restaurant_id,
        tableNumber: table.table_number,
        seatCapacity: table.capacity,
        status: table.status,
        assignedTo: table.assigned_to || null,
        assignedWaiterName: '', // Empty for list view, fetch on-demand if needed
      }));

      return {
        tables: transformedTables,
        total: count || 0,
        limit,
        skip,
      };
    } catch (error) {
      logger.error('❌ Get tables error:', error?.message);
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
        .select('id,restaurant_id,table_number,capacity,status,assigned_to,qr_code')
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
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (tableError || !table) {
        throw tableError || new Error('Table not found');
      }

      // Always (re)assign to current waiter
      await this.upsertAssignment(restaurantId, tableId, waiterId);

      const [enrichedTable] = await this.attachAssignedWaiterNames(
        restaurantId,
        await this.applyAssignments(restaurantId, [table])
      );
      return this.transformTable(enrichedTable);
    } catch (error) {
      logger.error('Claim table failed:', error.message);
      throw error;
    }
  }

  // ✅ CLEANUP: Fix stale tables marked as occupied but with no active orders
  static async cleanupStaleTableStates(restaurantId) {
    try {
      if (!restaurantId) {
        throw new Error('restaurantId is required');
      }

      // Get all tables marked as occupied
      const { data: occupiedTables, error: tableError } = await supabase
        .from('tables')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'occupied');

      if (tableError) {
        throw tableError;
      }

      if (!occupiedTables || occupiedTables.length === 0) {
        logger.info('✅ No stale tables found');
        return { cleaned: 0, message: 'No stale tables found' };
      }

      const occupiedTableIds = occupiedTables.map((t) => t.id);

      // Find which of these tables actually have NO active non-deleted orders
      const { data: activeOrders, error: ordersError } = await supabase
        .from('orders')
        .select('table_id')
        .eq('restaurant_id', restaurantId)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .neq('payment_status', 'paid')
        .in('status', this.ACTIVE_ORDER_STATUSES)
        .in('table_id', occupiedTableIds);

      if (ordersError) {
        throw ordersError;
      }

      const tableIdsWithActiveOrders = new Set(activeOrders?.map((o) => o.table_id) || []);
      const staleTableIds = occupiedTableIds.filter((id) => !tableIdsWithActiveOrders.has(id));

      if (staleTableIds.length === 0) {
        logger.info('✅ No stale tables found (all occupied tables have active orders)');
        return { cleaned: 0, message: 'All occupied tables have active orders' };
      }

      // Mark stale tables as available
      const { error: updateError } = await supabase
        .from('tables')
        .update({
          status: 'available',
          reserved_by: null,
          reservation_time: null,
          assigned_to: null,
        })
        .eq('restaurant_id', restaurantId)
        .in('id', staleTableIds);

      if (updateError) {
        throw updateError;
      }

      logger.info(`✅ Cleaned up ${staleTableIds.length} stale table(s)`, {
        restaurantId,
        cleanedTableIds: staleTableIds,
      });

      const nowISO = new Date().toISOString();
      const { error: assignmentError } = await supabase
        .from('table_assignments')
        .update({
          is_active: false,
          updated_at: nowISO,
        })
        .eq('restaurant_id', restaurantId)
        .in('table_id', staleTableIds);

      if (assignmentError) {
        logger.warn('Failed to deactivate stale table assignments during cleanup', {
          restaurantId,
          staleTableIds,
          error: assignmentError.message,
        });
      }

      this.invalidateActiveTableStateCache(restaurantId);

      staleTableIds.forEach((tableId) => {
        broadcastRestaurantEvent(restaurantId, 'table_updated', {
          tableId,
          status: 'available',
          updatedAt: nowISO,
        });
      });

      return {
        cleaned: staleTableIds.length,
        tableIds: staleTableIds,
        message: `Fixed ${staleTableIds.length} table(s) marked as occupied with no active orders`,
      };
    } catch (error) {
      logger.error('Table cleanup failed:', error.message);
      throw error;
    }
  }
}

export default TableService;
