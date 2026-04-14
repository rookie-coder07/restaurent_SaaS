import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validateParams } from '../middleware/validation.js';
import Joi from 'joi';
import MenuService from '../services/menuService.js';
import TableService from '../services/tableService.js';
import OrderService from '../services/orderService.js';
import * as orderController from '../controllers/orderController.js';
import supabase from '../config/supabase.js';
import SecurityAuditLogger from '../utils/securityAudit.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';

const router = express.Router();

const tableSchema = Joi.object({
  qrCodeData: Joi.string().required(),
});

function normalizeTableLabel(value) {
  return String(value || '').trim();
}

async function getBusyTableOrder(restaurantId, tableId) {
  if (!restaurantId || !tableId) {
    return null;
  }

  try {
    const activeOrder = await OrderService.getActiveOrderByTable(restaurantId, tableId);
    console.log('✅ Busy table check:', { 
      restaurantId, 
      tableId, 
      hasActiveOrder: !!activeOrder,
      orderId: activeOrder?.id,
    });
    return activeOrder;
  } catch (error) {
    console.error('⚠️ Error checking busy table:', {
      restaurantId,
      tableId,
      error: error.message,
      code: error.code,
    });
    // Return null to allow order attempt (fail gracefully)
    return null;
  }
}

// Get public menu items (no auth required)
// This endpoint is called by customers who scanned a QR code
// Pass ?table=X to get the menu for that table's restaurant
router.get('/menu/items', requireFeatureFlag('qr_ordering', 'QR ordering is currently disabled by the platform administrator.'), async (req, res) => {
  try {
    const { table, tableId } = req.query;

    if (!table && !tableId) {
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Table identifier is required',
      });
    }

    let query = supabase
      .from('tables')
      .select('id, restaurant_id, table_number');

    if (tableId) {
      query = query.eq('id', tableId);
    } else {
      query = query.eq('table_number', normalizeTableLabel(table));
    }

    const { data: tableData, error: tableError } = await query.single();

    if (tableError || !tableData) {
      console.error('❌ Table lookup error:', tableError?.message || 'Table not found');
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: tableId
          ? 'Table not found in system'
          : `Table ${table} not found in system`,
      });
    }

    const restaurantId = tableData.restaurant_id;

    // ✅ FIXED: Don't block menu loading if table is busy
    // Let user browse menu even if table has running order
    // Order creation endpoint will handle busy table conflict
    const activeOrder = await getBusyTableOrder(restaurantId, tableData.id);

    const [{ data: restaurantData }, categories, items] = await Promise.all([
      supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single(),
      MenuService.getCategories(restaurantId),
      MenuService.getMenuItems(restaurantId, {
        limit: 100,
        skip: 0,
      }),
    ]);

    const result = {
      restaurantName: restaurantData?.name || 'Restaurant Menu',
      categories,
      items,
      // ✅ Include busy table info so frontend can show a warning
      tableBusyStatus: activeOrder ? {
        isBusy: true,
        message: `Table ${tableData.table_number} has a running order. You can add more items or create a new order.`,
        orderId: activeOrder.id,
        orderStatus: activeOrder.status,
      } : null,
    };

    res.status(200).json({
      statusCode: 200,
      success: true,
      data: result,
      message: 'Menu fetched successfully',
    });
  } catch (error) {
    console.error('❌ Error fetching public menu:', error.message);
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: `Failed to load menu: ${error.message}`,
    });
  }
});

// Get menu for customer via QR code (no auth required)
router.get('/menu/:qrCodeData/items', requireFeatureFlag('qr_ordering', 'QR ordering is currently disabled by the platform administrator.'), validateParams(tableSchema), async (req, res) => {
  try {
    const { qrCodeData } = req.params;

    // Extract restaurantId from QR code
    const restaurantId = qrCodeData.split('-')[0];

    const [categories, items] = await Promise.all([
      MenuService.getCategories(restaurantId),
      MenuService.getMenuItems(restaurantId, {
      limit: 100,
      skip: 0,
      }),
    ]);

    res.status(200).json({
      statusCode: 200,
      success: true,
      data: { categories, items },
      message: 'Menu fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      success: false,
      message: error.message,
    });
  }
});

// Create order as customer (no auth required, but table must be valid)
// This handles table resolution from tableNumber to tableId
router.post('/orders', optionalAuth, requireFeatureFlag('qr_ordering', 'QR ordering is currently disabled by the platform administrator.'), async (req, res, next) => {
  try {
    console.log('📦 Customer order creation route:', {
      hasTableId: !!req.body.tableId,
      hasTableNumber: !!req.body.tableNumber,
      hasRestaurantId: !!req.body.restaurantId,
      itemsCount: req.body.items?.length,
      hasUser: !!req.user,
    });

    // ✅ Validate input data
    if (!req.body.tableId && !req.body.tableNumber) {
      SecurityAuditLogger.logFailedValidation(
        req.user?.id || 'unknown',
        'table_identifier',
        'order_creation',
        'Missing table ID or table number',
        req.ip
      );
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Table ID or table number is required'
      });
    }

    if (req.body.items && (!Array.isArray(req.body.items) || req.body.items.length === 0)) {
      SecurityAuditLogger.logFailedValidation(
        req.user?.id || 'unknown',
        'items',
        'order_creation',
        'Invalid or empty items array',
        req.ip
      );
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    req.orderOrigin = 'qr';

    if (req.body.tableId) {
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('id', req.body.tableId)
        .single();

      if (tableError || !table) {
        console.error('❌ Table lookup failed:', { tableId: req.body.tableId, error: tableError?.message });
        SecurityAuditLogger.logUnauthorizedAccess(
          req.user?.id || 'unknown',
          '/customer/orders',
          'POST',
          req.ip
        );
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'Table not found'
        });
      }

      req.restaurantId = table.restaurant_id;
      console.log(`✅ Restaurant ID set from table: ${req.restaurantId}`);

      try {
        const activeOrder = await getBusyTableOrder(table.restaurant_id, table.id);
        if (activeOrder) {
          return res.status(409).json({
            statusCode: 409,
            success: false,
            message: 'This table already has a running bill. New QR orders are blocked until that bill is cleared.',
            data: {
              tableId: table.id,
              orderId: activeOrder.id,
              orderStatus: activeOrder.status,
            },
          });
        }
      } catch (busyTableError) {
        console.error('⚠️ Error checking busy table status:', {
          error: busyTableError.message,
          tableId: req.body.tableId,
        });
        // Don't block order creation if busy table check fails
        // Log but continue to order creation
      }
    }

    // If tableNumber is provided but not tableId, resolve it
    if (req.body.tableNumber && !req.body.tableId) {
      console.log('🔍 Resolving table number:', req.body.tableNumber);
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('table_number', normalizeTableLabel(req.body.tableNumber))
        .single();

      if (tableError || !table) {
        console.error('❌ Table lookup failed:', { tableNumber: req.body.tableNumber, error: tableError?.message });
        SecurityAuditLogger.logFailedValidation(
          req.user?.id || 'unknown',
          'table_number',
          'order_creation',
          `Table ${req.body.tableNumber} not found`,
          req.ip
        );
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: `Table ${req.body.tableNumber} not found`,
        });
      }

      // Add resolved IDs to request body
      req.body.tableId = table.id;
      req.restaurantId = table.restaurant_id;
      console.log(`✅ Restaurant ID set from table number: ${req.restaurantId}`);

      try {
        const activeOrder = await getBusyTableOrder(table.restaurant_id, table.id);
        if (activeOrder) {
          return res.status(409).json({
            statusCode: 409,
            success: false,
            message: `Table ${req.body.tableNumber} already has a running bill. New QR orders are blocked until that bill is cleared.`,
            data: {
              tableId: table.id,
              tableNumber: req.body.tableNumber,
              orderId: activeOrder.id,
              orderStatus: activeOrder.status,
            },
          });
        }
      } catch (busyTableError) {
        console.error('⚠️ Error checking busy table status:', {
          error: busyTableError.message,
          tableNumber: req.body.tableNumber,
        });
        // Don't block order creation if busy table check fails
        // Log but continue to order creation
      }
    }

    // ✅ Ensure restaurantId is available to controller
    if (req.restaurantId && !req.body.restaurantId) {
      req.body.restaurantId = req.restaurantId;
    }

    // ✅ Log data access
    SecurityAuditLogger.logDataAccess(
      req.user?.id || 'unknown',
      'orders',
      'create',
      req.ip
    );

    console.log('📝 Request ready for order creation:', {
      restaurantId: req.restaurantId,
      tableId: req.body.tableId,
      itemsCount: req.body.items?.length,
    });

    // Call the order controller
    next();
  } catch (error) {
    console.error('❌ CRITICAL: Error in POST /orders pre-check:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
      stack: error.stack,
    });
    SecurityAuditLogger.logSuspiciousActivity(
      req.user?.id || 'unknown',
      'order_creation_error',
      { 
        error: error.message,
        code: error.code,
        status: error.status,
      },
      req.ip
    );
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to validate order. Please try again.',
    });
  }
}, orderController.createOrder);

router.get('/orders/:orderId', requireFeatureFlag('qr_ordering', 'QR ordering is currently disabled by the platform administrator.'), async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        restaurant_id,
        tables!table_id (
          table_number
        )
      `)
      .eq('id', req.params.orderId)
      .single();

    if (error || !order) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Order not found',
      });
    }

    if (
      req.query.table &&
      normalizeTableLabel(req.query.table) !== normalizeTableLabel(order.tables?.table_number)
    ) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: 'Order does not belong to this table',
      });
    }

    req.restaurantId = order.restaurant_id;
    next();
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to fetch order',
    });
  }
}, orderController.getOrderById);

router.get('/orders/table/:tableNumber', requireFeatureFlag('qr_ordering', 'QR ordering is currently disabled by the platform administrator.'), async (req, res) => {
  try {
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, restaurant_id')
      .eq('table_number', normalizeTableLabel(req.params.tableNumber))
      .single();

    if (tableError || !table) {
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: 'Table not found',
      });
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, restaurant_id, status, total_amount, created_at')
      .eq('restaurant_id', table.restaurant_id)
      .eq('table_id', table.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      statusCode: 200,
      success: true,
      data: orders || [],
      message: 'Orders fetched successfully',
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to fetch table orders',
    });
  }
});

export default router;
