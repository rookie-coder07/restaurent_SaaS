import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import TableService from './tableService.js';
import {
  appendPublicNote,
  composeNotesWithKotMeta,
  splitNotesAndKotMeta,
} from '../utils/kotMetadata.js';

export class OrderService {
  static ACTIVE_ORDER_STATUSES = ['pending', 'preparing', 'ready', 'in_progress'];

  static OPEN_BILL_STATUSES = ['pending', 'preparing', 'ready', 'served', 'in_progress'];

  static CLOSED_ORDER_STATUSES = ['completed'];

  static normalizeOrderStatus(status) {
    if (!status) {
      return status;
    }

    if (status === 'in_progress') {
      return 'preparing';
    }

    return status;
  }

  static getStatusFilterValues(status) {
    const normalizedStatus = this.normalizeOrderStatus(status);

    if (normalizedStatus === 'preparing') {
      return ['preparing', 'in_progress'];
    }

    return normalizedStatus ? [normalizedStatus] : [];
  }

  static isActiveStatus(status) {
    return this.OPEN_BILL_STATUSES.includes(status);
  }

  static normalizeTimestamp(value) {
    if (!value) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmedValue);
      const isoLikeWithoutTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmedValue);
      const normalizedDate = new Date(
        !hasTimezone && isoLikeWithoutTimezone ? `${trimmedValue}Z` : trimmedValue
      );

      if (!Number.isNaN(normalizedDate.getTime())) {
        return normalizedDate.toISOString();
      }
    }

    const fallbackDate = new Date(value);
    return Number.isNaN(fallbackDate.getTime()) ? value : fallbackDate.toISOString();
  }

  static formatDisplayOrderNumber(dateKey, sequence) {
    return `ORD-${dateKey.replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`;
  }

  static async attachDisplayNumbers(restaurantId, orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
      return orders || [];
    }

    const dateKeys = Array.from(
      new Set(
        orders
          .map((order) => order.createdAt || order.created_at)
          .filter(Boolean)
          .map((value) => this.normalizeTimestamp(value))
          .filter(Boolean)
          .map((value) => value.slice(0, 10))
      )
    );

    const perDateResults = await Promise.all(
      dateKeys.map(async (dateKey) => {
        const start = `${dateKey}T00:00:00.000Z`;
        const end = `${dateKey}T23:59:59.999Z`;
        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (error) {
          throw error;
        }

        return { dateKey, rows: data || [] };
      })
    );

    const displayMap = new Map();

    perDateResults.forEach(({ dateKey, rows }) => {
      rows.forEach((row, index) => {
        displayMap.set(row.id, this.formatDisplayOrderNumber(dateKey, index + 1));
      });
    });

    return orders.map((order) => ({
      ...order,
      displayOrderNumber: displayMap.get(order.id) || order.displayOrderNumber || `ORD-${String(order.id).slice(-6).toUpperCase()}`,
    }));
  }

  // Helper function to transform snake_case to camelCase
  static transformOrder(order) {
    if (!order) return null;
    const normalizedStatus = this.normalizeOrderStatus(order.status);
    const { publicNotes, kotMeta } = splitNotesAndKotMeta(order.notes);
    const lineDetails = kotMeta.lineDetails || {};
    const kitchenTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
    return {
      id: order.id,
      restaurantId: order.restaurant_id,
      tableId: order.table_id,
      status: normalizedStatus,
      totalAmount: order.total_amount,
      total: Number(order.total_amount || 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status || 'unpaid',
      notes: publicNotes,
      createdAt: this.normalizeTimestamp(order.created_at),
      updatedAt: this.normalizeTimestamp(order.updated_at),
      displayOrderNumber: order.display_order_number || null,
      orderItems: order.order_items?.map(item => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price ?? item.price ?? 0),
        price: Number(item.unit_price ?? item.price ?? 0),
        name: item.menu_items?.name || item.name || `Item ${item.menu_item_id?.slice(0, 6) || ''}`,
        preparationTime: item.menu_items?.preparation_time || 15,
        itemNote: lineDetails[item.menu_item_id]?.note || '',
        modifiers: lineDetails[item.menu_item_id]?.modifiers || [],
        station: lineDetails[item.menu_item_id]?.station || 'Main Kitchen',
        categoryId: lineDetails[item.menu_item_id]?.categoryId || null,
        categoryName: lineDetails[item.menu_item_id]?.categoryName || '',
      })) || [],
      items: order.order_items?.map(item => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        quantity: item.quantity,
        price: Number(item.unit_price ?? item.price ?? 0),
        unitPrice: Number(item.unit_price ?? item.price ?? 0),
        name: item.menu_items?.name || item.name || `Item ${item.menu_item_id?.slice(0, 6) || ''}`,
        preparationTime: item.menu_items?.preparation_time || 15,
        itemNote: lineDetails[item.menu_item_id]?.note || '',
        modifiers: lineDetails[item.menu_item_id]?.modifiers || [],
        station: lineDetails[item.menu_item_id]?.station || 'Main Kitchen',
        categoryId: lineDetails[item.menu_item_id]?.categoryId || null,
        categoryName: lineDetails[item.menu_item_id]?.categoryName || '',
      })) || [],
      kitchenTickets,
      activeKitchenTickets: kitchenTickets.filter((ticket) => ['pending', 'preparing', 'ready'].includes(ticket.status)),
      kitchenLastSentAt: kitchenTickets.length > 0 ? kitchenTickets[kitchenTickets.length - 1].createdAt : null,
    };
  }

  static transformOrders(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.map(order => this.transformOrder(order));
  }

  static normalizeOrderItems(items = []) {
    return items.map((item) => ({
      menuItemId: item.menuItemId || item.itemId || item.id,
      quantity: Number(item.quantity || item.qty || 0),
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      name: item.name || '',
      itemNote: String(item.itemNote ?? item.note ?? item.specialInstructions ?? '').trim(),
      modifiers: this.parseModifierList(item.modifiers ?? item.modifierList ?? item.modifierText),
    }));
  }

  static parseModifierList(value) {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        )
      ).slice(0, 10);
    }

    if (typeof value === 'string') {
      return this.parseModifierList(
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      );
    }

    return [];
  }

  static sanitizeLineNote(value) {
    return String(value || '').trim().slice(0, 200);
  }

  static buildLineKey(item = {}) {
    return String(item.menuItemId || item.id || '').trim();
  }

  static buildItemDetailsSignature(item = {}) {
    return JSON.stringify({
      note: this.sanitizeLineNote(item.itemNote || item.note || ''),
      modifiers: this.parseModifierList(item.modifiers).sort(),
      station: String(item.station || '').trim(),
      categoryName: String(item.categoryName || '').trim(),
    });
  }

  static normalizeKitchenTicket(ticket = {}) {
    return {
      ...ticket,
      id: ticket.id || randomUUID(),
      status: this.normalizeOrderStatus(ticket.status || 'pending'),
      createdAt: this.normalizeTimestamp(ticket.createdAt || ticket.created_at || new Date().toISOString()),
      updatedAt: this.normalizeTimestamp(ticket.updatedAt || ticket.updated_at || ticket.createdAt || ticket.created_at || new Date().toISOString()),
      lastPrintedAt: this.normalizeTimestamp(ticket.lastPrintedAt || ticket.last_printed_at || null),
      printCount: Number(ticket.printCount || 0),
      sequence: Number(ticket.sequence || 1),
      items: Array.isArray(ticket.items) ? ticket.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        modifiers: this.parseModifierList(item.modifiers),
        station: item.station || 'Main Kitchen',
      })) : [],
    };
  }

  static resolveKitchenStation({ tags = [], categoryName = '' } = {}) {
    const normalizedTags = Array.isArray(tags)
      ? tags
      : String(tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);

    const stationTag = normalizedTags.find((tag) => /^(station|printer|kitchen)\s*:/i.test(tag));
    if (stationTag) {
      return stationTag.split(':').slice(1).join(':').trim() || 'Main Kitchen';
    }

    return String(categoryName || '').trim() || 'Main Kitchen';
  }

  static buildLineDetailsMap(items = []) {
    return items.reduce((accumulator, item) => {
      const lineKey = this.buildLineKey(item);
      if (!lineKey) {
        return accumulator;
      }

      accumulator[lineKey] = {
        menuItemId: item.menuItemId,
        note: this.sanitizeLineNote(item.itemNote),
        modifiers: this.parseModifierList(item.modifiers),
        station: item.station || 'Main Kitchen',
        categoryId: item.categoryId || null,
        categoryName: item.categoryName || '',
        detailsSignature: this.buildItemDetailsSignature(item),
      };

      return accumulator;
    }, {});
  }

  static buildKitchenSnapshot(items = []) {
    return items.map((item) => ({
      lineKey: this.buildLineKey(item),
      menuItemId: item.menuItemId,
      name: item.name || '',
      quantity: Number(item.quantity || 0),
      note: this.sanitizeLineNote(item.itemNote),
      modifiers: this.parseModifierList(item.modifiers),
      station: item.station || 'Main Kitchen',
      categoryId: item.categoryId || null,
      categoryName: item.categoryName || '',
      unitPrice: Number(item.unitPrice ?? item.price ?? 0),
      detailsSignature: this.buildItemDetailsSignature(item),
    }));
  }

  static diffKitchenSnapshot(previousSnapshot = [], nextSnapshot = []) {
    const previousByKey = new Map(previousSnapshot.map((item) => [item.lineKey || item.menuItemId, item]));
    const nextByKey = new Map(nextSnapshot.map((item) => [item.lineKey || item.menuItemId, item]));
    const keys = Array.from(new Set([...previousByKey.keys(), ...nextByKey.keys()]));
    const changes = [];

    keys.forEach((key) => {
      const previousItem = previousByKey.get(key);
      const nextItem = nextByKey.get(key);

      if (!previousItem && nextItem) {
        changes.push({ ...nextItem, action: 'add' });
        return;
      }

      if (previousItem && !nextItem) {
        changes.push({ ...previousItem, action: 'remove' });
        return;
      }

      if (!previousItem || !nextItem) {
        return;
      }

      if (previousItem.detailsSignature !== nextItem.detailsSignature) {
        changes.push({ ...nextItem, action: 'update' });
        return;
      }

      if (nextItem.quantity > previousItem.quantity) {
        changes.push({
          ...nextItem,
          quantity: nextItem.quantity - previousItem.quantity,
          action: 'add',
        });
        return;
      }

      if (nextItem.quantity < previousItem.quantity) {
        changes.push({
          ...previousItem,
          quantity: previousItem.quantity - nextItem.quantity,
          action: 'remove',
        });
      }
    });

    return changes.filter((item) => item.quantity > 0 || item.action === 'update');
  }

  static summarizeKitchenActions(items = []) {
    const counts = items.reduce(
      (accumulator, item) => {
        accumulator[item.action] = (accumulator[item.action] || 0) + 1;
        return accumulator;
      },
      { add: 0, update: 0, remove: 0, refire: 0 }
    );
    const parts = [];

    if (counts.add) {
      parts.push(`${counts.add} new`);
    }
    if (counts.update) {
      parts.push(`${counts.update} updated`);
    }
    if (counts.remove) {
      parts.push(`${counts.remove} removed`);
    }
    if (counts.refire) {
      parts.push(`${counts.refire} re-fired`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Kitchen ticket';
  }

  static deriveOrderStatusFromTickets(tickets = [], fallbackStatus = 'pending') {
    const activeTickets = tickets
      .map((ticket) => this.normalizeKitchenTicket(ticket))
      .filter((ticket) => !['cancelled'].includes(ticket.status));

    if (activeTickets.some((ticket) => ticket.status === 'pending')) {
      return 'pending';
    }

    if (activeTickets.some((ticket) => ticket.status === 'preparing')) {
      return 'preparing';
    }

    if (activeTickets.some((ticket) => ticket.status === 'ready')) {
      return 'ready';
    }

    if (activeTickets.length > 0 && activeTickets.every((ticket) => ticket.status === 'served')) {
      return 'served';
    }

    return this.normalizeOrderStatus(fallbackStatus);
  }

  static async validateOrderItems(restaurantId, items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one order item is required');
    }

    const normalizedItems = this.normalizeOrderItems(items);
    const menuItemIds = normalizedItems.map((item) => item.menuItemId).filter(Boolean);

    if (menuItemIds.length !== normalizedItems.length) {
      throw new Error('Each order item must include a menu item ID');
    }

    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id, name, price, category_id, tags')
      .eq('restaurant_id', restaurantId)
      .in('id', menuItemIds)
      .eq('status', 'active');

    if (menuItemsError) {
      throw menuItemsError;
    }

    if ((menuItems || []).length !== menuItemIds.length) {
      throw new Error('One or more menu items are invalid or unavailable');
    }

    const menuItemMap = new Map((menuItems || []).map((item) => [item.id, item]));
    const categoryIds = Array.from(
      new Set((menuItems || []).map((item) => item.category_id).filter(Boolean))
    );
    let categoryMap = new Map();

    if (categoryIds.length > 0) {
      const { data: categories, error: categoryError } = await supabase
        .from('menu_categories')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .in('id', categoryIds);

      if (categoryError) {
        throw categoryError;
      }

      categoryMap = new Map((categories || []).map((category) => [category.id, category.name]));
    }

    return normalizedItems.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      const tags = String(menuItem?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const categoryName = categoryMap.get(menuItem?.category_id) || '';

      return {
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice ?? menuItem?.price ?? 0),
        name: item.name || menuItem?.name || '',
        itemNote: this.sanitizeLineNote(item.itemNote),
        modifiers: this.parseModifierList(item.modifiers),
        categoryId: menuItem?.category_id || null,
        categoryName,
        station: this.resolveKitchenStation({ tags, categoryName }),
      };
    });
  }

  static computeOrderTotal(items = []) {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  static normalizePaymentMethod(method) {
    if (!method) {
      return 'cash';
    }

    const normalizedMethod = String(method).trim().toLowerCase();
    return ['cash', 'upi'].includes(normalizedMethod) ? normalizedMethod : null;
  }

  static appendOrderNote(existingNotes = '', noteToAppend = '') {
    return appendPublicNote(existingNotes, noteToAppend);
  }

  static formatSettlementNote({ method, amountReceived, changeDue, paymentNote }) {
    const noteParts = [`[Settlement ${new Date().toISOString()}] ${String(method || '').toUpperCase()} marked paid`];

    if (method === 'cash' && Number.isFinite(amountReceived)) {
      noteParts.push(`received ${Number(amountReceived).toFixed(2)}`);
      noteParts.push(`change ${Number(changeDue || 0).toFixed(2)}`);
    }

    if (paymentNote) {
      noteParts.push(`note: ${paymentNote}`);
    }

    return noteParts.join(' | ');
  }

  static formatCancellationNote(reason = '', source = 'manual') {
    const noteParts = [`[Cancellation ${new Date().toISOString()}] bill cancelled via ${source}`];
    const trimmedReason = String(reason || '').trim();

    if (trimmedReason) {
      noteParts.push(`reason: ${trimmedReason}`);
    }

    return noteParts.join(' | ');
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

      const normalizedItems = await this.validateOrderItems(finalRestaurantId, orderData.items);
      const computedTotalAmount = this.computeOrderTotal(normalizedItems);
      const initialKotMeta = {
        lineDetails: this.buildLineDetailsMap(normalizedItems),
        kitchen: {
          lastSentSnapshot: [],
          tickets: [],
        },
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: finalRestaurantId,
          table_id: orderData.tableId,
          status: 'pending',
          total_amount: Number(orderData.totalAmount ?? computedTotalAmount ?? 0),
          payment_method: this.normalizePaymentMethod(orderData.paymentMethod) || 'cash',
          payment_status: 'unpaid',
          notes: composeNotesWithKotMeta(orderData.notes || '', initialKotMeta),
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`✅ Order created: ${order.id}`);

      // If items are provided, add them to the order
      if (normalizedItems.length > 0) {
        try {
          await this.addOrderItems(order.id, normalizedItems);
        } catch (orderItemsError) {
          await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)
            .eq('restaurant_id', finalRestaurantId);

          throw orderItemsError;
        }
      }

      // Fetch and return the complete order with items
      const completeOrder = await this.getOrderById(finalRestaurantId, order.id);

      if (orderData.tableId) {
        await TableService.syncTableLifecycle(finalRestaurantId, orderData.tableId);
      }
      
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
        menu_item_id: item.menuItemId || item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice ?? item.price ?? 0,
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

  static async fetchOrderRecord(restaurantId, orderId) {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          menu_item_id,
          quantity,
          unit_price,
          menu_items (
            name,
            preparation_time
          )
        ),
        tables!table_id (
          table_number
        )
      `)
      .eq('id', orderId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !order) throw error || new Error('Order not found');

    return order;
  }

  static async getOrderById(restaurantId, orderId) {
    try {
      const order = await this.fetchOrderRecord(restaurantId, orderId);

      // Transform and include table information
      const transformedOrder = {
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
      const [orderWithDisplayNumber] = await this.attachDisplayNumbers(restaurantId, [transformedOrder]);
      return orderWithDisplayNumber;
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
            unit_price,
            menu_items (
              name,
              preparation_time
            )
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        const statusValues = this.getStatusFilterValues(filters.status);
        query = statusValues.length > 1 ? query.in('status', statusValues) : query.eq('status', statusValues[0]);
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
      const transformedOrders = (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
      return await this.attachDisplayNumbers(restaurantId, transformedOrders);
    } catch (error) {
      logger.error('❌ Get orders error:', error);
      throw error;
    }
  }

  static async updateOrderStatus(restaurantId, orderId, newStatus, cancelReason = '') {
    try {
      const normalizedStatus = this.normalizeOrderStatus(newStatus);
      if (normalizedStatus === 'completed') {
        throw new Error('Bills can only be completed through POS settlement');
      }
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, table_id, notes')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) throw existingOrderError || new Error('Order not found');

      const nextNotes =
        normalizedStatus === 'cancelled'
          ? this.appendOrderNote(existingOrder.notes, this.formatCancellationNote(cancelReason, 'status-update'))
          : existingOrder.notes;

      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: normalizedStatus,
          notes: nextNotes,
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order status updated: ${orderId} → ${newStatus}`);
      if (order.table_id) {
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
      }

      return await this.getOrderById(restaurantId, orderId);
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
      if (order.table_id) {
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
      }

      return order;
    } catch (error) {
      logger.error('❌ Update payment error:', error);
      throw error;
    }
  }

  static async settleOrder(restaurantId, orderId, paymentData = {}) {
    try {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, status, total_amount, payment_status, payment_method, notes')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) {
        throw existingOrderError || new Error('Order not found');
      }

      if (existingOrder.status === 'cancelled') {
        throw new Error('Cancelled orders cannot be settled');
      }

      if (existingOrder.status === 'completed' || existingOrder.payment_status === 'paid') {
        throw new Error('Order is already settled');
      }

      const totalAmount = Number(existingOrder.total_amount || 0);
      if (totalAmount <= 0) {
        throw new Error('Order total must be greater than zero before settlement');
      }

      const method = this.normalizePaymentMethod(paymentData.method || existingOrder.payment_method || 'cash');
      if (!method) {
        throw new Error('Unsupported payment method');
      }

      const rawAmountReceived = paymentData.amountReceived;
      const amountReceived = rawAmountReceived === undefined || rawAmountReceived === null || rawAmountReceived === ''
        ? null
        : Number(rawAmountReceived);

      if (method === 'cash') {
        if (!Number.isFinite(amountReceived)) {
          throw new Error('Cash received amount is required for cash settlement');
        }

        if (amountReceived < totalAmount) {
          throw new Error('Cash received must be at least the bill total');
        }
      }

      const changeDue = method === 'cash' && Number.isFinite(amountReceived)
        ? Number((amountReceived - totalAmount).toFixed(2))
        : 0;

      const notes = this.appendOrderNote(
        existingOrder.notes,
        this.formatSettlementNote({
          method,
          amountReceived,
          changeDue,
          paymentNote: paymentData.paymentNote,
        })
      );

      const { error: settleError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: method,
          payment_status: 'paid',
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (settleError) {
        throw settleError;
      }

      if (existingOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, existingOrder.table_id);
      }

      const settledOrder = await this.getOrderById(restaurantId, orderId);
      return {
        ...settledOrder,
        settlement: {
          method,
          amountReceived,
          changeDue,
        },
      };
    } catch (error) {
      logger.error('Settle order error:', error);
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
          status: 'served',
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order completed: ${orderId}`);
      if (order.table_id) {
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
      }

      return order;
    } catch (error) {
      logger.error('❌ Complete order error:', error);
      throw error;
    }
  }

  static async cancelOrder(restaurantId, orderId) {
    try {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, table_id, notes')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) throw existingOrderError || new Error('Order not found');

      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          notes: this.appendOrderNote(existingOrder.notes, this.formatCancellationNote('', 'manual')),
          updated_at: new Date(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order cancelled: ${orderId}`);
      if (order.table_id) {
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
      }

      return order;
    } catch (error) {
      logger.error('❌ Cancel order error:', error);
      throw error;
    }
  }

  static async cancelPendingBills(restaurantId, reason) {
    try {
      const trimmedReason = String(reason || '').trim();
      if (!trimmedReason) {
        throw new Error('Cancellation reason is required');
      }

      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from('orders')
        .select('id, table_id, notes, payment_status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending');

      if (pendingOrdersError) throw pendingOrdersError;

      const cancellableOrders = (pendingOrders || []).filter((order) => order.payment_status !== 'paid');

      if (cancellableOrders.length === 0) {
        return {
          cancelledCount: 0,
          affectedTableCount: 0,
        };
      }

      const cancellationNote = this.formatCancellationNote(trimmedReason, 'bulk-action');
      const touchedTableIds = new Set();

      await Promise.all(
        cancellableOrders.map(async (order) => {
          if (order.table_id) {
            touchedTableIds.add(order.table_id);
          }

          const { error: cancelError } = await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              notes: this.appendOrderNote(order.notes, cancellationNote),
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)
            .eq('restaurant_id', restaurantId);

          if (cancelError) {
            throw cancelError;
          }
        })
      );

      await Promise.all(
        Array.from(touchedTableIds).map((tableId) => TableService.syncTableLifecycle(restaurantId, tableId))
      );

      logger.info(`Bulk cancelled ${cancellableOrders.length} pending bills for restaurant ${restaurantId}`);

      return {
        cancelledCount: cancellableOrders.length,
        affectedTableCount: touchedTableIds.size,
      };
    } catch (error) {
      logger.error('Bulk cancel pending bills error:', error);
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
        .in('status', this.getStatusFilterValues(status))
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
            unit_price,
            menu_items (
              name,
              preparation_time
            )
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (filters.status) {
        const statusValues = this.getStatusFilterValues(filters.status);
        query = statusValues.length > 1 ? query.in('status', statusValues) : query.eq('status', statusValues[0]);
      }

      if (filters.tableNumber) {
        query = query.eq('tables.table_number', filters.tableNumber);
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
      const ordersWithDisplayNumbers = await this.attachDisplayNumbers(restaurantId, transformedOrders);

      return {
        items: ordersWithDisplayNumbers,
        total: ordersWithDisplayNumbers?.length || 0,
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
      const requestedStatuses = filters.statuses || ['pending', 'preparing'];
      const statuses = Array.from(
        new Set(requestedStatuses.flatMap((status) => this.getStatusFilterValues(status)))
      );
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            menu_items (
              name,
              preparation_time
            )
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
      const transformedOrders = (orders || []).map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
      return await this.attachDisplayNumbers(restaurantId, transformedOrders);
    } catch (error) {
      logger.error('❌ Get kitchen orders error:', error);
      throw error;
    }
  }

  static async getActiveOrderByTable(restaurantId, tableId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            menu_items (
              name,
              preparation_time
            )
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .neq('payment_status', 'paid')
        .in('status', this.OPEN_BILL_STATUSES)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      const order = orders?.[0];

      if (!order) {
        return null;
      }

      const transformedOrder = {
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
      const [orderWithDisplayNumber] = await this.attachDisplayNumbers(restaurantId, [transformedOrder]);
      return orderWithDisplayNumber;
    } catch (error) {
      logger.error('Get active order by table error:', error);
      throw error;
    }
  }

  static async updateOrder(restaurantId, orderId, orderData) {
    try {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, status, notes, payment_method')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) {
        throw existingOrderError || new Error('Order not found');
      }

      if (!this.isActiveStatus(existingOrder.status)) {
        throw new Error('Only active table orders can be updated');
      }

      const normalizedItems = await this.validateOrderItems(restaurantId, orderData.items);
      const computedTotalAmount = this.computeOrderTotal(normalizedItems);
      const resolvedTableId =
        orderData.tableId !== undefined ? orderData.tableId : existingOrder.table_id;
      const { publicNotes: existingPublicNotes, kotMeta: existingKotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const nextKotMeta = {
        ...existingKotMeta,
        lineDetails: this.buildLineDetailsMap(normalizedItems),
      };

      const { data: existingOrderItems, error: existingItemsError } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity, unit_price')
        .eq('order_id', orderId);

      if (existingItemsError) {
        throw existingItemsError;
      }

      const nextStatus = this.normalizeOrderStatus(existingOrder.status);
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          table_id: resolvedTableId,
          total_amount: Number(orderData.totalAmount ?? computedTotalAmount ?? 0),
          payment_method: orderData.paymentMethod !== undefined
            ? this.normalizePaymentMethod(orderData.paymentMethod) || existingOrder.payment_method
            : existingOrder.payment_method,
          notes: composeNotesWithKotMeta(orderData.notes ?? existingPublicNotes ?? '', nextKotMeta),
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteItemsError) {
        throw deleteItemsError;
      }

      try {
        await this.addOrderItems(orderId, normalizedItems);
      } catch (addOrderItemsError) {
        if (existingOrderItems?.length) {
          try {
            await this.addOrderItems(
              orderId,
              existingOrderItems.map((item) => ({
                menuItemId: item.menu_item_id,
                quantity: item.quantity,
                unitPrice: Number(item.unit_price ?? 0),
              }))
            );
          } catch (restoreError) {
            logger.error('Failed to restore original order items after update failure:', restoreError);
          }
        }

        throw addOrderItemsError;
      }

      if (existingOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, existingOrder.table_id);
      }

      if (resolvedTableId && resolvedTableId !== existingOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, resolvedTableId);
      }

      logger.info(`Order updated: ${orderId}`);
      return await this.getOrderById(restaurantId, orderId);
    } catch (error) {
      logger.error('Update order error:', error);
      throw error;
    }
  }

  static async getActiveOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            menu_items (
              name,
              preparation_time
            )
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', this.ACTIVE_ORDER_STATUSES)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedOrders = (orders || []).map((order) => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
      return await this.attachDisplayNumbers(restaurantId, transformedOrders);
    } catch (error) {
      logger.error('Get active orders error:', error);
      throw error;
    }
  }

  static async getOpenBills(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            menu_items (
              name,
              preparation_time
            )
          ),
          tables!table_id (
            table_number
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('payment_status', 'paid')
        .in('status', this.OPEN_BILL_STATUSES)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders = (orders || []).map((order) => ({
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      }));
      return await this.attachDisplayNumbers(restaurantId, transformedOrders);
    } catch (error) {
      logger.error('Get open bills error:', error);
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
        .in('status', this.CLOSED_ORDER_STATUSES)
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
        .in('status', this.CLOSED_ORDER_STATUSES)
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
  static async getKitchenOrders(restaurantId, filters = {}) {
    try {
      const requestedStatuses = filters.statuses || ['pending', 'preparing', 'ready'];
      const ticketStatuses = new Set(
        requestedStatuses.flatMap((status) => this.getStatusFilterValues(status))
      );
      const openOrders = await this.getOpenBills(restaurantId);

      return openOrders
        .flatMap((order) =>
          (order.kitchenTickets || [])
            .map((ticket) => this.normalizeKitchenTicket(ticket))
            .filter((ticket) => ticketStatuses.has(ticket.status))
            .map((ticket) => ({
              ...ticket,
              orderId: order.id,
              orderStatus: order.status,
              displayOrderNumber: order.displayOrderNumber,
              tableId: order.tableId,
              tableNumber: order.tableNumber,
              orderNotes: order.notes,
              printerRoutes: Array.from(new Set((ticket.items || []).map((item) => item.station || 'Main Kitchen'))),
            }))
        )
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || 0).getTime();
          const rightTime = new Date(right.createdAt || 0).getTime();
          return leftTime - rightTime;
        });
    } catch (error) {
      logger.error('âŒ Get kitchen orders error:', error);
      throw error;
    }
  }

  static async sendOrderToKitchen(restaurantId, orderId) {
    try {
      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const transformedOrder = this.transformOrder(rawOrder);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);

      if (!Array.isArray(transformedOrder.items) || transformedOrder.items.length === 0) {
        throw new Error('Add at least one item before sending to kitchen');
      }

      const currentSnapshot = this.buildKitchenSnapshot(transformedOrder.items);
      const existingTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const lastSentSnapshot = Array.isArray(kotMeta.kitchen?.lastSentSnapshot) ? kotMeta.kitchen.lastSentSnapshot : [];
      const ticketItems =
        lastSentSnapshot.length === 0
          ? currentSnapshot.map((item) => ({ ...item, action: 'add' }))
          : this.diffKitchenSnapshot(lastSentSnapshot, currentSnapshot);

      if (ticketItems.length === 0) {
        throw new Error('No new kitchen changes to send for this bill');
      }

      const now = new Date().toISOString();
      const nextTicket = this.normalizeKitchenTicket({
        id: randomUUID(),
        sequence: existingTickets.length + 1,
        type: existingTickets.length === 0 ? 'send' : 'delta',
        status: 'pending',
        summary: this.summarizeKitchenActions(ticketItems),
        printCount: 1,
        lastPrintedAt: now,
        createdAt: now,
        updatedAt: now,
        items: ticketItems,
      });

      const nextKotMeta = {
        ...kotMeta,
        lineDetails: this.buildLineDetailsMap(transformedOrder.items),
        kitchen: {
          ...kotMeta.kitchen,
          lastSentSnapshot: currentSnapshot,
          tickets: [...existingTickets, nextTicket],
        },
      };
      const nextStatus = this.deriveOrderStatusFromTickets(nextKotMeta.kitchen.tickets, rawOrder.status);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: nextStatus,
          notes: composeNotesWithKotMeta(publicNotes, nextKotMeta),
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      if (rawOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, rawOrder.table_id);
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      return {
        order: updatedOrder,
        ticket: {
          ...nextTicket,
          orderId: updatedOrder.id,
          displayOrderNumber: updatedOrder.displayOrderNumber,
          tableId: updatedOrder.tableId,
          tableNumber: updatedOrder.tableNumber,
          printerRoutes: Array.from(new Set((nextTicket.items || []).map((item) => item.station || 'Main Kitchen'))),
        },
      };
    } catch (error) {
      logger.error('Send order to kitchen error:', error);
      throw error;
    }
  }

  static async updateKitchenTicketStatus(restaurantId, orderId, ticketId, nextStatus) {
    try {
      const normalizedStatus = this.normalizeOrderStatus(nextStatus);
      if (!['pending', 'preparing', 'ready', 'served'].includes(normalizedStatus)) {
        throw new Error('Unsupported kitchen ticket status');
      }

      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);
      const existingTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const ticketIndex = existingTickets.findIndex((ticket) => ticket.id === ticketId);

      if (ticketIndex === -1) {
        throw new Error('Kitchen ticket not found');
      }

      const now = new Date().toISOString();
      const targetTicket = {
        ...existingTickets[ticketIndex],
        status: normalizedStatus,
        updatedAt: now,
        startedAt:
          normalizedStatus === 'preparing'
            ? existingTickets[ticketIndex].startedAt || now
            : existingTickets[ticketIndex].startedAt,
        readyAt: normalizedStatus === 'ready' ? now : existingTickets[ticketIndex].readyAt,
        servedAt: normalizedStatus === 'served' ? now : existingTickets[ticketIndex].servedAt,
      };
      const nextTickets = existingTickets.map((ticket, index) => (index === ticketIndex ? targetTicket : ticket));
      const derivedOrderStatus = this.deriveOrderStatusFromTickets(nextTickets, rawOrder.status);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: derivedOrderStatus,
          notes: composeNotesWithKotMeta(publicNotes, {
            ...kotMeta,
            kitchen: {
              ...kotMeta.kitchen,
              tickets: nextTickets,
            },
          }),
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      if (rawOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, rawOrder.table_id);
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      return {
        order: updatedOrder,
        ticket: {
          ...targetTicket,
          orderId: updatedOrder.id,
          displayOrderNumber: updatedOrder.displayOrderNumber,
          tableId: updatedOrder.tableId,
          tableNumber: updatedOrder.tableNumber,
          printerRoutes: Array.from(new Set((targetTicket.items || []).map((item) => item.station || 'Main Kitchen'))),
        },
      };
    } catch (error) {
      logger.error('Update kitchen ticket status error:', error);
      throw error;
    }
  }

  static async reprintKitchenTicket(restaurantId, orderId, ticketId) {
    try {
      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);
      const existingTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const ticketIndex = existingTickets.findIndex((ticket) => ticket.id === ticketId);

      if (ticketIndex === -1) {
        throw new Error('Kitchen ticket not found');
      }

      const now = new Date().toISOString();
      const targetTicket = {
        ...existingTickets[ticketIndex],
        printCount: Number(existingTickets[ticketIndex].printCount || 0) + 1,
        lastPrintedAt: now,
        updatedAt: now,
      };
      const nextTickets = existingTickets.map((ticket, index) => (index === ticketIndex ? targetTicket : ticket));

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          notes: composeNotesWithKotMeta(publicNotes, {
            ...kotMeta,
            kitchen: {
              ...kotMeta.kitchen,
              tickets: nextTickets,
            },
          }),
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      return {
        order: updatedOrder,
        ticket: {
          ...targetTicket,
          orderId: updatedOrder.id,
          displayOrderNumber: updatedOrder.displayOrderNumber,
          tableId: updatedOrder.tableId,
          tableNumber: updatedOrder.tableNumber,
          printerRoutes: Array.from(new Set((targetTicket.items || []).map((item) => item.station || 'Main Kitchen'))),
        },
      };
    } catch (error) {
      logger.error('Reprint kitchen ticket error:', error);
      throw error;
    }
  }

  static async refireKitchenTicket(restaurantId, orderId, ticketId) {
    try {
      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);
      const existingTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const sourceTicket = existingTickets.find((ticket) => ticket.id === ticketId);

      if (!sourceTicket) {
        throw new Error('Kitchen ticket not found');
      }

      const now = new Date().toISOString();
      const nextTicket = this.normalizeKitchenTicket({
        id: randomUUID(),
        sequence: existingTickets.length + 1,
        type: 'refire',
        sourceTicketId: sourceTicket.id,
        status: 'pending',
        summary: `Re-fire of KOT ${sourceTicket.sequence}`,
        createdAt: now,
        updatedAt: now,
        printCount: 1,
        lastPrintedAt: now,
        items: (sourceTicket.items || []).map((item) => ({
          ...item,
          action: 'refire',
        })),
      });
      const nextTickets = [...existingTickets, nextTicket];
      const nextStatus = this.deriveOrderStatusFromTickets(nextTickets, rawOrder.status);

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: nextStatus,
          notes: composeNotesWithKotMeta(publicNotes, {
            ...kotMeta,
            kitchen: {
              ...kotMeta.kitchen,
              tickets: nextTickets,
            },
          }),
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      if (rawOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, rawOrder.table_id);
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      return {
        order: updatedOrder,
        ticket: {
          ...nextTicket,
          orderId: updatedOrder.id,
          displayOrderNumber: updatedOrder.displayOrderNumber,
          tableId: updatedOrder.tableId,
          tableNumber: updatedOrder.tableNumber,
          printerRoutes: Array.from(new Set((nextTicket.items || []).map((item) => item.station || 'Main Kitchen'))),
        },
      };
    } catch (error) {
      logger.error('Refire kitchen ticket error:', error);
      throw error;
    }
  }
}

export default OrderService;
