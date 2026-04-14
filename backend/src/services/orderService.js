import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import supabaseImport from '../config/supabase.js';
import { normalizeRole } from '../constants/index.js';
import TableService from './tableService.js';
// Inventory dependency intentionally disabled to avoid blocking orders/KOTs
// import InventoryService from './inventoryService.js';
import InvoiceService from './invoiceService.js';
import AuthService from './authService.js';
import { validateOrderBelongsToRestaurant } from '../middleware/multiTenantValidation.js';
import {
  appendPublicNote,
  composeNotesWithKotMeta,
  splitNotesAndKotMeta,
} from '../utils/kotMetadata.js';
import { broadcastRestaurantEvent } from '../utils/realtimeEvents.js';

// Allow supabase to be injected for testing
let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;
const supabase = getSupabase();

export class OrderService {
  static ACTIVE_ORDER_STATUSES = ['awaiting_waiter_approval', 'pending', 'preparing', 'ready'];

  static setSupabase(supabaseInstance) {
    injectedSupabase = supabaseInstance;
  }

  // ✅ FIXED: Match database constraint idx_orders_one_open_bill_per_table
  // which checks: status IN ('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress')
  static OPEN_BILL_STATUSES = ['awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress'];

  static CLOSED_ORDER_STATUSES = ['completed'];
  static LOYALTY_EARN_RATE_RUPEES = 100;
  static LOYALTY_POINT_VALUE = 1;

  static ONLINE_SOURCES = ['direct', 'phone', 'website', 'swiggy', 'zomato'];

  static ONLINE_WORKFLOW_STATUSES = ['new', 'accepted', 'rejected', 'preparing', 'ready', 'dispatched'];

  static ONLINE_PAYMENT_STATES = ['pending', 'paid', 'cash_on_delivery', 'failed', 'refunded'];
  static inFlightCreateRequests = new Map();
  static restaurantTimezoneCache = new Map();
  static restaurantTimezoneInFlight = new Map();
  static RESTAURANT_TIMEZONE_CACHE_TTL_MS = 5 * 60 * 1000;
  static restaurantBillingSettingsCache = new Map();
  static restaurantBillingSettingsInFlight = new Map();
  static RESTAURANT_BILLING_SETTINGS_CACHE_TTL_MS = 60 * 1000;
  static menuCatalogCache = new Map();
  static menuCatalogInFlight = new Map();
  static MENU_CATALOG_CACHE_TTL_MS = 60 * 1000;
  static displayOrderSequenceCache = new Map();
  static displayOrderSequenceInFlight = new Map();
  static DISPLAY_ORDER_SEQUENCE_CACHE_TTL_MS = 60 * 1000;

  static emitOrderEvent(restaurantId, type, order, extra = {}) {
    if (!restaurantId || !order?.id) {
      return;
    }

    broadcastRestaurantEvent(restaurantId, 'order', {
      type,
      orderId: order.id,
      orderNumber: order.displayOrderNumber || order.id,
      status: order.status || '',
      paymentStatus: order.paymentStatus || '',
      tableId: order.tableId || '',
      tableNumber: order.tableNumber || '',
      orderType: order.orderType || '',
      origin: order.origin || '',
      ...extra,
    });
  }

  static toSchemaAlignmentError(error, context = 'orders') {
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const hint = String(error?.hint || '');
    const combined = `${message} ${details} ${hint}`.toLowerCase();

    const hasOrdersSchemaMismatch =
      combined.includes('payment_method') ||
      combined.includes('order_type') ||
      combined.includes('unit_price') ||
      (combined.includes('column') && (combined.includes('orders') || combined.includes('order_items')));

    if (!hasOrdersSchemaMismatch) {
      return error;
    }

    return new Error(
      `Database schema is missing required ${context} columns. Run backend/src/config/migrations/2026-04-05-align-orders-and-order-items-schema.sql and retry.`
    );
  }

  static normalizeOrderStatus(status) {
    if (!status) {
      return status;
    }

    if (status === 'in_progress') {
      return 'preparing';
    }

    if (status === 'served') {
      return 'completed';
    }

    return status;
  }

  static normalizeOrderType(orderType, fallback = 'dine-in') {
    const normalizedOrderType = String(orderType || fallback).trim().toLowerCase();
    return normalizedOrderType === 'takeaway' ? 'takeaway' : 'dine-in';
  }

  static normalizeRequestId(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return normalizedValue || '';
  }

  static getStatusFilterValues(status) {
    const normalizedStatus = this.normalizeOrderStatus(status);

    return normalizedStatus ? [normalizedStatus] : [];
  }

  static isActiveStatus(status) {
    return this.OPEN_BILL_STATUSES.includes(status);
  }

  static buildExistingOpenBillResult(order) {
    if (!order) {
      return null;
    }

    return {
      ...order,
      reusedExistingBill: true,
    };
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
    return `ORD-${String(dateKey || '').replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`;
  }

  static buildFallbackDisplayOrderNumber(orderId) {
    return `ORD-${String(orderId || '').slice(-6).toUpperCase() || '------'}`;
  }

  static extractDisplayOrderSequence(displayOrderNumber, dateKey = '') {
    const normalizedDateKey = String(dateKey || '').replace(/-/g, '');
    const pattern = normalizedDateKey
      ? new RegExp(`^ORD-${normalizedDateKey}-(\\d+)$`)
      : /^ORD-\d{8}-(\d+)$/;
    const match = String(displayOrderNumber || '').trim().match(pattern);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  static getDisplayOrderDateKey(value = new Date().toISOString(), timezone = 'Asia/Kolkata') {
    const normalizedValue = this.normalizeTimestamp(value) || new Date().toISOString();
    const parsedDate = new Date(normalizedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsedDate);

    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
  }

  static isUniqueConstraintError(error) {
    const combined = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return combined.includes('23505') || combined.includes('duplicate key') || combined.includes('unique');
  }

  static async cleanupSoftDeletedOrdersBlockingTableCreation(restaurantId, tableId) {
    try {
      if (!tableId) return;

      logger.info(`🧹 Checking for soft-deleted orders blocking table ${tableId}`);

      // Find any soft-deleted orders that might be blocking this table
      const { data: softDeletedOrders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('is_deleted', true)
        .in('status', this.OPEN_BILL_STATUSES);

      if (fetchError) {
        logger.warn(`Failed to fetch soft-deleted orders: ${fetchError.message}`);
        return;
      }

      if (!softDeletedOrders || softDeletedOrders.length === 0) {
        logger.info(`No soft-deleted orders found for table ${tableId}`);
        return;
      }

      logger.warn(`⚠️ Found ${softDeletedOrders.length} soft-deleted orders blocking table ${tableId}`);

      // Permanently delete these orders and their dependencies to free up the table
      const orderIds = softDeletedOrders.map(o => o.id);
      
      // Delete order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

      if (itemsError) {
        logger.warn(`Failed to clean up order items: ${itemsError.message}`);
      }

      // Delete kitchen tickets
      try {
        await supabase
          .from('kitchen_tickets')
          .delete()
          .in('order_id', orderIds);
      } catch (err) {
        logger.warn(`Failed to clean up kitchen tickets: ${err.message}`);
      }

      // Delete bills
      try {
        await supabase
          .from('order_bills')
          .delete()
          .in('order_id', orderIds);
      } catch (err) {
        // Table may not exist; ignore
      }

      // Hard delete the orders themselves to fully clear the table
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds)
        .eq('restaurant_id', restaurantId);

      if (deleteError) {
        logger.error(`Failed to delete soft-deleted orders: ${deleteError.message}`);
        throw deleteError;
      }

      logger.info(`✅ Cleaned up ${orderIds.length} soft-deleted orders blocking table ${tableId}`);
    } catch (err) {
      logger.warn(`Cleanup of soft-deleted orders failed: ${err.message}`);
      // Don't throw - this is best-effort cleanup
    }
  }

  static isMissingColumnError(error, columnName = '') {
    const normalizedColumnName = String(columnName || '').trim().toLowerCase();
    const combined = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    const isMissingError = combined.includes('could not find') || combined.includes('does not exist');
    return isMissingError && normalizedColumnName ? combined.includes(normalizedColumnName) : false;
  }

  static async getRestaurantTimezone(restaurantId) {
    const cacheKey = String(restaurantId || '').trim();
    const cachedEntry = this.restaurantTimezoneCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.timezone;
    }

    const existingPromise = this.restaurantTimezoneInFlight.get(cacheKey);
    if (existingPromise) {
      return await existingPromise;
    }

    const fetchPromise = (async () => {
      try {
        const { data: restaurant, error } = await supabase
          .from('restaurants')
          .select('timezone')
          .eq('id', restaurantId)
          .single();

        if (error || !restaurant) {
          throw error || new Error('Restaurant not found');
        }

        const timezone = restaurant.timezone || 'Asia/Kolkata';
        this.restaurantTimezoneCache.set(cacheKey, {
          timezone,
          expiresAt: Date.now() + this.RESTAURANT_TIMEZONE_CACHE_TTL_MS,
        });

        return timezone;
      } finally {
        this.restaurantTimezoneInFlight.delete(cacheKey);
      }
    })();

    this.restaurantTimezoneInFlight.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  static getMenuCatalogCacheKey(restaurantId, menuItemIds = []) {
    const normalizedRestaurantId = String(restaurantId || '').trim();
    const normalizedMenuItemIds = Array.from(new Set(menuItemIds.map((id) => String(id || '').trim()).filter(Boolean)))
      .sort()
      .join(',');

    return `${normalizedRestaurantId}:${normalizedMenuItemIds}`;
  }

  static async getRestaurantBillingSettings(restaurantId) {
    const cacheKey = String(restaurantId || '').trim();
    const cachedEntry = this.restaurantBillingSettingsCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.settings;
    }

    const existingPromise = this.restaurantBillingSettingsInFlight.get(cacheKey);
    if (existingPromise) {
      return await existingPromise;
    }

    const fetchPromise = (async () => {
      try {
        let restaurantSettings;

        try {
          const { data, error } = await supabase
            .from('restaurants')
            .select('id, enable_gst, default_gst_percent, default_cgst_percent, default_sgst_percent')
            .eq('id', restaurantId)
            .single();

          if (error) {
            throw error;
          }

          restaurantSettings = data;
        } catch (error) {
          // Graceful fallback for older schemas missing CGST/SGST split columns
          const missingCgst = this.isMissingColumnError(error, 'default_cgst_percent');
          const missingSgst = this.isMissingColumnError(error, 'default_sgst_percent');
          if (!missingCgst && !missingSgst) {
            throw error;
          }

          const { data: restaurant, error: fallbackError } = await supabase
            .from('restaurants')
            .select('id, enable_gst, default_gst_percent')
            .eq('id', restaurantId)
            .single();

          if (fallbackError || !restaurant) {
            throw fallbackError || error;
          }

          const fallbackGst = Number(restaurant.default_gst_percent ?? 5);
          const splitGst = this.roundCurrency(fallbackGst / 2);
          restaurantSettings = {
            ...restaurant,
            default_cgst_percent: splitGst,
            default_sgst_percent: splitGst,
          };
        }

        this.restaurantBillingSettingsCache.set(cacheKey, {
          settings: restaurantSettings,
          expiresAt: Date.now() + this.RESTAURANT_BILLING_SETTINGS_CACHE_TTL_MS,
        });

        return restaurantSettings;
      } finally {
        this.restaurantBillingSettingsInFlight.delete(cacheKey);
      }
    })();

    this.restaurantBillingSettingsInFlight.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  static async getMenuCatalogSnapshot(restaurantId, menuItemIds = []) {
    const normalizedMenuItemIds = Array.from(
      new Set(menuItemIds.map((id) => String(id || '').trim()).filter(Boolean))
    );

    if (normalizedMenuItemIds.length === 0) {
      return {
        menuItems: [],
        categoryMap: new Map(),
      };
    }

    const cacheKey = this.getMenuCatalogCacheKey(restaurantId, normalizedMenuItemIds);
    const cachedEntry = this.menuCatalogCache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && cachedEntry.expiresAt > now) {
      return cachedEntry.value;
    }

    const existingPromise = this.menuCatalogInFlight.get(cacheKey);
    if (existingPromise) {
      return await existingPromise;
    }

    const fetchPromise = (async () => {
      try {
        const { data: menuItems, error: menuItemsError } = await supabase
          .from('menu_items')
          .select('id, name, price, category_id, tags')
          .eq('restaurant_id', restaurantId)
          .in('id', normalizedMenuItemIds)
          .eq('status', 'active');

        if (menuItemsError) {
          throw menuItemsError;
        }

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

        const snapshot = {
          menuItems: menuItems || [],
          categoryMap,
        };

        this.menuCatalogCache.set(cacheKey, {
          value: snapshot,
          expiresAt: now + this.MENU_CATALOG_CACHE_TTL_MS,
        });

        return snapshot;
      } finally {
        this.menuCatalogInFlight.delete(cacheKey);
      }
    })();

    this.menuCatalogInFlight.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  static getDisplayOrderSequenceCacheKey(restaurantId, dateKey) {
    return `${String(restaurantId || '').trim()}:${String(dateKey || '').trim()}`;
  }

  static async reserveDisplayOrderNumber(restaurantId, timezone = 'Asia/Kolkata', createdAt = new Date().toISOString()) {
    const dateKey = this.getDisplayOrderDateKey(createdAt, timezone);
    const cacheKey = this.getDisplayOrderSequenceCacheKey(restaurantId, dateKey);
    const cachedEntry = this.displayOrderSequenceCache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && cachedEntry.expiresAt > now) {
      cachedEntry.nextSequence += 1;
      return this.formatDisplayOrderNumber(dateKey, cachedEntry.nextSequence);
    }

    const existingPromise = this.displayOrderSequenceInFlight.get(cacheKey);
    if (existingPromise) {
      await existingPromise;
      return await this.reserveDisplayOrderNumber(restaurantId, timezone, createdAt);
    }

    const warmupPromise = (async () => {
      try {
        const prefix = `ORD-${dateKey.replace(/-/g, '')}-`;
        const { data, error } = await supabase
          .from('orders')
          .select('display_order_number')
          .eq('restaurant_id', restaurantId)
          .like('display_order_number', `${prefix}%`)
          .order('display_order_number', { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        const latestSequence = this.extractDisplayOrderSequence(data?.[0]?.display_order_number, dateKey);

        this.displayOrderSequenceCache.set(cacheKey, {
          nextSequence: latestSequence,
          expiresAt: now + this.DISPLAY_ORDER_SEQUENCE_CACHE_TTL_MS,
        });
      } finally {
        this.displayOrderSequenceInFlight.delete(cacheKey);
      }
    })();

    this.displayOrderSequenceInFlight.set(cacheKey, warmupPromise);
    await warmupPromise;
    return await this.reserveDisplayOrderNumber(restaurantId, timezone, createdAt);
  }

  static async assignDisplayOrderNumber(restaurantId, orderId, createdAt, timezone = 'Asia/Kolkata') {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const displayOrderNumber = await this.reserveDisplayOrderNumber(restaurantId, timezone, createdAt);
      const { data, error } = await supabase
        .from('orders')
        .update({ display_order_number: displayOrderNumber })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .is('display_order_number', null)
        .select('id, display_order_number')
        .single();

      if (!error && data?.display_order_number) {
        return data.display_order_number;
      }

      if (error && !this.isUniqueConstraintError(error) && error.code !== 'PGRST116') {
        throw error;
      }

      const { data: existingOrder, error: existingError } = await supabase
        .from('orders')
        .select('display_order_number')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingError) {
        throw existingError;
      }

      if (existingOrder?.display_order_number) {
        return existingOrder.display_order_number;
      }
    }

    throw new Error('Unable to reserve a unique display order number');
  }

  static async backfillMissingDisplayOrderNumbers(restaurantId, timezone = 'Asia/Kolkata') {
    const { data: missingOrders, error } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('restaurant_id', restaurantId)
      .is('display_order_number', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw error;
    }

    for (const order of missingOrders || []) {
      await this.assignDisplayOrderNumber(restaurantId, order.id, order.created_at, timezone);
    }
  }

  static async attachDisplayNumbers(restaurantId, orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
      return orders || [];
    }

    const missingDisplayNumbers = orders.some((order) => !order?.displayOrderNumber);

    if (missingDisplayNumbers) {
      const timezone = await this.getRestaurantTimezone(restaurantId);
      await this.backfillMissingDisplayOrderNumbers(restaurantId, timezone);
    }

    const orderIds = orders.map((order) => order.id).filter(Boolean);
    const displayMap = new Map();
    const serialMap = new Map();

    if (orderIds.length > 0) {
      const { data: serialRows, error: serialError } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (serialError) {
        throw serialError;
      }

      (serialRows || []).forEach((row, index) => {
        serialMap.set(row.id, index + 1);
      });

      const { data, error } = await supabase
        .from('orders')
        .select('id, display_order_number')
        .in('id', orderIds);

      if (error) {
        throw error;
      }

      (data || []).forEach((row) => {
        if (row.display_order_number) {
          displayMap.set(row.id, row.display_order_number);
        }
      });
    }

    return orders.map((order) => ({
      ...order,
      serialNumber: serialMap.get(order.id) || null,
      displayOrderNumber:
        displayMap.get(order.id) ||
        order.displayOrderNumber ||
        this.buildFallbackDisplayOrderNumber(order.id),
    }));
  }

  /**
   * BACKFILL: Assign bill numbers to paid orders that don't have one yet
   * This handles orders settled before the bill numbering system was added
   */
  static async ensureOrderHasBillNumber(restaurantId, order) {
    if (!order) return order;
    
    const { publicNotes, kotMeta } = splitNotesAndKotMeta(order.notes || '');
    const hasInvoiceNumber = kotMeta.billing?.invoiceNumber;
    const isPaid = order.payment_status === 'paid';
    
    // If order is paid but doesn't have bill number, generate and save one
    if (isPaid && !hasInvoiceNumber) {
      try {
        const invoiceNumber = await this.getNextInvoiceNumber(restaurantId);
        const updatedKotMeta = {
          ...kotMeta,
          billing: {
            ...kotMeta.billing,
            invoiceNumber,
            invoiceDate: kotMeta.billing?.invoiceDate || order.updated_at || new Date().toISOString(),
          },
        };
        const updatedNotes = composeNotesWithKotMeta(publicNotes, updatedKotMeta);
        
        // Update order in database silently
        await supabase
          .from('orders')
          .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
          .eq('id', order.id)
          .eq('restaurant_id', restaurantId)
          .select()
          .maybeSingle();
        
        // Update the order object in memory
        const updatedOrder = { ...order, notes: updatedNotes };
        return updatedOrder;
      } catch (error) {
        logger.warn('Could not auto-generate bill number for paid order:', { orderId: order.id, error: error.message });
        // Don't break - return original order
        return order;
      }
    }
    
    return order;
  }

  // Helper function to transform snake_case to camelCase
  static transformOrder(order) {
    if (!order) return null;
    const normalizedStatus = this.normalizeOrderStatus(order.status);
    const { publicNotes, kotMeta } = splitNotesAndKotMeta(order.notes);
    const lineDetails = kotMeta.lineDetails || {};
    const aggregatedOrderItems = this.aggregateOrderItems(order.order_items, lineDetails);
    const kitchenTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
    const online = this.normalizeOnlineMeta(kotMeta.online, {
      orderType: order.order_type,
      paymentStatus: order.payment_status,
    });
    const loyalty = this.normalizeLoyaltyMeta(kotMeta.loyalty, {
      fallbackPhone: online.customerPhone,
    });
    const billing = this.normalizeBillingMeta(kotMeta.billing, {
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
    });
    const hasPersistedBilling =
      Boolean(billing.invoiceNumber) ||
      Boolean(billing.invoiceDate) ||
      billing.grandTotal > 0 ||
      billing.subtotal > 0;
    const isSettledOrder = order.payment_status === 'paid' || normalizedStatus === 'completed';
    const subtotalFromItems = this.roundCurrency(
      (order.order_items || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      )
    );
    const effectiveBilling = hasPersistedBilling || !isSettledOrder
      ? billing
      : this.normalizeBillingMeta(
          {
            invoiceNumber: order.invoice_number || '',
            invoiceDate: this.normalizeTimestamp(order.updated_at || order.created_at || new Date().toISOString()),
            subtotal: subtotalFromItems,
            grandTotal: Number(order.total_amount || 0),
            paidAmount: Number(order.total_amount || 0),
            paymentMode: order.payment_method || '',
          },
          {
            paymentMethod: order.payment_method,
            paymentStatus: order.payment_status,
          }
        );
    return {
      id: order.id,
      restaurantId: order.restaurant_id,
      tableId: order.table_id,
      // Read invoice_number from column first (primary source)
      // Fall back to JSON if column is NULL (for legacy data before migration)
      invoiceNumber: order.invoice_number || billing.invoiceNumber || '',
      orderSource: String(order.order_source || '').trim().toLowerCase() === 'qr' ? 'qr' : (
        kotMeta.system?.orderOrigin === 'qr' ? 'qr' : 'manual'
      ),
      origin: kotMeta.system?.orderOrigin || (normalizedStatus === 'awaiting_waiter_approval' ? 'qr' : 'pos'),
      requestId: order.request_id || '',
      status: normalizedStatus,
      orderType: online.fulfillmentType || order.order_type || (order.table_id ? 'dine-in' : 'takeaway'),
      totalAmount: order.total_amount,
      total: Number(order.total_amount || 0),
      finalAmount: Number(order.final_amount || effectiveBilling.grandTotal || order.total_amount || 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status || 'pending',
      billing: effectiveBilling,
      notes: publicNotes,
      createdAt: this.normalizeTimestamp(order.created_at),
      updatedAt: this.normalizeTimestamp(order.updated_at),
      displayOrderNumber: order.display_order_number || null,
      orderItems: aggregatedOrderItems,
      items: aggregatedOrderItems,
      kitchenTickets,
      activeKitchenTickets: kitchenTickets.filter((ticket) => ['pending', 'preparing', 'ready'].includes(ticket.status)),
      kitchenLastSentAt: kitchenTickets.length > 0 ? kitchenTickets[kitchenTickets.length - 1].createdAt : null,
      hasPendingKitchenItems: aggregatedOrderItems.some(
        (item) => !item.sentToKitchen && Number(item.quantity || 0) > 0
      ),
      online,
      loyalty,
      approvedDiscount:
        kotMeta.discountApproval?.percent > 0
          ? {
              percent: Number(kotMeta.discountApproval.percent || 0),
              note: kotMeta.discountApproval.note || '',
              approvedBy: kotMeta.discountApproval.approvedBy || '',
              approvedAt: this.normalizeTimestamp(kotMeta.discountApproval.approvedAt),
            }
          : null,
    };
  }

  static transformOrders(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.map(order => this.transformOrder(order));
  }

  static aggregateOrderItems(orderItems = [], lineDetails = {}) {
    const itemsByMenuItemId = new Map();

    (orderItems || []).forEach((item) => {
      const menuItemId = item.menu_item_id;
      const lineMeta = lineDetails[menuItemId] || {};
      const existing = itemsByMenuItemId.get(menuItemId) || {
        id: menuItemId || item.id,
        menuItemId,
        quantity: 0,
        unitPrice: Number(item.unit_price ?? item.price ?? 0),
        price: Number(item.unit_price ?? item.price ?? 0),
        name: item.menu_items?.name || item.name || `Item ${String(menuItemId || '').slice(0, 6)}`,
        preparationTime: item.menu_items?.preparation_time || 15,
        itemNote: lineMeta.note || '',
        modifiers: lineMeta.modifiers || [],
        station: lineMeta.station || 'Main Kitchen',
        categoryId: lineMeta.categoryId || null,
        categoryName: lineMeta.categoryName || '',
        sentToKitchen: true,
        kotId: item.kot_id || null,
      };

      existing.quantity += Number(item.quantity || 0);
      existing.sentToKitchen = existing.sentToKitchen && Boolean(item.sent_to_kitchen);
      existing.kotId = item.kot_id || existing.kotId || null;
      itemsByMenuItemId.set(menuItemId, existing);
    });

    return Array.from(itemsByMenuItemId.values());
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

  static normalizeOrderSource(value, fallback = 'manual') {
    const normalizedValue = String(value || fallback).trim().toLowerCase();
    return normalizedValue === 'qr' ? 'qr' : 'manual';
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

    if (activeTickets.some((ticket) => ticket.status === 'ready')) {
      return 'ready';
    }

    if (activeTickets.some((ticket) => ticket.status === 'preparing')) {
      return 'preparing';
    }

    if (activeTickets.some((ticket) => ticket.status === 'pending')) {
      return 'pending';
    }

    if (activeTickets.length > 0 && activeTickets.every((ticket) => ticket.status === 'completed')) {
      return 'completed';
    }

    return this.normalizeOrderStatus(fallbackStatus);
  }

  static syncKitchenTicketsWithOrderStatus(existingTickets = [], nextStatus, now = new Date().toISOString()) {
    const normalizedStatus = this.normalizeOrderStatus(nextStatus);
    const normalizedTickets = (existingTickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));

    if (!['pending', 'preparing', 'ready', 'completed'].includes(normalizedStatus) || normalizedTickets.length === 0) {
      return normalizedTickets;
    }

    const targetIndex = [...normalizedTickets]
      .reverse()
      .findIndex((ticket) => ['pending', 'preparing', 'ready'].includes(ticket.status));
    const resolvedIndex =
      targetIndex === -1 ? normalizedTickets.length - 1 : normalizedTickets.length - 1 - targetIndex;

    return normalizedTickets.map((ticket, index) =>
      index !== resolvedIndex
        ? ticket
        : {
            ...ticket,
            status: normalizedStatus,
            updatedAt: now,
            startedAt:
              normalizedStatus === 'preparing'
                ? ticket.startedAt || now
                : ticket.startedAt,
            readyAt: normalizedStatus === 'ready' ? now : ticket.readyAt,
            completedAt: normalizedStatus === 'completed' ? now : ticket.completedAt,
            servedAt: normalizedStatus === 'completed' ? now : ticket.servedAt,
          }
    );
  }

  static async validateOrderItems(restaurantId, items = [], options = {}) {
    // ✅ TASK 2: VALIDATE ITEMS - Check if empty
    if (!Array.isArray(items)) {
      logger.error('❌ Items validation failed: not an array', {
        restaurantId,
        receivedType: typeof items,
        enforceMenuPrice: options.enforceMenuPrice,
      });
      throw new Error('Order items must be an array');
    }

    if (items.length === 0) {
      logger.warn('⚠️ Items validation failed: empty array', {
        restaurantId,
        enforceMenuPrice: options.enforceMenuPrice,
      });
      throw new Error('At least one order item is required');
    }

    logger.debug('✅ Items array validation passed', {
      restaurantId,
      itemsCount: items.length,
      enforceMenuPrice: options.enforceMenuPrice,
    });

    // ✅ TASK 5: ADD DEBUG LOGS
    console.log('🔍 [VALIDATION] Items received:', {
      count: items.length,
      items: items.map(i => ({
        menuItemId: i.menuItemId || i.itemId,
        quantity: i.quantity,
        price: i.unitPrice || i.price,
      })),
    });

    const normalizedItems = this.normalizeOrderItems(items);
    const menuItemIds = normalizedItems.map((item) => item.menuItemId).filter(Boolean);
    const uniqueMenuItemIds = Array.from(new Set(menuItemIds));

    logger.debug('📝 Items normalized', {
      originalCount: items.length,
      normalizedCount: normalizedItems.length,
      uniqueMenuItemCount: uniqueMenuItemIds.length,
    });

    if (menuItemIds.length !== normalizedItems.length) {
      logger.error('❌ Items validation failed: missing menu item IDs', {
        restaurantId,
        itemsWithIds: menuItemIds.length,
        totalItems: normalizedItems.length,
      });
      throw new Error('Each order item must include a menu item ID');
    }

    const { menuItems, categoryMap } = await this.getMenuCatalogSnapshot(restaurantId, uniqueMenuItemIds);

    logger.debug('📚 Menu catalog snapshot retrieved', {
      restaurantId,
      requestedItemsCount: uniqueMenuItemIds.length,
      foundItemsCount: (menuItems || []).length,
    });

    if ((menuItems || []).length !== uniqueMenuItemIds.length) {
      logger.error('❌ Items validation failed: menu items not found', {
        restaurantId,
        requestedCount: uniqueMenuItemIds.length,
        foundCount: (menuItems || []).length,
        missingIds: uniqueMenuItemIds
          .filter(id => !(menuItems || []).find(m => m.id === id))
          .slice(0, 5),
      });
      throw new Error('One or more menu items are invalid or unavailable');
    }

    const menuItemMap = new Map((menuItems || []).map((item) => [item.id, item]));

    const finalItems = normalizedItems.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      const tags = String(menuItem?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const categoryName = categoryMap.get(menuItem?.category_id) || '';

      return {
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity || 0),
        unitPrice: this.resolveOrderItemUnitPrice(item.unitPrice, menuItem?.price, options),
        name: item.name || menuItem?.name || '',
        itemNote: this.sanitizeLineNote(item.itemNote),
        modifiers: this.parseModifierList(item.modifiers),
        categoryId: menuItem?.category_id || null,
        categoryName,
        station: this.resolveKitchenStation({ tags, categoryName }),
      };
    });

    logger.info('✅ All items validated successfully', {
      restaurantId,
      totalItems: finalItems.length,
      totalInvoiceAmount: finalItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0),
    });

    console.log('✅ [VALIDATION] Items validated:', {
      count: finalItems.length,
      total: finalItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0),
    });

    return finalItems;
  }

  static computeOrderTotal(items = []) {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  static resolveOrderItemUnitPrice(requestedUnitPrice, menuItemPrice, options = {}) {
    const catalogPrice = Number(menuItemPrice ?? 0);
    const normalizedCatalogPrice = Number.isFinite(catalogPrice) && catalogPrice > 0 ? catalogPrice : 0;

    if (options.enforceMenuPrice) {
      return normalizedCatalogPrice;
    }

    const requestedPrice = Number(requestedUnitPrice);
    if (Number.isFinite(requestedPrice) && requestedPrice > 0) {
      return requestedPrice;
    }

    return normalizedCatalogPrice;
  }

  static resolvePersistedOrderTotal(requestedTotalAmount, computedTotalAmount) {
    const computedTotal = Number(computedTotalAmount ?? 0);
    const normalizedComputedTotal = Number.isFinite(computedTotal) && computedTotal > 0 ? computedTotal : 0;

    const requestedTotal = Number(requestedTotalAmount);
    if (Number.isFinite(requestedTotal) && requestedTotal > 0) {
      return requestedTotal;
    }

    return normalizedComputedTotal;
  }

  static normalizePaymentMethod(method) {
    if (!method) {
      return 'cash';
    }

    const normalizedMethod = String(method).trim().toLowerCase();
    return ['cash', 'upi'].includes(normalizedMethod) ? normalizedMethod : null;
  }

  static normalizeDiscountPercent(value) {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      throw new Error('Discount percent must be a valid positive number');
    }

    return Number(normalizedValue.toFixed(2));
  }

  static normalizeOnlineSource(source) {
    if (source === null) {
      return null;
    }

    if (!source) {
      return undefined;
    }

    const normalizedSource = String(source).trim().toLowerCase();
    return this.ONLINE_SOURCES.includes(normalizedSource) ? normalizedSource : null;
  }

  static normalizeOnlineWorkflowStatus(status, fallback = 'new') {
    if (status === null) {
      return null;
    }

    if (!status) {
      return fallback;
    }

    const normalizedStatus = String(status).trim().toLowerCase();
    return this.ONLINE_WORKFLOW_STATUSES.includes(normalizedStatus) ? normalizedStatus : fallback;
  }

  static normalizeOnlinePaymentState(value, fallback = 'pending') {
    if (value === null) {
      return null;
    }

    if (!value) {
      return fallback;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    return this.ONLINE_PAYMENT_STATES.includes(normalizedValue) ? normalizedValue : fallback;
  }

  static normalizeOnlineMeta(online = {}, context = {}) {
    const inferredSource =
      this.normalizeOnlineSource(online?.source) ??
      (context.orderType && context.orderType !== 'dine-in' ? 'direct' : null);
    const fulfillmentType = ['delivery', 'takeaway'].includes(String(online?.fulfillmentType || '').trim().toLowerCase())
      ? String(online.fulfillmentType).trim().toLowerCase()
      : context.orderType && context.orderType !== 'dine-in'
        ? context.orderType
        : null;
    const inferredPaymentState =
      online?.paymentState !== undefined && online?.paymentState !== null
        ? this.normalizeOnlinePaymentState(online.paymentState)
        : context.paymentStatus === 'paid'
          ? 'paid'
          : inferredSource
            ? 'pending'
            : null;

    return {
      source: inferredSource,
      fulfillmentType,
      workflowStatus: inferredSource ? this.normalizeOnlineWorkflowStatus(online?.workflowStatus, 'new') : null,
      promisedAt: this.normalizeTimestamp(online?.promisedAt || null),
      paymentState: inferredPaymentState,
      customerName: String(online?.customerName || '').trim(),
      customerPhone: String(online?.customerPhone || '').trim(),
      customerAddress: String(online?.customerAddress || '').trim(),
      channelOrderId: String(online?.channelOrderId || '').trim(),
      acceptedAt: this.normalizeTimestamp(online?.acceptedAt || null),
      rejectedAt: this.normalizeTimestamp(online?.rejectedAt || null),
      readyAt: this.normalizeTimestamp(online?.readyAt || null),
      dispatchedAt: this.normalizeTimestamp(online?.dispatchedAt || null),
    };
  }

  static mergeOnlineMeta(existingOnline = {}, nextOnline = {}, context = {}) {
    const baseOnline = this.normalizeOnlineMeta(existingOnline, context);
    const mergedOnline = {
      ...baseOnline,
      ...(nextOnline || {}),
    };

    return this.normalizeOnlineMeta(mergedOnline, context);
  }

  static mapOnlineWorkflowToOrderStatus(workflowStatus, currentStatus) {
    switch (workflowStatus) {
      case 'accepted':
        return currentStatus === 'awaiting_waiter_approval' ? 'pending' : currentStatus || 'pending';
      case 'preparing':
        return 'preparing';
      case 'ready':
        return 'ready';
      case 'dispatched':
        return 'completed';
      case 'rejected':
        return 'cancelled';
      default:
        return currentStatus;
    }
  }

  static appendOrderNote(existingNotes = '', noteToAppend = '') {
    return appendPublicNote(existingNotes, noteToAppend);
  }

  static buildAuditActor(actor = {}) {
    return {
      role: actor.actorRole || 'unknown',
      userId: actor.actorUserId || '',
      name: actor.actorName || '',
    };
  }

  static summarizeItemsForAudit(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      menuItemId: item.menuItemId || item.menu_item_id || item.id || '',
      name: item.name || item.menu_items?.name || '',
      quantity: Number(item.quantity || item.qty || 0),
      unitPrice: Number(item.unitPrice ?? item.unit_price ?? item.price ?? 0),
    }));
  }

  static logAuditEvent(action, payload = {}) {
    logger.info('Order audit event', {
      audit: true,
      domain: 'orders',
      action,
      ...payload,
      occurredAt: new Date().toISOString(),
    });
  }

  static normalizeLoyaltyPhone(value = '') {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    if (normalized.length < 10) {
      return '';
    }

    return normalized.slice(-10);
  }

  static normalizeRedeemPoints(value) {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      throw new Error('Redeem points must be a valid positive number');
    }

    return Math.floor(parsedValue);
  }

  static canManageBilling(actorRole) {
    const normalizedRole = normalizeRole(actorRole);
    return ['admin', 'manager'].includes(normalizedRole);
  }

  static assertBillingChangesAllowed(actorRole, requestedTotalAmount, computedTotalAmount) {
    if (this.canManageBilling(actorRole)) {
      return;
    }

    if (requestedTotalAmount === undefined || requestedTotalAmount === null || requestedTotalAmount === '') {
      return;
    }

    const normalizedRequestedTotal = Number(requestedTotalAmount);
    const normalizedComputedTotal = Number(computedTotalAmount || 0);

    if (Number.isFinite(normalizedRequestedTotal) && normalizedRequestedTotal < normalizedComputedTotal) {
      throw new Error('Unauthorized: Only manager can perform billing actions');
    }
  }

  static calculateEarnedLoyaltyPoints(amount = 0) {
    const normalizedAmount = Number(amount || 0);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return 0;
    }

    return Math.floor(normalizedAmount / this.LOYALTY_EARN_RATE_RUPEES);
  }

  static normalizeLoyaltyMeta(loyalty = {}, { fallbackPhone = '' } = {}) {
    return {
      customerPhone: this.normalizeLoyaltyPhone(loyalty?.customerPhone || fallbackPhone || ''),
      earnedPoints: Math.max(0, Number(loyalty?.earnedPoints || 0)),
      redeemedPoints: Math.max(0, Number(loyalty?.redeemedPoints || 0)),
      redeemedAmount: Math.max(0, Number(loyalty?.redeemedAmount || 0)),
      availablePointsBefore: Math.max(0, Number(loyalty?.availablePointsBefore || 0)),
      availablePointsAfter: Math.max(0, Number(loyalty?.availablePointsAfter || 0)),
      finalPayableTotal: Math.max(0, Number(loyalty?.finalPayableTotal || 0)),
      settledAt: this.normalizeTimestamp(loyalty?.settledAt || null),
    };
  }

  static normalizeChargeValue(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return 0;
    }

    return Number(numericValue.toFixed(2));
  }

  static roundCurrency(value) {
    const numericValue = Number(value || 0);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Number(numericValue.toFixed(2));
  }

  static generateInvoiceNumber(order) {
    const createdAt = this.normalizeTimestamp(order?.created_at || order?.createdAt || new Date().toISOString()) || new Date().toISOString();
    const datePart = createdAt.slice(0, 10).replace(/-/g, '');
    const suffix = String(order?.display_order_number || order?.displayOrderNumber || order?.id || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(-6)
      .toUpperCase();

    return `INV-${datePart}-${suffix || '000001'}`;
  }

  static invoiceCounterErrorToUserMessage(error) {
    const combined = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();

    if (
      combined.includes('invoice_counters') ||
      combined.includes('get_next_invoice_number') ||
      combined.includes('set_invoice_counter_config')
    ) {
      return new Error(
        'Database schema is missing the invoice counter setup. Run backend/src/config/migrations/2026-04-06-add-invoice-counter.sql and retry.'
      );
    }

    return error;
  }

  static async getNextInvoiceNumber(restaurantId) {
    try {
      const result = await InvoiceService.generateNextInvoiceNumber(restaurantId);
      return result.invoiceNumber;
    } catch (error) {
      throw this.invoiceCounterErrorToUserMessage(error);
    }
  }

  static normalizeBillingMeta(billing = {}, context = {}) {
    return {
      invoiceNumber: billing?.invoiceNumber || '',
      invoiceDate: this.normalizeTimestamp(billing?.invoiceDate || null),
      subtotal: Math.max(0, Number(billing?.subtotal || 0)),
      orderDiscountAmount: Math.max(0, Number(billing?.orderDiscountAmount || 0)),
      managerDiscountPercent: Math.max(0, Number(billing?.managerDiscountPercent || 0)),
      managerDiscountAmount: Math.max(0, Number(billing?.managerDiscountAmount || 0)),
      taxableAmount: Math.max(0, Number(billing?.taxableAmount || 0)),
      gstPercent: Math.max(0, Number(billing?.gstPercent || 0)),
      cgstRate: Math.max(0, Number(billing?.cgstRate || 0)),
      sgstRate: Math.max(0, Number(billing?.sgstRate || 0)),
      cgstAmount: Math.max(0, Number(billing?.cgstAmount || 0)),
      sgstAmount: Math.max(0, Number(billing?.sgstAmount || 0)),
      packingCharge: this.normalizeChargeValue(billing?.packingCharge),
      serviceCharge: this.normalizeChargeValue(billing?.serviceCharge),
      deliveryCharge: this.normalizeChargeValue(billing?.deliveryCharge),
      chargesTotal: Math.max(0, Number(billing?.chargesTotal || 0)),
      loyaltyRedeemedAmount: Math.max(0, Number(billing?.loyaltyRedeemedAmount || 0)),
      loyaltyRedeemedPoints: Math.max(0, Number(billing?.loyaltyRedeemedPoints || 0)),
      roundOff: Number(billing?.roundOff || 0),
      grandTotal: Math.max(0, Number(billing?.grandTotal || 0)),
      paymentMode: billing?.paymentMode || context.paymentMethod || '',
      paidAmount: Math.max(0, Number(billing?.paidAmount || 0)),
      cashierName: billing?.cashierName || '',
      paymentStatus: context.paymentStatus || '',
    };
  }

  static hasMeaningfulBillingMeta(billing = {}) {
    return Boolean(
      billing?.invoiceNumber ||
      billing?.invoiceDate ||
      Number(billing?.subtotal || 0) > 0 ||
      Number(billing?.grandTotal || 0) > 0 ||
      Number(billing?.cgstAmount || 0) > 0 ||
      Number(billing?.sgstAmount || 0) > 0 ||
      Number(billing?.chargesTotal || 0) > 0 ||
      Number(billing?.loyaltyRedeemedAmount || 0) > 0 ||
      Number(billing?.managerDiscountPercent || 0) > 0
    );
  }

  static async getLoyaltyProfile(restaurantId, phone, options = {}) {
    const normalizedPhone = this.normalizeLoyaltyPhone(phone);

    if (!normalizedPhone) {
      return {
        customerPhone: '',
        pointsBalance: 0,
        totalEarnedPoints: 0,
        totalRedeemedPoints: 0,
        totalRedeemedAmount: 0,
        totalSpend: 0,
        visitCount: 0,
        lastVisitAt: null,
        recentOrders: [],
      };
    }

    const { excludeOrderId = '' } = options;
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status, payment_status, notes')
      .eq('restaurant_id', restaurantId)
      .or('status.eq.completed,payment_status.eq.paid')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const matchingOrders = (orders || [])
      .filter((order) => order.id !== excludeOrderId)
      .map((order) => {
        const { kotMeta } = splitNotesAndKotMeta(order.notes);
        const loyalty = this.normalizeLoyaltyMeta(kotMeta.loyalty, {
          fallbackPhone: kotMeta.online?.customerPhone,
        });

        if (loyalty.customerPhone !== normalizedPhone) {
          return null;
        }

        return {
          id: order.id,
          createdAt: this.normalizeTimestamp(order.created_at),
          totalAmount: Number(order.total_amount || 0),
          loyalty,
        };
      })
      .filter(Boolean);

    const totalEarnedPoints = matchingOrders.reduce((sum, order) => sum + order.loyalty.earnedPoints, 0);
    const totalRedeemedPoints = matchingOrders.reduce((sum, order) => sum + order.loyalty.redeemedPoints, 0);
    const totalRedeemedAmount = matchingOrders.reduce((sum, order) => sum + order.loyalty.redeemedAmount, 0);
    const totalSpend = matchingOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    return {
      customerPhone: normalizedPhone,
      pointsBalance: Math.max(0, totalEarnedPoints - totalRedeemedPoints),
      totalEarnedPoints,
      totalRedeemedPoints,
      totalRedeemedAmount: Number(totalRedeemedAmount.toFixed(2)),
      totalSpend: Number(totalSpend.toFixed(2)),
      visitCount: matchingOrders.length,
      lastVisitAt: matchingOrders[0]?.createdAt || null,
      recentOrders: matchingOrders.slice(0, 5),
    };
  }

  static formatSettlementNote({
    method,
    amountReceived,
    changeDue,
    paymentNote,
    discountPercent = 0,
    discountAmount = 0,
    originalTotal = 0,
    finalTotal = 0,
    actorName = '',
    loyaltyPhone = '',
    redeemedPoints = 0,
    redeemedAmount = 0,
    earnedPoints = 0,
  }) {
    const noteParts = [`[Settlement ${new Date().toISOString()}] ${String(method || '').toUpperCase()} bill created with payment pending`];

    if (discountPercent > 0) {
      noteParts.push(`discount ${Number(discountPercent).toFixed(2)}%`);
      noteParts.push(`discount amount ${Number(discountAmount).toFixed(2)}`);
      noteParts.push(`original total ${Number(originalTotal).toFixed(2)}`);
      noteParts.push(`final total ${Number(finalTotal).toFixed(2)}`);
      if (actorName) {
        noteParts.push(`approved by ${actorName}`);
      }
    }

    if (method === 'cash' && Number.isFinite(amountReceived)) {
      noteParts.push(`received ${Number(amountReceived).toFixed(2)}`);
      noteParts.push(`change ${Number(changeDue || 0).toFixed(2)}`);
    }

    if (paymentNote) {
      noteParts.push(`note: ${paymentNote}`);
    }

    if (loyaltyPhone) {
      noteParts.push(`loyalty phone ${loyaltyPhone}`);
    }

    if (redeemedPoints > 0) {
      noteParts.push(`redeemed ${redeemedPoints} points`);
      noteParts.push(`loyalty discount ${Number(redeemedAmount).toFixed(2)}`);
    }

    if (earnedPoints > 0) {
      noteParts.push(`earned ${earnedPoints} loyalty points`);
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

  static buildCreateRequestKey(restaurantId, requestId) {
    const normalizedRestaurantId = String(restaurantId || '').trim();
    const normalizedRequestId = this.normalizeRequestId(requestId);

    if (!normalizedRestaurantId || !normalizedRequestId) {
      return '';
    }

    return `${normalizedRestaurantId}:${normalizedRequestId}`;
  }

  static async runCreateOrderWithRequestLock(restaurantId, requestId, factory) {
    const lockKey = this.buildCreateRequestKey(restaurantId, requestId);

    if (!lockKey) {
      return await factory();
    }

    const existingPromise = this.inFlightCreateRequests.get(lockKey);
    if (existingPromise) {
      return await existingPromise;
    }

    const createPromise = (async () => {
      try {
        return await factory();
      } finally {
        this.inFlightCreateRequests.delete(lockKey);
      }
    })();

    this.inFlightCreateRequests.set(lockKey, createPromise);
    return await createPromise;
  }

  static async createOrder(restaurantId, orderData, options = {}) {
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
        console.log('ERROR:', { message: 'Missing restaurant_id', tableId: orderData.tableId });
        throw new Error('Restaurant ID is required or table ID must be provided');
      }

      console.log('ORDER:', { restaurantId: finalRestaurantId, tableId: orderData.tableId, waiterId: options.userId, phase: 'init' });

      const normalizedRequestId = this.normalizeRequestId(orderData.requestId || orderData.request_id);
      if (normalizedRequestId && !options._requestLockApplied) {
        return await this.runCreateOrderWithRequestLock(finalRestaurantId, normalizedRequestId, async () =>
          this.createOrder(
            finalRestaurantId,
            {
              ...orderData,
              requestId: normalizedRequestId,
              request_id: normalizedRequestId,
            },
            {
              ...options,
              _requestLockApplied: true,
            }
          )
        );
      }

      const normalizedOrderType = this.normalizeOrderType(orderData.orderType, orderData.tableId ? 'dine-in' : 'takeaway');
      const resolvedTableId = normalizedOrderType === 'dine-in' ? orderData.tableId : null;
      const normalizedOrderSource = this.normalizeOrderSource(orderData.orderSource || orderData.origin, orderData.origin === 'qr' ? 'qr' : 'manual');

      const createdAt = new Date().toISOString();
      const [restaurantTimezone, normalizedItems, existingOpenBill] = await Promise.all([
        this.getRestaurantTimezone(finalRestaurantId),
        this.validateOrderItems(finalRestaurantId, orderData.items, {
          enforceMenuPrice: options.actorRole === 'manager',
        }),
        normalizedOrderType === 'dine-in' && resolvedTableId
          ? this.getActiveOrderByTable(finalRestaurantId, resolvedTableId)
          : Promise.resolve(null),
      ]);

      if (existingOpenBill) {
        return this.buildExistingOpenBillResult(existingOpenBill);
      }

      const computedTotalAmount = this.computeOrderTotal(normalizedItems);
      // ✅ FIXED: Allow waiters to create orders - don't enforce billing restrictions on order creation
      // Only enforce billing restrictions on actual billing operations (discounts, settlements, payments)
      // Waiters have 'manage_orders' permission which covers order creation
      // this.assertBillingChangesAllowed(options.actorRole, orderData.totalAmount, computedTotalAmount);
      const initialStatus = orderData.requiresWaiterApproval ? 'awaiting_waiter_approval' : 'pending';
      const initialOnlineMeta = this.normalizeOnlineMeta(orderData.online, {
        orderType: normalizedOrderType,
        paymentStatus: 'pending',
      });
      const initialKotMeta = {
        lineDetails: this.buildLineDetailsMap(normalizedItems),
        system: {
          orderOrigin: orderData.origin === 'qr' ? 'qr' : 'pos',
        },
        online: initialOnlineMeta,
        kitchen: {
          lastSentSnapshot: [],
          tickets: [],
        },
      };

      let order = null;
      let error = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const reservedDisplayOrderNumber = await this.reserveDisplayOrderNumber(
          finalRestaurantId,
          restaurantTimezone,
          createdAt
        );

          const insertPayload = {
            restaurant_id: finalRestaurantId,
            table_id: resolvedTableId,
            waiter_id: options.userId || null,
            order_type: normalizedOrderType,
            status: initialStatus,
            total_amount: this.resolvePersistedOrderTotal(orderData.totalAmount, computedTotalAmount),
            final_amount: this.resolvePersistedOrderTotal(orderData.totalAmount, computedTotalAmount),
            display_order_number: reservedDisplayOrderNumber,
            request_id: normalizedRequestId || null,
            payment_method: this.normalizePaymentMethod(orderData.paymentMethod) || 'cash',
            payment_status: 'pending',
            order_source: normalizedOrderSource,
            notes: composeNotesWithKotMeta(orderData.notes || '', initialKotMeta),
            created_at: createdAt,
            updated_at: createdAt,
          };

          let insertResult = await supabase
            .from('orders')
            .insert([insertPayload])
            .select(
              'id, restaurant_id, table_id, waiter_id, order_type, status, total_amount, final_amount, display_order_number, request_id, payment_method, payment_status, order_source, notes, created_at, updated_at'
            )
            .single();

          // If waiter_id column doesn't exist, try without it
          if (insertResult.error && this.isMissingColumnError(insertResult.error, 'waiter_id')) {
            const { waiter_id, ...payloadWithoutWaiterId } = insertPayload;
            insertResult = await supabase
              .from('orders')
              .insert([payloadWithoutWaiterId])
              .select(
                'id, restaurant_id, table_id, order_type, status, total_amount, final_amount, display_order_number, request_id, payment_method, payment_status, order_source, notes, created_at, updated_at'
              )
              .single();
          }

          if (insertResult.error && this.isMissingColumnError(insertResult.error, 'final_amount')) {
            const { final_amount, ...legacyInsertPayload } = insertPayload;
            insertResult = await supabase
              .from('orders')
              .insert([legacyInsertPayload])
              .select(
                'id, restaurant_id, table_id, waiter_id, order_type, status, total_amount, display_order_number, request_id, payment_method, payment_status, order_source, notes, created_at, updated_at'
              )
              .single();
          }

          // Final fallback - neither waiter_id nor final_amount columns
          if (insertResult.error && (this.isMissingColumnError(insertResult.error, 'waiter_id') || this.isMissingColumnError(insertResult.error, 'final_amount'))) {
            const { waiter_id, final_amount, ...minimalPayload } = insertPayload;
            insertResult = await supabase
              .from('orders')
              .insert([minimalPayload])
              .select(
                'id, restaurant_id, table_id, order_type, status, total_amount, display_order_number, request_id, payment_method, payment_status, order_source, notes, created_at, updated_at'
              )
              .single();
          }

        order = insertResult.data;
        error = insertResult.error;

        if (error) {
          logger.error('Order validation failed', { 
            code: error.code,
            message: error.message,
            details: error.details,
            attempt: attempt + 1,
          });
        } else {
          logger.debug('Order data prepared', { 
            id: order?.id,
            restaurant_id: order?.restaurant_id,
            table_id: order?.table_id,
            waiter_id: order?.waiter_id,
            status: order?.status,
          });
        }

        logger.debug(`📝 Order insert attempt ${attempt + 1}:`, {
          orderId: order?.id,
          restaurantId: finalRestaurantId,
          tableId: resolvedTableId,
          waiterId: options.userId,
          error: error ? { message: error.message, code: error.code, details: error.details } : null,
        });

        if (!error) {
          break;
        }

        if (!this.isUniqueConstraintError(error)) {
          logger.error(`❌ Order creation failed (attempt ${attempt + 1}):`, {
            message: error.message,
            code: error.code,
            details: error.details,
            payload: insertPayload,
          });
          throw error;
        }

        // ✅ HANDLE UNIQUE CONSTRAINT ERROR (duplicate open bill for table)
        if (this.isUniqueConstraintError(error)) {
          logger.warn('📋 Unique constraint violation - checking for existing open bill', {
            restaurantId: finalRestaurantId,
            tableId: resolvedTableId,
            attempt: attempt + 1,
          });

          // Check if there's an existing open bill for this table
          const existingBill = await this.getActiveOrderByTable(finalRestaurantId, resolvedTableId);
          if (existingBill) {
            logger.info('✅ Found existing open bill, returning it instead of creating new order', {
              orderId: existingBill.id,
              tableId: resolvedTableId,
            });
            return this.buildExistingOpenBillResult(existingBill);
          }

          // ✅ NEW: If no active bill found, check for soft-deleted orders blocking the table
          if (attempt < 3) {
            logger.info('🔍 No active bill found, checking for soft-deleted orders blocking the table...');
            await this.cleanupSoftDeletedOrdersBlockingTableCreation(finalRestaurantId, resolvedTableId);
          }

          // If no existing bill found, this is unexpected - log and retry
          logger.warn('⚠️ Unique constraint error but no existing bill found - retrying', {
            tableId: resolvedTableId,
            attempt: attempt + 1,
          });
        }

        if (normalizedRequestId) {
          const { data: duplicateRequestedOrder, error: duplicateRequestedOrderError } = await supabase
            .from('orders')
            .select('id')
            .eq('restaurant_id', finalRestaurantId)
            .eq('request_id', normalizedRequestId)
            .maybeSingle();

          if (duplicateRequestedOrderError) {
            throw duplicateRequestedOrderError;
          }

          if (duplicateRequestedOrder?.id) {
            return await this.getOrderById(finalRestaurantId, duplicateRequestedOrder.id);
          }
        }
      }

      if (error) {
        const fullError = {
          message: error.message,
          code: error.code,
          details: error.details,
        };
        logger.error('Order insert failed', fullError);
        throw error;
      }

      if (!order || !order.id) {
        const schemaError = {
          message: 'Order response missing ID',
          restaurantId: finalRestaurantId,
          tableId: resolvedTableId,
          response: order,
        };
        logger.error('Order created but response missing ID', schemaError);
        throw new Error('Order was not created properly - missing ID in response');
      }

      logger.info(`Order created: ${order.id}`);

      // Add items if order was successfully created
      let successfullyAddedItems = [];
      if (order?.id && normalizedItems.length > 0) {
        try {
          logger.debug(`Adding ${normalizedItems.length} items to order ${order.id}`);
          await this.addOrderItems(order.id, normalizedItems);
          successfullyAddedItems = normalizedItems;
          logger.info(`Items added to order ${order.id}`);
        } catch (orderItemsError) {
          logger.error(`Failed to add items to order ${order.id}`, {
            message: orderItemsError.message,
            items: normalizedItems.length,
          });
          successfullyAddedItems = [];
          
          // 🛑 DO NOT PROCEED - Order has no items, KOT cannot be created
          throw new Error(
            `Order ${order.id} created but failed to add items. Reverting order. ${orderItemsError.message}`
          );
        }
      } else if (order?.id && normalizedItems.length === 0) {
        logger.warn(`Order created with 0 items`);
        throw new Error('Cannot create order: Cart is empty, add at least one item');
      }

      // Build complete response with ONLY items that were successfully added to database
      const completeOrder = this.buildCreatedOrderResponse(order, successfullyAddedItems, {
        tableNumber: normalizedOrderType === 'dine-in' ? (orderData.tableNumber || null) : null,
      });

      // ✅ Update table status ONLY after order AND items are successfully created
      // ⚡ Fire-and-forget: Don't await table update - it shouldn't block order response
      if (resolvedTableId) {
        TableService.syncTableLifecycle(finalRestaurantId, resolvedTableId)
          .then(() => logger.info(`✅ Table ${resolvedTableId} status updated to occupied for order ${order.id}`))
          .catch(tableError => logger.warn(`Failed to update table status`, {
            orderId: order.id,
            message: tableError.message,
          }));
        // ✅ OPTIMIZATION: Invalidate table state cache since order was created
        TableService.invalidateActiveTableStateCache(finalRestaurantId);
      }

      this.emitOrderEvent(finalRestaurantId, 'order.created', completeOrder, {
        requiresWaiterApproval: initialStatus === 'awaiting_waiter_approval',
      });

      return completeOrder;
    } catch (error) {
      logger.error('❌ Create order error:', error);
      throw error;
    }
  }

  static async addOrderItems(orderId, items, options = {}) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required to add items');
      }

      // ✅ TASK 5: ADD DEBUG LOGS
      logger.debug('📥 Adding items to order', {
        orderId,
        itemsCount: items.length,
        selectResult: options.selectResult,
      });

      console.log('📥 [ITEMS] Adding to order:', {
        orderId,
        count: items.length,
        items: items.map(i => ({
          menuItemId: i.menuItemId || i.itemId,
          quantity: i.quantity,
          unitPrice: i.unitPrice ?? i.price ?? 0,
        })),
      });

      const itemsToInsert = items.map(item => ({
        order_id: orderId,
        menu_item_id: item.menuItemId || item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice ?? item.price ?? 0,
        sent_to_kitchen: Boolean(item.sentToKitchen),
        kot_id: item.kotId || null,
      }));

      logger.debug(`Inserting ${itemsToInsert.length} items:`, itemsToInsert.map(it => ({
        order_id: it.order_id,
        menu_item_id: it.menu_item_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })));

      console.log('📝 [ITEMS] Insert payload:', itemsToInsert);

      let query = supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (options.selectResult) {
        query = query.select();
      }

      const { data: orderItems, error } = await query;

      if (error) {
        const errorDetails = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          orderId,
          itemCount: itemsToInsert.length,
          itemsPayload: itemsToInsert,
        };
        console.error('❌ Order Items Insert Error:', { items: itemsToInsert, error }); // 🎯 Direct logging
        logger.error('Supabase error inserting items:', errorDetails);
        throw error;
      }

      logger.info(`✅ ${items.length} items successfully added to order ${orderId}`, {
        orderId,
        itemsCount: items.length,
        insertedRows: orderItems?.length || 0,
      });

      console.log('✅ [ITEMS] Successfully inserted:', {
        orderId,
        count: items.length,
      });

      return orderItems;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        orderId,
        itemCount: items.length,
        items: items.map(it => ({ menuItemId: it.menuItemId, quantity: it.quantity, unitPrice: it.unitPrice })),
      };
      console.error('❌ Add Order Items Error:', { error: errorDetails, items }); // 🎯 Direct logging
      logger.error('❌ Add order items error:', errorDetails);
      throw error;
    }
  }

  static buildCreatedOrderResponse(order, items = [], context = {}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const rawOrder = {
      ...order,
      order_items: normalizedItems.map((item) => ({
        id: item.menuItemId,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        unit_price: item.unitPrice ?? item.price ?? 0,
        sent_to_kitchen: Boolean(item.sentToKitchen),
        kot_id: item.kotId || null,
        menu_items: {
          name: item.name || '',
          preparation_time: item.preparationTime || 15,
        },
      })),
      tables: context.tableNumber ? { table_number: context.tableNumber } : null,
    };

    const transformedOrder = {
      ...this.transformOrder(rawOrder),
      tableNumber: context.tableNumber || null,
      table: rawOrder.tables || null,
      serialNumber: null,
      displayOrderNumber:
        order.display_order_number ||
        order.displayOrderNumber ||
        this.buildFallbackDisplayOrderNumber(order.id),
    };

    return transformedOrder;
  }

  static async fetchOrderRecord(restaurantId, orderId, isDeveloper = false) {
    let query = supabase
      .from('orders')
      .select(`
        id,
        restaurant_id,
        table_id,
        status,
        total_amount,
        final_amount,
        display_order_number,
        invoice_number,
        request_id,
        payment_method,
        payment_status,
        order_type,
        order_source,
        notes,
        created_at,
        updated_at,
        order_items (
          id,
          menu_item_id,
          quantity,
          unit_price,
          sent_to_kitchen,
          kot_id,
          menu_items (
            name,
            preparation_time
          )
        ),
        tables!table_id (
          table_number
        )
      `)
      .eq('id', orderId);

    // Apply restaurant filter for non-developers
    if (!isDeveloper) {
      query = query.eq('restaurant_id', restaurantId);
    }

    const { data: order, error } = await query.single();

    if (error || !order) throw error || new Error('Order not found');

    return order;
  }

  static async getOrderById(restaurantId, orderId, user = null) {
    try {
      const normalizedRole = normalizeRole(user?.role);
      const isDeveloper = normalizedRole === 'developer';

      let order = await this.fetchOrderRecord(restaurantId, orderId, isDeveloper);
      const effectiveRestaurantId = restaurantId || order.restaurant_id;

      // BACKFILL: Ensure paid orders have bill numbers
      order = await this.ensureOrderHasBillNumber(effectiveRestaurantId, order);

      // SECURITY: Validate order belongs to restaurant before returning
      // Prevents cross-restaurant data leaks for GST, invoice data, etc.
      if (!isDeveloper) {
        validateOrderBelongsToRestaurant(restaurantId, order);
      }

      // Transform and include table information
      const transformedOrder = {
        ...this.transformOrder(order),
        tableNumber: order.tables?.table_number || null,
        table: order.tables,
      };
      const [orderWithDisplayNumber] = await this.attachDisplayNumbers(effectiveRestaurantId, [transformedOrder]);
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
          sent_to_kitchen,
          kot_id,
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

      if (filters.orderType) {
        query = query.eq('order_type', this.normalizeOrderType(filters.orderType));
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
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, table_id, order_type, order_source, status, notes, payment_status')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) throw existingOrderError || new Error('Order not found');

      // SECURITY: Prevent reverting paid orders to earlier states
      if (existingOrder.payment_status === 'paid' && !['completed', 'cancelled'].includes(normalizedStatus)) {
        throw new Error('Cannot revert a paid order to an earlier state. Paid orders can only be completed or cancelled.');
      }

      const existingOrderType = this.normalizeOrderType(existingOrder.order_type, existingOrder.table_id ? 'dine-in' : 'takeaway');
      if (normalizedStatus === 'completed' && existingOrderType !== 'takeaway') {
        throw new Error('Bills can only be completed through POS settlement');
      }

      const { publicNotes, kotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const kitchenTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const existingOrigin = this.normalizeOrderSource(existingOrder.order_source, kotMeta.system?.orderOrigin === 'qr' ? 'qr' : 'manual') === 'qr' ? 'qr' : 'pos';
      const isQrAwaitingWaiterApproval =
        existingOrigin === 'qr' &&
        existingOrderType === 'dine-in' &&
        this.normalizeOrderStatus(existingOrder.status) === 'awaiting_waiter_approval' &&
        kitchenTickets.length === 0;

      if (
        isQrAwaitingWaiterApproval &&
        !['awaiting_waiter_approval', 'cancelled'].includes(normalizedStatus)
      ) {
        throw new Error('Waiter must approve the QR order and generate the first KOT before manager can change progress');
      }

      const now = new Date().toISOString();
      const nextTickets = this.syncKitchenTicketsWithOrderStatus(kitchenTickets, normalizedStatus, now);
      const nextNotes =
        normalizedStatus === 'cancelled'
          ? this.appendOrderNote(composeNotesWithKotMeta(publicNotes, {
              ...kotMeta,
              kitchen: {
                ...kotMeta.kitchen,
                tickets: nextTickets,
              },
            }), this.formatCancellationNote(cancelReason, 'status-update'))
          : composeNotesWithKotMeta(publicNotes, {
              ...kotMeta,
              kitchen: {
                ...kotMeta.kitchen,
                tickets: nextTickets,
              },
            });

      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: normalizedStatus,
          notes: nextNotes,
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error || !order) throw error || new Error('Order not found');

      logger.info(`✅ Order status updated: ${orderId} → ${newStatus}`);
      if (order.table_id) {
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
        // ✅ OPTIMIZATION: Invalidate table state cache when order status changes
        TableService.invalidateActiveTableStateCache(restaurantId);
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      this.emitOrderEvent(restaurantId, 'order.status_updated', updatedOrder);
      return updatedOrder;
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
        // ✅ OPTIMIZATION: Invalidate table state cache when payment status changes
        TableService.invalidateActiveTableStateCache(restaurantId);
      }

      return order;
    } catch (error) {
      logger.error('❌ Update payment error:', error);
      throw error;
    }
  }

  static buildSettlementResponse(settledOrder) {
    if (!settledOrder) return null;
    const { kotMeta } = splitNotesAndKotMeta(settledOrder.notes || '');
    const billing = this.normalizeBillingMeta(kotMeta.billing || {}, {
      paymentMethod: settledOrder.payment_method,
      paymentStatus: settledOrder.payment_status,
    });
    return {
      ...settledOrder,
      settlement: {
        method: settledOrder.payment_method || 'unknown',
        originalTotal: Number(settledOrder.total_amount || 0),
        finalTotal: Number(settledOrder.final_amount || settledOrder.total_amount || 0),
        billing,
        paymentStatus: settledOrder.payment_status || 'pending',
      },
    };
  }

  static async settleOrder(restaurantId, orderId, paymentData = {}) {
    try {
      const existingOrder = await this.fetchOrderRecord(restaurantId, orderId);
      
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      const auditActor = this.buildAuditActor(paymentData);

      if (existingOrder.status === 'cancelled') {
        throw new Error('Cancelled orders cannot be settled');
      }

      if (existingOrder.payment_status === 'paid') {
        throw new Error('Order is already paid');
      }

      // IDEMPOTENCY: If invoice_number already exists, return existing settlement
      // This prevents duplicate generation if API is called multiple times
      if (existingOrder.invoice_number) {
        const settledOrder = await this.getOrderById(restaurantId, orderId);
        return this.buildSettlementResponse(settledOrder);
      }

      const storedTotalAmount = Number(existingOrder.total_amount || 0);
      if (storedTotalAmount <= 0) {
        throw new Error('Order total must be greater than zero before settlement');
      }

      const restaurantSettings = await this.getRestaurantBillingSettings(restaurantId);

      const discountPercent = this.normalizeDiscountPercent(paymentData.discountPercent);
      const existingOrderType = this.normalizeOrderType(existingOrder.order_type, existingOrder.table_id ? 'dine-in' : 'takeaway');
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const existingBilling = this.normalizeBillingMeta(kotMeta.billing, {
        paymentMethod: existingOrder.payment_method,
        paymentStatus: existingOrder.payment_status,
      });
      
      // Allow resettlement if no bill number yet, or re-settlement of existing orders
      const hasExistingBill = Boolean(existingBilling.invoiceNumber && existingOrder.payment_status === 'paid');
      if (hasExistingBill) {
        throw new Error('Bill is already created for this order');
      }
      
      const hasPersistedBilling = this.hasMeaningfulBillingMeta(existingBilling);
      const subtotal = this.roundCurrency(
        (existingOrder.order_items || []).reduce(
          (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
          0
        )
      );
      const normalizedLoyaltyPhone = this.normalizeLoyaltyPhone(
        paymentData.loyaltyPhone || kotMeta.online?.customerPhone || kotMeta.loyalty?.customerPhone || ''
      );
      const requestedRedeemPoints = this.normalizeRedeemPoints(paymentData.redeemPoints);
      const loyaltyProfile = normalizedLoyaltyPhone
        ? await this.getLoyaltyProfile(restaurantId, normalizedLoyaltyPhone, { excludeOrderId: orderId })
        : null;
      const availablePointsBefore = loyaltyProfile?.pointsBalance || 0;

      if (requestedRedeemPoints > availablePointsBefore) {
        throw new Error(`Only ${availablePointsBefore} loyalty points are available for this customer`);
      }

      const fallbackTaxPercent = Number(restaurantSettings.default_gst_percent ?? 5);
      const requestedPackingCharge = paymentData.packingCharge;
      const requestedServiceCharge = paymentData.serviceCharge;
      const requestedDeliveryCharge = paymentData.deliveryCharge;
      const isPlainTakeawaySettlement =
        existingOrderType === 'takeaway' &&
        !hasPersistedBilling &&
        discountPercent === 0 &&
        requestedRedeemPoints === 0 &&
        (requestedPackingCharge === undefined || requestedPackingCharge === null || requestedPackingCharge === '') &&
        (requestedServiceCharge === undefined || requestedServiceCharge === null || requestedServiceCharge === '') &&
        (requestedDeliveryCharge === undefined || requestedDeliveryCharge === null || requestedDeliveryCharge === '');

      const orderDiscountAmount = isPlainTakeawaySettlement
        ? 0
        : Math.max(0, this.roundCurrency(subtotal - storedTotalAmount));
      const managerDiscountAmount = this.roundCurrency((storedTotalAmount * discountPercent) / 100);
      const taxableBase = isPlainTakeawaySettlement
        ? subtotal
        : this.hasMeaningfulBillingMeta(existingBilling) && existingBilling.grandTotal > 0
          ? existingBilling.subtotal || storedTotalAmount || subtotal
          : storedTotalAmount;
      const taxableAmount = isPlainTakeawaySettlement
        ? taxableBase
        : this.roundCurrency(taxableBase - managerDiscountAmount);
      if (taxableAmount <= 0) {
        throw new Error('Discount cannot reduce the bill total to zero or less');
      }

      const cgstRate = restaurantSettings.enable_gst === false
        ? 0
        : this.roundCurrency(Number(restaurantSettings.default_cgst_percent ?? fallbackTaxPercent / 2));
      const sgstRate = restaurantSettings.enable_gst === false
        ? 0
        : this.roundCurrency(Number(restaurantSettings.default_sgst_percent ?? fallbackTaxPercent / 2));
      const gstPercent = this.roundCurrency(cgstRate + sgstRate);
      const cgstAmount = cgstRate > 0 ? this.roundCurrency((taxableAmount * cgstRate) / 100) : 0;
      const sgstAmount = sgstRate > 0 ? this.roundCurrency((taxableAmount * sgstRate) / 100) : 0;
      const packingCharge = isPlainTakeawaySettlement ? 0 : this.normalizeChargeValue(requestedPackingCharge);
      const serviceCharge = isPlainTakeawaySettlement ? 0 : this.normalizeChargeValue(requestedServiceCharge);
      const deliveryCharge = isPlainTakeawaySettlement ? 0 : this.normalizeChargeValue(requestedDeliveryCharge);
      const chargesTotal = this.roundCurrency(packingCharge + serviceCharge + deliveryCharge);
      const grossTotal = this.roundCurrency(taxableAmount + cgstAmount + sgstAmount + chargesTotal);
      const redeemedPoints = Math.min(
        requestedRedeemPoints,
        Math.floor(grossTotal / this.LOYALTY_POINT_VALUE)
      );
      const redeemedAmount = Number((redeemedPoints * this.LOYALTY_POINT_VALUE).toFixed(2));
      const payableBeforeRound = this.roundCurrency(grossTotal - redeemedAmount);
      const roundedTotal = Math.round(payableBeforeRound);
      const roundOff = this.roundCurrency(roundedTotal - payableBeforeRound);
      const finalTotal = this.roundCurrency(roundedTotal);
      const earnedPoints = normalizedLoyaltyPhone ? this.calculateEarnedLoyaltyPoints(finalTotal) : 0;
      const availablePointsAfter = Math.max(0, availablePointsBefore - redeemedPoints + earnedPoints);

      const method = this.normalizePaymentMethod(paymentData.method || existingOrder.payment_method || 'cash');
      if (!method) {
        throw new Error('Unsupported payment method');
      }

      const rawAmountReceived = paymentData.amountReceived;
      const amountReceived = rawAmountReceived === undefined || rawAmountReceived === null || rawAmountReceived === ''
        ? null
        : this.roundCurrency(Number(rawAmountReceived));
      const effectiveAmountReceived =
        method === 'cash' && finalTotal <= 0 && !Number.isFinite(amountReceived)
          ? 0
          : amountReceived;

      if (method === 'cash' && finalTotal > 0) {
        if (!Number.isFinite(effectiveAmountReceived)) {
          throw new Error('Cash received amount is required for cash settlement');
        }

        const shortfall = this.roundCurrency(finalTotal - effectiveAmountReceived);
        if (shortfall > 0.01) {
          throw new Error('Cash received must be at least the bill total');
        }
      }

      const changeDue = method === 'cash' && Number.isFinite(effectiveAmountReceived)
        ? Number((effectiveAmountReceived - finalTotal).toFixed(2))
        : 0;

      // SAFETY CHECK: Verify order doesn't already have a bill number
      // This prevents duplicate generation even if concurrent requests occur
      const { data: currentOrder, error: checkError } = await supabase
        .from('orders')
        .select('invoice_number')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // If bill already exists, return it immediately
      if (currentOrder?.invoice_number) {
        const settledOrder = await this.getOrderById(restaurantId, orderId);
        return this.buildSettlementResponse(settledOrder);
      }

      // STEP 1: ATOMIC - Generate bill number using database function
      // This function atomically updates invoice_number and returns the generated bill number
      const { data: billNumber, error: billError } = await getSupabase().rpc('generate_bill_number', {
        p_order_id: orderId,
        p_restaurant_id: restaurantId,
      });

      if (billError) {
        throw billError;
      }

      if (!billNumber) {
        throw new Error('Failed to generate bill number');
      }

      const invoiceNumber = billNumber;

      // STEP 2: Build settlement notes (BEFORE update)
      // Store billing calculation data in KOT meta (JSON) for audit trail only
      // Invoice number is NOW stored ONLY in invoice_number column
      const nextKotMeta = {
        ...kotMeta,
        billing: this.normalizeBillingMeta(
          {
            invoiceNumber: '', // DO NOT store in JSON - only in database column
            invoiceDate: new Date().toISOString(),
            subtotal,
            orderDiscountAmount,
            managerDiscountPercent: discountPercent,
            managerDiscountAmount,
            taxableAmount,
            gstPercent,
            cgstRate,
            sgstRate,
            cgstAmount,
            sgstAmount,
            packingCharge,
            serviceCharge,
            deliveryCharge,
            chargesTotal,
            loyaltyRedeemedAmount: redeemedAmount,
            loyaltyRedeemedPoints: redeemedPoints,
            roundOff,
            grandTotal: finalTotal,
            paymentMode: method,
            paidAmount: 0,
            cashierName: paymentData.actorName || '',
          },
          {
            paymentMethod: method,
            paymentStatus: 'pending',
          }
        ),
        loyalty: this.normalizeLoyaltyMeta(
          {
            customerPhone: normalizedLoyaltyPhone,
            earnedPoints,
            redeemedPoints,
            redeemedAmount,
            availablePointsBefore,
            availablePointsAfter,
            finalPayableTotal: finalTotal,
            settledAt: new Date().toISOString(),
          },
          {
            fallbackPhone: normalizedLoyaltyPhone,
          }
        ),
      };
      const nextNotes = this.appendOrderNote(
        composeNotesWithKotMeta(publicNotes, {
          ...nextKotMeta,
          online: this.mergeOnlineMeta(kotMeta.online, { paymentState: 'pending', customerPhone: normalizedLoyaltyPhone || kotMeta.online?.customerPhone || '' }, {
            orderType: kotMeta.online?.fulfillmentType || (existingOrder.table_id ? 'dine-in' : 'takeaway'),
            paymentStatus: 'pending',
          }),
        }),
        this.formatSettlementNote({
          method,
          amountReceived: effectiveAmountReceived,
          changeDue,
          paymentNote: paymentData.paymentNote,
          discountPercent,
          discountAmount: managerDiscountAmount,
          originalTotal: storedTotalAmount,
          finalTotal,
          actorName: paymentData.actorName,
          loyaltyPhone: normalizedLoyaltyPhone,
          redeemedPoints,
          redeemedAmount,
          earnedPoints,
        })
      );

      // STEP 3: UPDATE ORDER STATE (invoice_number already set by RPC function)
      // NOTE: invoice_number is already updated by generate_bill_number RPC function
      // Only update remaining settlement fields
      const { error: settleError, count } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          total_amount: finalTotal,
          final_amount: finalTotal,
          payment_method: method,
          payment_status: 'paid',
          notes: nextNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .select('id');

      if (settleError) {
        throw settleError;
      }

      // IDEMPOTENCY: If RPC already assigned bill number, subsequent calls return same number
      // The generate_bill_number RPC function ensures atomic assignment
      if (!count || count === 0) {
        const settledOrder = await this.getOrderById(restaurantId, orderId);
        return this.buildSettlementResponse(settledOrder);
      }

      if (existingOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, existingOrder.table_id);
      }

      const settledOrder = await this.getOrderById(restaurantId, orderId);

      this.logAuditEvent('order.bill_created', {
        restaurantId,
        orderId,
        orderNumber: settledOrder?.displayOrderNumber || settledOrder?.id || orderId,
        actor: auditActor,
        orderType: existingOrderType,
        paymentMethod: method,
        amounts: {
          originalTotal: storedTotalAmount,
          finalTotal,
          amountReceived: Number.isFinite(effectiveAmountReceived) ? effectiveAmountReceived : 0,
          changeDue,
          discountPercent,
          discountAmount: managerDiscountAmount,
          redeemedPoints,
          redeemedAmount,
          earnedPoints,
        },
      });
      return {
        ...settledOrder,
        settlement: {
          method,
          amountReceived: effectiveAmountReceived,
          changeDue,
          originalTotal: storedTotalAmount,
          finalTotal,
          discountPercent,
          discountAmount: managerDiscountAmount,
          billing: this.normalizeBillingMeta(nextKotMeta.billing, {
            paymentMethod: method,
            paymentStatus: 'pending',
          }),
          loyalty: {
            customerPhone: normalizedLoyaltyPhone,
            redeemedPoints,
            redeemedAmount,
            earnedPoints,
            availablePointsBefore,
            availablePointsAfter,
          },
          paymentStatus: 'pending',
        },
      };
    } catch (error) {
      logger.error('Settle order error:', error);
      throw error;
    }
  }

  static async markOrderPaid(restaurantId, orderId, paymentData = {}) {
    try {
      const existingOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const auditActor = this.buildAuditActor(paymentData);

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      if (existingOrder.status === 'cancelled') {
        throw new Error('Cancelled orders cannot be marked paid');
      }

      if (existingOrder.payment_status === 'paid') {
        throw new Error('Bill is already paid');
      }

      const { publicNotes, kotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const existingBilling = this.normalizeBillingMeta(kotMeta.billing, {
        paymentMethod: existingOrder.payment_method,
        paymentStatus: existingOrder.payment_status,
      });

      if (!existingBilling.invoiceNumber) {
        throw new Error('Bill number is missing. Settle the order before marking it paid');
      }

      const method = this.normalizePaymentMethod(paymentData.method || existingBilling.paymentMode || existingOrder.payment_method || 'cash');
      if (!method) {
        throw new Error('Unsupported payment method');
      }

      const expectedTotal = this.roundCurrency(existingBilling.grandTotal || existingOrder.final_amount || existingOrder.total_amount || 0);
      const explicitAmountReceived = paymentData.amountReceived;
      const amountReceived =
        explicitAmountReceived === undefined || explicitAmountReceived === null || explicitAmountReceived === ''
          ? null
          : this.roundCurrency(Number(explicitAmountReceived));

      if (!Number.isFinite(amountReceived)) {
        throw new Error('Received amount is required before confirming payment');
      }

      const shortfall = this.roundCurrency(expectedTotal - amountReceived);
      if (shortfall > 0.01) {
        throw new Error(`Received amount must be at least ${expectedTotal.toFixed(2)}`);
      }

      const changeDue = method === 'cash' && Number.isFinite(amountReceived)
        ? this.roundCurrency(amountReceived - expectedTotal)
        : 0;

      const nextKotMeta = {
        ...kotMeta,
        billing: this.normalizeBillingMeta(
          {
            ...existingBilling,
            paymentMode: method,
            paidAmount: amountReceived,
            paymentNote: paymentData.paymentNote || existingBilling.paymentNote || '',
          },
          {
            paymentMethod: method,
            paymentStatus: 'paid',
          }
        ),
      };

      const confirmationNote = this.appendOrderNote(
        composeNotesWithKotMeta(publicNotes, {
          ...nextKotMeta,
          online: this.mergeOnlineMeta(kotMeta.online, { paymentState: 'paid' }, {
            orderType: kotMeta.online?.fulfillmentType || (existingOrder.table_id ? 'dine-in' : 'takeaway'),
            paymentStatus: 'paid',
          }),
        }),
        `[Payment ${new Date().toISOString()}] ${String(method).toUpperCase()} confirmed paid${paymentData.actorName ? ` by ${paymentData.actorName}` : ''}`
      );

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: method,
          payment_status: 'paid',
          final_amount: expectedTotal,
          notes: confirmationNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .neq('payment_status', 'paid');

      if (updateError) {
        throw updateError;
      }

      if (existingOrder.table_id) {
        await TableService.syncTableLifecycle(restaurantId, existingOrder.table_id);
      }

      const paidOrder = await this.getOrderById(restaurantId, orderId);

      this.logAuditEvent('order.payment_confirmed', {
        restaurantId,
        orderId,
        orderNumber: paidOrder?.displayOrderNumber || paidOrder?.id || orderId,
        actor: auditActor,
        paymentMethod: method,
        amounts: {
          finalTotal: expectedTotal,
          amountReceived,
          changeDue,
        },
      });

      return {
        ...paidOrder,
        settlement: {
          ...(paidOrder?.settlement || {}),
          method,
          amountReceived,
          changeDue,
          paymentStatus: 'paid',
        },
      };
    } catch (error) {
      logger.error('Mark order paid error:', error);
      throw error;
    }
  }

  static rebuildOrderItemsForUpdate(existingItems = [], normalizedItems = []) {
    const availableExistingByMenuItem = new Map();

    (existingItems || []).forEach((item) => {
      const key = String(item.menu_item_id || '');
      const bucket = availableExistingByMenuItem.get(key) || [];
      bucket.push({
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price ?? 0),
        sentToKitchen: Boolean(item.sent_to_kitchen),
        kotId: item.kot_id || null,
      });
      availableExistingByMenuItem.set(key, bucket);
    });

    return (normalizedItems || []).flatMap((item) => {
      const key = String(item.menuItemId || '');
      const bucket = [...(availableExistingByMenuItem.get(key) || [])].sort((left, right) => {
        if (left.sentToKitchen !== right.sentToKitchen) {
          return left.sentToKitchen ? -1 : 1;
        }

        return Number(left.quantity || 0) - Number(right.quantity || 0);
      });
      let remainingQuantity = Number(item.quantity || 0);
      const rebuiltItems = [];

      bucket.forEach((existingItem) => {
        if (remainingQuantity <= 0) {
          return;
        }

        const carryQuantity = Math.min(remainingQuantity, Number(existingItem.quantity || 0));
        if (carryQuantity <= 0) {
          return;
        }

        rebuiltItems.push({
          ...item,
          quantity: carryQuantity,
          unitPrice: Number(item.unitPrice ?? item.price ?? existingItem.unitPrice ?? 0),
          sentToKitchen: Boolean(existingItem.sentToKitchen),
          kotId: existingItem.kotId || null,
        });
        remainingQuantity -= carryQuantity;
      });

      if (remainingQuantity > 0) {
        rebuiltItems.push({
          ...item,
          quantity: remainingQuantity,
          unitPrice: Number(item.unitPrice ?? item.price ?? 0),
          sentToKitchen: false,
          kotId: null,
        });
      }

      return rebuiltItems;
    });
  }

  static async updateOrderItem(restaurantId, orderItemId, quantity) {
    try {
      // Get the order_item to find the order_id
      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .select('id, order_id')
        .eq('id', orderItemId)
        .single();

      if (itemError || !orderItem) throw itemError || new Error('Order item not found');

      // Check if the order is paid
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('id', orderItem.order_id)
        .eq('restaurant_id', restaurantId)
        .single();

      if (orderError || !order) throw orderError || new Error('Order not found');

      if (order.payment_status === 'paid') {
        throw new Error('Cannot modify items in a paid order');
      }

      const { data: updatedItem, error } = await supabase
        .from('order_items')
        .update({ quantity })
        .eq('id', orderItemId)
        .select()
        .single();

      if (error || !updatedItem) throw error || new Error('Order item not found');

      return updatedItem;
    } catch (error) {
      logger.error('❌ Update order item error:', error);
      throw error;
    }
  }

  static async removeOrderItem(restaurantId, orderItemId) {
    try {
      // Get the order_item to find the order_id
      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .select('id, order_id')
        .eq('id', orderItemId)
        .single();

      if (itemError || !orderItem) throw itemError || new Error('Order item not found');

      // Check if the order is paid
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, payment_status')
        .eq('id', orderItem.order_id)
        .eq('restaurant_id', restaurantId)
        .single();

      if (orderError || !order) throw orderError || new Error('Order not found');

      if (order.payment_status === 'paid') {
        throw new Error('Cannot remove items from a paid order');
      }

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
        // ✅ OPTIMIZATION: Invalidate cache before sync to ensure fresh data
        TableService.invalidateActiveTableStateCache(restaurantId);
        await TableService.syncTableLifecycle(restaurantId, order.table_id);
      }
      
      // ✅ Emit socket event to notify frontend of table state change
      this.emitOrderEvent(restaurantId, 'order.cancelled', {
        id: orderId,
        tableId: order.table_id || '',
        orderType: order.order_type || '',
      });

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

      const cancellableStatuses = ['awaiting_waiter_approval', 'pending'];

      const { data: pendingOrders, error: pendingOrdersError } = await supabase
        .from('orders')
        .select('id, table_id, notes, payment_status')
        .eq('restaurant_id', restaurantId)
        .in('status', cancellableStatuses);

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
      
      // ✅ Invalidate cache after all cancellations to ensure fresh state
      TableService.invalidateActiveTableStateCache(restaurantId);

      logger.info(`Bulk cancelled ${cancellableOrders.length} unapproved/pending bills for restaurant ${restaurantId}`);

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
          id,
          restaurant_id,
          table_id,
          status,
          total_amount,
          final_amount,
          display_order_number,
          request_id,
          payment_method,
          payment_status,
          order_type,
          order_source,
          notes,
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

  static async getOrders(restaurantId, filters = {}, user = null) {
    try {
      const limit = Math.min(parseInt(filters.limit) || 20, 50);
      const skip = Math.max(parseInt(filters.skip) || 0, 0);
      const normalizedRole = normalizeRole(user?.role);
      const isDeveloper = normalizedRole === 'developer';
      
      let query = supabase
        .from('orders')
        .select('id,restaurant_id,table_id,status,total_amount,final_amount,payment_method,payment_status,order_type,created_at,updated_at,display_order_number,notes,is_deleted,invoice_number', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(skip + limit);

      if (!isDeveloper) {
        query = query.eq('restaurant_id', restaurantId);
      }

      logger.info('getOrders filter scope', {
        role: normalizedRole || 'unknown',
        appliedRestaurantFilter: !isDeveloper,
        restaurantId: restaurantId || null,
      });

      if (filters.status && String(filters.status).toLowerCase() !== 'all') {
        const statusValues = this.getStatusFilterValues(filters.status);
        query = statusValues.length > 1 ? query.in('status', statusValues) : query.eq('status', statusValues[0]);
      }

      if (filters.tableNumber && String(filters.tableNumber).toLowerCase() !== 'all') {
        try {
          let tableQuery = supabase
            .from('tables')
            .select('id')
            .eq('table_number', String(filters.tableNumber).trim())
            .limit(1);

          if (!isDeveloper) {
            tableQuery = tableQuery.eq('restaurant_id', restaurantId);
          }

          const { data: tables } = await tableQuery;
          
          if (tables?.length > 0) {
            query = query.eq('table_id', tables[0].id);
          }
        } catch (e) {
          // Continue if table lookup fails
        }
      }

      if (filters.orderType && String(filters.orderType).toLowerCase() !== 'all') {
        query = query.eq('order_type', this.normalizeOrderType(filters.orderType));
      }

      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate).toISOString();
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start).lte('created_at', end.toISOString());
      }

      const { data: orders, error, count } = await query;
      if (error) throw error;

      logger.info('getOrders query result', {
        role: normalizedRole || 'unknown',
        appliedRestaurantFilter: !isDeveloper,
        returnedCount: Array.isArray(orders) ? orders.length : 0,
      });
      
      const items = orders || [];
      const total = count || 0;
      
      if (!items?.length) return { items: [], total: 0, limit, skip };

      // Apply pagination
      const paginationStart = skip;
      const paginationEnd = paginationStart + limit;

      // Fetch order_items in single query
      const orderIds = items.map(o => o.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id,order_id,menu_item_id,quantity,unit_price,sent_to_kitchen,kot_id')
        .in('order_id', orderIds);

      // Fetch table numbers in single query
      const tableIds = items.map(o => o.table_id).filter(Boolean);
      const tableMap = {};
      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from('tables')
          .select('id,table_number')
          .in('id', tableIds);
        tables?.forEach(t => { tableMap[t.id] = t.table_number; });
      }

      // Fetch menu items in single query for better caching
      const menuIds = new Set(orderItems?.map(oi => oi.menu_item_id) || []);
      const menuMap = {};
      if (menuIds.size > 0) {
        const { data: menuItems } = await supabase
          .from('menu_items')
          .select('id,name,preparation_time')
          .in('id', Array.from(menuIds));
        menuItems?.forEach(m => { menuMap[m.id] = m; });
      }

      const itemsByOrder = {};
      orderItems?.forEach(item => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push({
          ...item,
          menu_items: menuMap[item.menu_item_id]
        });
      });

      const transformedOrders = items
        .slice(paginationStart, paginationEnd)
        .map(order => ({
          ...this.transformOrder({ ...order, order_items: itemsByOrder[order.id] || [] }),
          tableNumber: tableMap[order.table_id] || null,
        }));

      return {
        items: transformedOrders,
        total,
        limit,
        skip,
      };
    } catch (error) {
      logger.error('Get orders error:', error?.message);
      throw error;
    }
  }

  static async getKitchenOrders(restaurantId, filters = {}) {
    try {
      const requestedStatuses = filters.statuses || ['pending', 'preparing'];
      const statuses = Array.from(
        new Set(requestedStatuses.flatMap((status) => this.getStatusFilterValues(status)))
      );
      const limit = Math.min(parseInt(filters.limit) || 30, 50);
      
      const [ordersResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id,restaurant_id,table_id,status,total_amount,final_amount,payment_method,payment_status,order_type,created_at,display_order_number,is_deleted', { count: 'exact' })
          .eq('restaurant_id', restaurantId)
          .eq('is_deleted', false)
          .in('status', statuses)
          .neq('payment_status', 'paid')
          .order('created_at', { ascending: true })
          .limit(limit)
      ]);

      const { data: orders, error } = ordersResult;
      if (error) throw error;
      if (!orders?.length) return [];

      const orderIds = orders.map(o => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('id,order_id,menu_item_id,quantity,unit_price,sent_to_kitchen,kot_id,menu_items(name)')
        .in('order_id', orderIds);
      
      const itemsByOrderId = {};
      items?.forEach(item => {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push({
          ...item,
          name: item.menu_items?.name || `Item ${String(item.menu_item_id || '').slice(0, 6)}`,
        });
      });
      
      orders.forEach(order => {
        order.order_items = itemsByOrderId[order.id] || [];
      });

      const transformedOrders = orders.map(order => ({
        ...this.transformOrder(order),
        tableNumber: order.table_number,
      }));
      
      // Flatten kitchen tickets and add orderId reference for frontend
      const flattenedTickets = [];
      if (Array.isArray(transformedOrders)) {
        transformedOrders.forEach(order => {
          if (order && order.id && order.kitchenTickets && Array.isArray(order.kitchenTickets)) {
            order.kitchenTickets.forEach(ticket => {
              if (ticket && ticket.id) {
                const flatTicket = {
                  ...ticket,
                  orderId: order.id,  // Add orderId reference - CRITICAL
                  tableNumber: order.tableNumber,
                  displayOrderNumber: order.displayOrderNumber,
                  items: ticket.items || [],
                };
                
                // Validate orderId is set before pushing
                if (!flatTicket.orderId) {
                  logger.warn(`⚠️ Ticket ${ticket.id} has no orderId! Order ID: ${order.id}`);
                }
                
                flattenedTickets.push(flatTicket);
              }
            });
          } else if (order && !order.id) {
            logger.warn(`⚠️ Order has no ID: ${JSON.stringify(order).substring(0, 100)}`);
          } else if (order && !order.kitchenTickets) {
            logger.info(`Order ${order.id} has no kitchen tickets`);
          }
        });
      }
      
      // DEBUG: Log the actual ticket structure to verify orderId is set correctly
      if (flattenedTickets.length > 0) {
        const sample = flattenedTickets[0];
        logger.info('[Kitchen Debug] First ticket structure:', {
          ticketId: sample.id,
          orderId: sample.orderId,
          isSameId: sample.id === sample.orderId,
          ticketIdMatch: sample.id?.substring(0, 8),
          orderIdMatch: sample.orderId?.substring(0, 8),
        });
      }
      
      logger.info(`Kitchen orders: returning ${flattenedTickets.length} flattened tickets from ${transformedOrders.length} orders`);
      return flattenedTickets.length > 0 ? flattenedTickets : [];
    } catch (error) {
      logger.error('Get kitchen orders error:', error?.message);
      return [];
    }
  }

  static async getActiveOrderByTable(restaurantId, tableId) {
    try {
      // ✅ OPTIMIZATION: First, check if active order exists with minimal fields
      // This is much faster than fetching nested data
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          restaurant_id,
          table_id,
          status,
          total_amount,
          final_amount,
          display_order_number,
          request_id,
          payment_method,
          payment_status,
          order_type,
          order_source,
          notes,
          created_at,
          updated_at,
          is_deleted,
          tables!table_id (table_number)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('table_id', tableId)
        .eq('is_deleted', false)
        .eq('is_archived', false)
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

      // ✅ OPTIMIZATION: Only fetch order_items if caller will need them
      // Load order items separately to avoid large nested query
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          menu_item_id,
          quantity,
          unit_price,
          sent_to_kitchen,
          kot_id,
          menu_items (name, preparation_time)
        `)
        .eq('order_id', order.id);

      if (itemsError) {
        throw itemsError;
      }

      // Attach order items to order
      order.order_items = orderItems || [];

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

  static async updateOrder(restaurantId, orderId, orderData, options = {}) {
    try {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, restaurant_id, table_id, order_type, total_amount, status, notes, payment_method, payment_status')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) {
        throw existingOrderError || new Error('Order not found');
      }

      const auditActor = this.buildAuditActor(options);

      if (!this.isActiveStatus(existingOrder.status)) {
        throw new Error('Only active table orders can be updated');
      }

      // SECURITY: Prevent updates to paid orders
      if (existingOrder.payment_status === 'paid') {
        throw new Error('Cannot modify a paid order. Orders can only be edited before payment is processed.');
      }

      const normalizedItems = await this.validateOrderItems(restaurantId, orderData.items, {
        enforceMenuPrice: options.actorRole === 'manager',
      });
      const computedTotalAmount = this.computeOrderTotal(normalizedItems);
      // ✅ FIXED: Allow waiters to update orders - billing restrictions removed from order updates
      // this.assertBillingChangesAllowed(options.actorRole, orderData.totalAmount, computedTotalAmount);
      const resolvedOrderType = this.normalizeOrderType(
        orderData.orderType !== undefined ? orderData.orderType : existingOrder.order_type,
        existingOrder.table_id ? 'dine-in' : 'takeaway'
      );
      const resolvedTableId =
        resolvedOrderType === 'takeaway'
          ? null
          : orderData.tableId !== undefined
            ? orderData.tableId
            : existingOrder.table_id;
      const { publicNotes: existingPublicNotes, kotMeta: existingKotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const mergedOnlineMeta = this.mergeOnlineMeta(existingKotMeta.online, orderData.online, {
        orderType: resolvedOrderType,
        paymentStatus: existingOrder.payment_status,
      });
      const nextKotMeta = {
        ...existingKotMeta,
        lineDetails: this.buildLineDetailsMap(normalizedItems),
        online: mergedOnlineMeta,
      };

      const { data: existingOrderItems, error: existingItemsError } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity, unit_price, sent_to_kitchen, kot_id')
        .eq('order_id', orderId);

      if (existingItemsError) {
        throw existingItemsError;
      }

      const beforeSummary = {
        tableId: existingOrder.table_id || null,
        orderType: existingOrder.order_type || (existingOrder.table_id ? 'dine-in' : 'takeaway'),
        totalAmount: Number(existingOrder.total_amount || 0),
        paymentMethod: existingOrder.payment_method || '',
        items: this.summarizeItemsForAudit(existingOrderItems || []),
      };

      const nextStatus = this.normalizeOrderStatus(existingOrder.status);
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          table_id: resolvedTableId,
          order_type: resolvedOrderType,
          total_amount: this.resolvePersistedOrderTotal(orderData.totalAmount, computedTotalAmount),
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
        const rebuiltOrderItems = this.rebuildOrderItemsForUpdate(existingOrderItems || [], normalizedItems);
        await this.addOrderItems(orderId, rebuiltOrderItems);
      } catch (addOrderItemsError) {
        if (existingOrderItems?.length) {
          try {
            await this.addOrderItems(
              orderId,
              existingOrderItems.map((item) => ({
                menuItemId: item.menu_item_id,
                quantity: item.quantity,
                unitPrice: Number(item.unit_price ?? 0),
                sentToKitchen: Boolean(item.sent_to_kitchen),
                kotId: item.kot_id || null,
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
      const updatedOrder = await this.getOrderById(restaurantId, orderId);
      this.logAuditEvent('order.billing_updated', {
        restaurantId,
        orderId,
        orderNumber: updatedOrder?.displayOrderNumber || updatedOrder?.id || orderId,
        actor: auditActor,
        before: beforeSummary,
        after: {
          tableId: updatedOrder?.tableId || null,
          orderType: updatedOrder?.orderType || null,
          totalAmount: Number(updatedOrder?.totalAmount || updatedOrder?.total || 0),
          paymentMethod: updatedOrder?.paymentMethod || '',
          items: this.summarizeItemsForAudit(updatedOrder?.items || updatedOrder?.orderItems || []),
        },
      });
      this.emitOrderEvent(restaurantId, 'order.updated', updatedOrder);
      return updatedOrder;
    } catch (error) {
      logger.error('Update order error:', error);
      throw error;
    }
  }

  static async softDeleteOrder(restaurantId, orderId, reason, options = {}) {
    try {
      let role = String(options.actorRole || '').toLowerCase();
      // Normalize "owner" to "admin"
      if (role === 'owner') {
        role = 'admin';
      }
      const currentPassword = String(options.currentPassword || '').trim();

      console.log('[DELETE_ORDER_DEBUG]:', {
        role,
        user: options.actorUserId,
        orderId
      });

      console.log('[SERVICE_SOFT_DELETE] 🔍 Starting order deletion');
      console.log('[SERVICE_SOFT_DELETE] Role:', options.actorRole, '→ normalized:', role);
      console.log('[SERVICE_SOFT_DELETE] Password provided:', !!currentPassword);

      // ✅ Password verification is already done in controller - no need to verify again
      // Authorization check at middleware already verified user has manage_orders permission
      // Skip password verification in service - it's handled by controller

      console.log('[SERVICE_SOFT_DELETE] 🔐 Checking role authorization');
      console.log('[SERVICE_SOFT_DELETE] Allowed roles: admin, manager, developer');
      console.log('[SERVICE_SOFT_DELETE] User role in allowed list:', ['admin', 'manager', 'developer'].includes(role));
      
      if (!['admin', 'manager', 'developer'].includes(role)) {
        console.log('[SERVICE_SOFT_DELETE] ❌ Role not authorized:', role);
        throw new Error('Access denied');
      }

      console.log('[SERVICE_SOFT_DELETE] ✅ Role authorized');

      let query = supabase
        .from('orders')
        .select('*')
        .eq('id', orderId);

      if (role !== 'developer') {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data: existingOrder, error: existingOrderError } = await query.single();

      console.log('User role:', options.actorRole);
      console.log('Order:', existingOrder);
      console.log('Restaurant:', restaurantId);

      if (existingOrderError && existingOrderError.code !== 'PGRST116') {
        throw existingOrderError;
      }

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      const effectiveRestaurantId = existingOrder.restaurant_id || existingOrder.restaurantId || restaurantId;
      const trimmedReason = String(reason || '').trim();
      const tableId = existingOrder?.table_id || existingOrder?.tableId || null;

      const deletedAt = new Date().toISOString();
      const auditNote = `[order-delete] ${trimmedReason || 'no reason provided'} | actor=${role || 'unknown'}:${options.actorName || 'Unknown user'} | at=${deletedAt}`;

      // ✅ FIXED: Only delete the requested order, not all orders on the table
      const orphanIds = [orderId];

      // ⚡ DELETE dependent records for this specific order
      if (orphanIds.length > 0) {
        // Delete order_items for this order
        const { error: deleteItemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', orphanIds);

        if (deleteItemsError) {
          logger.error(`Failed to delete order_items:`, deleteItemsError);
          throw new Error(`Cannot delete order - failed to remove order items: ${deleteItemsError.message}`);
        }

        // Delete kitchen_tickets for this order
        const { error: deleteKotError } = await supabase
          .from('kitchen_tickets')
          .delete()
          .in('order_id', orphanIds);

        if (deleteKotError) {
          logger.warn(`Failed to delete kitchen_tickets:`, deleteKotError);
          // Continue anyway - KOT records are less critical
        }

        // Delete order_bills for this order
        try {
          await supabase
            .from('order_bills')
            .delete()
            .in('order_id', orphanIds);
        } catch (err) {
          // Table may not exist; ignore if missing
        }
      }

      // ✅ SOFT DELETE the specific order
      if (orphanIds.length > 0) {
        const { error: softDeleteError } = await supabase
          .from('orders')
          .update({
            is_deleted: true,
            deleted_at: deletedAt,
            delete_reason: trimmedReason,
            notes: this.appendOrderNote(existingOrder.notes, auditNote),
          })
          .in('id', orphanIds)
          .eq('restaurant_id', effectiveRestaurantId);

        if (softDeleteError) {
          logger.warn(`Failed to soft-delete order:`, softDeleteError);
          throw new Error(`Unable to delete order: ${softDeleteError.message}`);
        }

        logger.info(`Soft-deleted order: ${orderId} :: ${auditNote}`);
      }

      // ✅ UPDATE table status ONLY if this is the last order on the table
      let remainingOrders = [];
      if (tableId) {
        // Check if there are any other non-deleted OPEN orders on this table
        const { data: orders, error: remainingOrdersError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('restaurant_id', effectiveRestaurantId)
          .eq('table_id', tableId)
          .eq('is_deleted', false)
          .neq('payment_status', 'paid') // Exclude paid/completed orders
          .in('status', this.OPEN_BILL_STATUSES); // Only count open status orders

        if (remainingOrdersError) {
          logger.warn(`Failed to check remaining orders for table ${tableId}:`, remainingOrdersError);
        }

        remainingOrders = orders || [];
        const hasRemainingOrders = remainingOrders.length > 0;

        if (!hasRemainingOrders) {
          logger.info(`✅ No remaining open orders for table ${tableId} - marking as available`);

          const tableUpdatePayload = {
            status: 'available',
            reserved_by: null,
            reservation_time: null,
            assigned_to: null,
          };

          const { error: tableUpdateError } = await supabase
            .from('tables')
            .update(tableUpdatePayload)
            .eq('id', tableId)
            .eq('restaurant_id', effectiveRestaurantId);

          if (tableUpdateError) {
            logger.warn(`Failed to update table status for ${tableId}:`, tableUpdateError);
          }

          // Deactivate any table_assignment entry for this table so it can be reassigned cleanly
          const { error: assignmentError } = await supabase
            .from('table_assignments')
            .update({ is_active: false, updated_at: deletedAt })
            .eq('restaurant_id', effectiveRestaurantId)
            .eq('table_id', tableId);

          if (assignmentError) {
            logger.warn(`Failed to deactivate table assignment for ${tableId}:`, assignmentError);
          }

          // ✅ CRITICAL: Invalidate cache BEFORE syncTableLifecycle so it gets fresh data
          TableService.invalidateActiveTableStateCache(effectiveRestaurantId);
          await TableService.syncTableLifecycle(effectiveRestaurantId, tableId);
        } else {
          logger.info(`⚠️ ${remainingOrders.length} open order(s) still exist on table ${tableId} - keeping status as occupied`);
          // ✅ CRITICAL: Also invalidate cache when orders remain so table state is accurate
          TableService.invalidateActiveTableStateCache(effectiveRestaurantId);
        }
      }

      this.emitOrderEvent(effectiveRestaurantId, 'order.deleted', {
        id: orderId,
        tableId: tableId || '',
        orderType: existingOrder.order_type || existingOrder.orderType || '',
      });

      // 📊 EMIT table update event for real-time UI sync
      if (tableId) {
        broadcastRestaurantEvent(effectiveRestaurantId, 'table_updated', {
          tableId,
          status: (remainingOrders?.length || 0) > 0 ? 'occupied' : 'available',
          updatedAt: deletedAt,
        });
      }

      logger.info(`Order deletion completed: ${orderId} :: ${auditNote}`);
      console.log('[SERVICE_SOFT_DELETE] ✅ Order deletion completed successfully');
      
      return { id: orderId, deletedAt, restaurantId: effectiveRestaurantId };
    } catch (error) {
      console.log('[SERVICE_SOFT_DELETE] ❌ Soft delete order error:', error.message);
      logger.error('Soft delete order error:', error);
      throw error;
    }
  }

  static async getOnlineOrderInbox(restaurantId, filters = {}) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          restaurant_id,
          table_id,
          status,
          total_amount,
          final_amount,
          display_order_number,
          request_id,
          payment_method,
          payment_status,
          order_type,
          order_source,
          notes,
          created_at,
          updated_at,
        order_items (
          id,
          menu_item_id,
          quantity,
          unit_price,
          sent_to_kitchen,
          kot_id,
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
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const transformedOrders = await this.attachDisplayNumbers(
        restaurantId,
        (orders || []).map((order) => ({
          ...this.transformOrder(order),
          tableNumber: order.tables?.table_number || null,
          table: order.tables,
        }))
      );

      return transformedOrders.filter((order) => {
        const sourceMatches = filters.source
          ? order.online?.source === String(filters.source).trim().toLowerCase()
          : true;
        const statusMatches = filters.status
          ? order.online?.workflowStatus === String(filters.status).trim().toLowerCase()
          : order.online?.source;

        return Boolean(order.online?.source) && sourceMatches && statusMatches;
      });
    } catch (error) {
      logger.error('Get online order inbox error:', error);
      throw error;
    }
  }

  static async approveDiscount(restaurantId, orderId, approval = {}) {
    try {
      const auditActor = this.buildAuditActor(approval);
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, restaurant_id, status, payment_status, notes')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (existingOrderError || !existingOrder) {
        throw existingOrderError || new Error('Order not found');
      }

      if (existingOrder.status === 'cancelled') {
        throw new Error('Cancelled orders cannot receive discounts');
      }

      if (existingOrder.status === 'completed' || existingOrder.payment_status === 'paid') {
        throw new Error('Settled orders cannot receive discounts');
      }

      const percent = this.normalizeDiscountPercent(approval.percent);
      if (!percent || percent <= 0) {
        throw new Error('Discount percent must be greater than zero');
      }

      const { publicNotes, kotMeta } = splitNotesAndKotMeta(existingOrder.notes);
      const nextNotes = composeNotesWithKotMeta(publicNotes, {
        ...kotMeta,
        discountApproval: {
          percent,
          note: String(approval.note || '').trim(),
          approvedBy: approval.actorName || '',
          approvedAt: new Date().toISOString(),
        },
      });

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          notes: nextNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId);

      if (updateError) {
        throw updateError;
      }

      const updatedOrder = await this.getOrderById(restaurantId, orderId);

      broadcastRestaurantEvent(restaurantId, 'notification', {
        type: 'order.discount_approved',
        orderId,
        orderNumber: updatedOrder?.displayOrderNumber || updatedOrder?.id || orderId,
        approvedDiscount: updatedOrder?.approvedDiscount || null,
      });
      this.logAuditEvent('order.discount_approved', {
        restaurantId,
        orderId,
        orderNumber: updatedOrder?.displayOrderNumber || updatedOrder?.id || orderId,
        actor: auditActor,
        discount: {
          percent,
          note: String(approval.note || '').trim(),
        },
      });

      return updatedOrder;
    } catch (error) {
      logger.error('Approve discount error:', error);
      throw error;
    }
  }

  static async updateOnlineOrder(restaurantId, orderId, updates = {}) {
    try {
      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);
      const existingOnline = this.normalizeOnlineMeta(kotMeta.online, {
        orderType: kotMeta.online?.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
        paymentStatus: rawOrder.payment_status,
      });

      if (!existingOnline.source && !updates.source) {
        throw new Error('Only online orders can be updated from the inbox');
      }

      const now = new Date().toISOString();
      const workflowStatus = updates.workflowStatus
        ? this.normalizeOnlineWorkflowStatus(updates.workflowStatus, existingOnline.workflowStatus || 'new')
        : existingOnline.workflowStatus;
      const nextOnline = this.mergeOnlineMeta(existingOnline, {
        source: updates.source,
        fulfillmentType: existingOnline.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
        promisedAt: updates.promisedAt,
        paymentState: updates.paymentState,
        customerName: updates.customerName,
        customerPhone: updates.customerPhone,
        customerAddress: updates.customerAddress,
        channelOrderId: updates.channelOrderId,
        workflowStatus,
        acceptedAt: workflowStatus === 'accepted' ? existingOnline.acceptedAt || now : existingOnline.acceptedAt,
        rejectedAt: workflowStatus === 'rejected' ? now : existingOnline.rejectedAt,
        readyAt: workflowStatus === 'ready' ? now : existingOnline.readyAt,
        dispatchedAt: workflowStatus === 'dispatched' ? now : existingOnline.dispatchedAt,
      }, {
        orderType: existingOnline.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
        paymentStatus: rawOrder.payment_status,
      });

      const nextStatus = this.mapOnlineWorkflowToOrderStatus(workflowStatus, this.normalizeOrderStatus(rawOrder.status));
      const nextNotes = composeNotesWithKotMeta(
        workflowStatus === 'rejected'
          ? this.appendOrderNote(publicNotes, this.formatCancellationNote('online order rejected', 'online-inbox'))
          : publicNotes,
        {
          ...kotMeta,
          online: nextOnline,
        }
      );

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: nextStatus,
          notes: nextNotes,
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

      return await this.getOrderById(restaurantId, orderId);
    } catch (error) {
      logger.error('Update online order error:', error);
      throw error;
    }
  }

  static async getActiveOrders(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id,restaurant_id,table_id,status,total_amount,final_amount,payment_method,payment_status,order_type,created_at,updated_at,display_order_number')
        .eq('restaurant_id', restaurantId)
        .eq('is_archived', false)
        .in('status', this.ACTIVE_ORDER_STATUSES)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      if (!orders?.length) return [];

      const orderIds = orders.map(o => o.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id,order_id,menu_item_id,quantity,unit_price')
        .in('order_id', orderIds);

      const tableIds = orders.map(o => o.table_id).filter(Boolean);
      const tableMap = {};
      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from('tables')
          .select('id,table_number')
          .in('id', tableIds);
        tables?.forEach(t => { tableMap[t.id] = t.table_number; });
      }

      const itemsByOrder = {};
      orderItems?.forEach(item => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      });

      const transformedOrders = orders.map(order => ({
        ...this.transformOrder({ ...order, order_items: itemsByOrder[order.id] || [] }),
        tableNumber: tableMap[order.table_id],
      }));

      return transformedOrders;
    } catch (error) {
      logger.error('Get active orders error:', error?.message);
      return [];
    }
  }

  static async getOpenBills(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id,restaurant_id,table_id,status,total_amount,final_amount,payment_method,payment_status,order_type,created_at')
        .eq('restaurant_id', restaurantId)
        .neq('payment_status', 'paid')
        .in('status', this.OPEN_BILL_STATUSES)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const tableIds = (orders || []).map(o => o.table_id).filter(Boolean);
      let tableMap = new Map();
      
      if (tableIds.length > 0) {
        const { data: tables } = await supabase
          .from('tables')
          .select('id,table_number')
          .in('id', tableIds);
        
        (tables || []).forEach(t => tableMap.set(t.id, t));
      }

      const transformedOrders = (orders || []).map((order) => ({
        ...this.transformOrder(order),
        tableNumber: tableMap.get(order.table_id)?.table_number || null,
        table: tableMap.get(order.table_id),
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
  static async sendOrderToKitchen(restaurantId, orderId) {
    try {
      // ✅ CRITICAL: Validate order exists BEFORE creating KOT
      if (!orderId) {
        throw new Error('Order ID is required to send to kitchen');
      }

      console.log('🍳 [KOT] Starting KOT generation for order:', { orderId, restaurantId });
      logger.info(`🔍 Fetching order ${orderId} before creating KOT...`);
      const rawOrder = await this.fetchOrderRecord(restaurantId, orderId);
      
      if (!rawOrder || !rawOrder.id) {
        logger.error('❌ Order not found or invalid', { orderId, restaurantId });
        throw new Error(`Order ${orderId} not found or invalid`);
      }

      logger.info(`✅ Order ${orderId} found. Proceeding with KOT creation...`);
      const transformedOrder = this.transformOrder(rawOrder);
      const { publicNotes, kotMeta } = splitNotesAndKotMeta(rawOrder.notes);

      // ✅ TASK 5: ADD DEBUG LOGS - Check items from transformed order
      logger.debug('📦 Order items check', {
        orderId,
        transformedOrderItemsCount: transformedOrder?.items?.length || 0,
        rawOrderItemsCount: rawOrder?.order_items?.length || 0,
      });

      console.log('📦 [KOT] Items available for KOT:', {
        transformedCount: transformedOrder?.items?.length || 0,
        rawCount: rawOrder?.order_items?.length || 0,
        items: (rawOrder?.order_items || []).map(i => ({
          id: i.id,
          menuItemId: i.menu_item_id,
          quantity: i.quantity,
          sentToKitchen: i.sent_to_kitchen,
        })),
      });

      if (!Array.isArray(transformedOrder.items) || transformedOrder.items.length === 0) {
        logger.error('❌ No items in order for KOT generation', {
          orderId,
          transformedItems: transformedOrder?.items?.length || 0,
        });
        throw new Error('Add at least one item before sending to kitchen');
      }

      const pendingKitchenRows = (rawOrder.order_items || []).filter((item) => !item.sent_to_kitchen);
      
      // ✅ TASK 5: ADD DEBUG LOGS - Check pending items for KOT
      logger.info('🔍 Pending kitchen items for KOT', {
        orderId,
        totalOrderItems: rawOrder.order_items?.length || 0,
        pendingForKitchenCount: pendingKitchenRows.length,
        alreadySentCount: (rawOrder.order_items || []).filter(i => i.sent_to_kitchen).length,
      });

      console.log('🍳 [KOT] Pending items for kitchen:', {
        count: pendingKitchenRows.length,
        items: pendingKitchenRows.map(i => ({
          id: i.id,
          menuItemId: i.menu_item_id,
          name: i.menu_items?.name || 'Unknown',
          quantity: i.quantity,
          price: i.unit_price,
        })),
      });

      const existingTickets = (kotMeta.kitchen?.tickets || []).map((ticket) => this.normalizeKitchenTicket(ticket));
      const ticketItems = pendingKitchenRows.map((item) => ({
        lineKey: `${item.id}`,
        orderItemId: item.id,
        menuItemId: item.menu_item_id,
        name: item.menu_items?.name || '',
        quantity: Number(item.quantity || 0),
        note: this.sanitizeLineNote(kotMeta.lineDetails?.[item.menu_item_id]?.note || ''),
        modifiers: this.parseModifierList(kotMeta.lineDetails?.[item.menu_item_id]?.modifiers || []),
        station: kotMeta.lineDetails?.[item.menu_item_id]?.station || 'Main Kitchen',
        categoryId: kotMeta.lineDetails?.[item.menu_item_id]?.categoryId || null,
        categoryName: kotMeta.lineDetails?.[item.menu_item_id]?.categoryName || '',
        unitPrice: Number(item.unit_price ?? 0),
        detailsSignature: this.buildItemDetailsSignature({
          itemNote: kotMeta.lineDetails?.[item.menu_item_id]?.note || '',
          modifiers: kotMeta.lineDetails?.[item.menu_item_id]?.modifiers || [],
          station: kotMeta.lineDetails?.[item.menu_item_id]?.station || 'Main Kitchen',
          categoryName: kotMeta.lineDetails?.[item.menu_item_id]?.categoryName || '',
        }),
        action: 'add',
      }));

      // ✅ TASK 5: ADD DEBUG LOGS - Final ticket items for KOT
      logger.debug('🎫 KOT ticket items prepared', {
        orderId,
        ticketItemsCount: ticketItems.length,
        ticketItems: ticketItems.map(ti => ({
          menuItemId: ti.menuItemId,
          name: ti.name,
          quantity: ti.quantity,
          station: ti.station,
        })),
      });

      console.log('🎫 [KOT] Final ticket items for printing:', {
        count: ticketItems.length,
        items: ticketItems,
      });

      if (ticketItems.length === 0) {
        logger.warn('⚠️ No pending kitchen items to create KOT', {
          orderId,
          allItemsAlreadySent: true,
        });
        throw new Error('No new kitchen changes to send for this bill');
      }

      const now = new Date().toISOString();
      const kitchenTicketId = randomUUID();
      
      // ✅ CRITICAL: Ensure order_id is valid and not null
      if (!orderId) {
        throw new Error('Cannot create KOT: order_id is null or undefined');
      }

      logger.info(`📝 Creating KOT ${kitchenTicketId} for order ${orderId}...`);
      const { error: kitchenTicketInsertError } = await supabase
        .from('kitchen_tickets')
        .insert([{
          id: kitchenTicketId,
          restaurant_id: restaurantId,
          order_id: orderId,
          status: 'pending',
          ticket_type: existingTickets.length === 0 ? 'send' : 'delta',
          summary: this.summarizeKitchenActions(ticketItems),
          created_at: now,
          updated_at: now,
        }]);

      if (kitchenTicketInsertError) {
        logger.error(`❌ Failed to create KOT for order ${orderId}:`, kitchenTicketInsertError);
        throw kitchenTicketInsertError;
      }
      
      logger.info(`✅ KOT ${kitchenTicketId} created successfully for order ${orderId}`);

      const nextTicket = this.normalizeKitchenTicket({
        id: kitchenTicketId,
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

      // Inventory consumption skipped (coming soon feature)

      const pendingOrderItemIds = pendingKitchenRows.map((item) => item.id).filter(Boolean);
      if (pendingOrderItemIds.length > 0) {
        const { error: markItemsSentError } = await supabase
          .from('order_items')
          .update({
            sent_to_kitchen: true,
            kot_id: kitchenTicketId,
            updated_at: now,
          })
          .in('id', pendingOrderItemIds)
          .eq('order_id', orderId);

        if (markItemsSentError) {
          throw markItemsSentError;
        }
      }

      const existingOnline = this.normalizeOnlineMeta(kotMeta.online, {
        orderType: kotMeta.online?.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
        paymentStatus: rawOrder.payment_status,
      });
      const nextOnlineWorkflowStatus = existingOnline.source
        ? rawOrder.status === 'awaiting_waiter_approval'
          ? 'accepted'
          : existingOnline.workflowStatus
        : existingOnline.workflowStatus;
      const nextOnline = existingOnline.source
        ? this.mergeOnlineMeta(
            existingOnline,
            {
              workflowStatus: nextOnlineWorkflowStatus,
              acceptedAt:
                nextOnlineWorkflowStatus === 'accepted'
                  ? existingOnline.acceptedAt || now
                  : existingOnline.acceptedAt,
            },
            {
              orderType: existingOnline.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
              paymentStatus: rawOrder.payment_status,
            }
          )
        : existingOnline;

      const nextKotMeta = {
        ...kotMeta,
        lineDetails: this.buildLineDetailsMap(transformedOrder.items),
        online: nextOnline,
        kitchen: {
          ...kotMeta.kitchen,
          lastSentSnapshot: this.buildKitchenSnapshot(this.aggregateOrderItems(
            (rawOrder.order_items || []).map((item) => ({
              ...item,
              sent_to_kitchen: pendingOrderItemIds.includes(item.id) ? true : item.sent_to_kitchen,
              kot_id: pendingOrderItemIds.includes(item.id) ? kitchenTicketId : item.kot_id,
            })),
            kotMeta.lineDetails || {}
          )),
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
      this.emitOrderEvent(restaurantId, 'order.sent_to_kitchen', updatedOrder, {
        ticketId: nextTicket.id,
        ticketStatus: nextTicket.status,
      });
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
      if (!['pending', 'preparing', 'ready', 'completed'].includes(normalizedStatus)) {
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
        completedAt: normalizedStatus === 'completed' ? now : existingTickets[ticketIndex].completedAt,
        servedAt: normalizedStatus === 'completed' ? now : existingTickets[ticketIndex].servedAt,
      };
      const nextTickets = existingTickets.map((ticket, index) => (index === ticketIndex ? targetTicket : ticket));
      const derivedOrderStatus = this.deriveOrderStatusFromTickets(nextTickets, rawOrder.status);
      const existingOnline = this.normalizeOnlineMeta(kotMeta.online, {
        orderType: kotMeta.online?.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
        paymentStatus: rawOrder.payment_status,
      });
      const nextOnlineWorkflowStatus = existingOnline.source
        ? normalizedStatus === 'completed'
          ? 'dispatched'
          : normalizedStatus
        : existingOnline.workflowStatus;
      const nextOnline = existingOnline.source
        ? this.mergeOnlineMeta(existingOnline, {
            workflowStatus: nextOnlineWorkflowStatus,
            readyAt: nextOnlineWorkflowStatus === 'ready' ? now : existingOnline.readyAt,
            dispatchedAt: nextOnlineWorkflowStatus === 'dispatched' ? now : existingOnline.dispatchedAt,
          }, {
            orderType: existingOnline.fulfillmentType || (rawOrder.table_id ? 'dine-in' : 'takeaway'),
            paymentStatus: rawOrder.payment_status,
          })
        : existingOnline;

      const { error: kitchenTicketUpdateError } = await supabase
        .from('kitchen_tickets')
        .update({
          status: normalizedStatus,
          updated_at: now,
        })
        .eq('id', ticketId)
        .eq('order_id', orderId);

      if (kitchenTicketUpdateError) {
        throw kitchenTicketUpdateError;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: derivedOrderStatus,
          notes: composeNotesWithKotMeta(publicNotes, {
            ...kotMeta,
            online: nextOnline,
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
      this.emitOrderEvent(restaurantId, 'order.kitchen_status_updated', updatedOrder, {
        ticketId: targetTicket.id,
        ticketStatus: targetTicket.status,
      });
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
      // Inventory consumption skipped (coming soon feature)

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
