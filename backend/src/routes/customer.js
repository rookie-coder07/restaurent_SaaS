import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validateParams } from '../middleware/validation.js';
import Joi from 'joi';
import MenuService from '../services/menuService.js';
import TableService from '../services/tableService.js';
import * as orderController from '../controllers/orderController.js';
import supabase from '../config/supabase.js';

const router = express.Router();

const tableSchema = Joi.object({
  qrCodeData: Joi.string().required(),
});

function normalizeTableLabel(value) {
  return String(value || '').trim();
}

// Get public menu items (no auth required)
// This endpoint is called by customers who scanned a QR code
// Pass ?table=X to get the menu for that table's restaurant
router.get('/menu/items', async (req, res) => {
  try {
    const { table, tableId } = req.query;
    console.log(`📋 Customer menu request - Table: ${table}, Table ID: ${tableId}`);

    if (!table && !tableId) {
      console.warn('⚠️  Missing table identifier');
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
      console.log(`🔍 Looking up table by id ${tableId}...`);
      query = query.eq('id', tableId);
    } else {
      console.log(`🔍 Looking up table by number ${table}...`);
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
    console.log(`✅ Found restaurant: ${restaurantId} for table ${tableData.table_number}`);

    console.log(`📦 Fetching categories and menu items for restaurant ${restaurantId}...`);
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
    };

    console.log(`✅ Retrieved ${(categories || []).length} categories and ${(items || []).length} menu items`);
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
router.get('/menu/:qrCodeData/items', validateParams(tableSchema), async (req, res) => {
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
router.post('/orders', optionalAuth, async (req, res, next) => {
  try {
    req.orderOrigin = 'qr';

    if (req.body.tableId) {
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('id', req.body.tableId)
        .single();

      if (tableError || !table) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: 'Table not found',
        });
      }

      req.restaurantId = table.restaurant_id;
      console.log(`✅ Using table ID ${req.body.tableId} for restaurant ${table.restaurant_id}`);
    }

    // If tableNumber is provided but not tableId, resolve it
    if (req.body.tableNumber && !req.body.tableId) {
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('table_number', normalizeTableLabel(req.body.tableNumber))
        .single();

      if (tableError || !table) {
        return res.status(404).json({
          statusCode: 404,
          success: false,
          message: `Table ${req.body.tableNumber} not found`,
        });
      }

      // Add resolved IDs to request body
      req.body.tableId = table.id;
      req.restaurantId = table.restaurant_id;
      console.log(`✅ Resolved Table #${req.body.tableNumber} → ID: ${table.id}`);
    }

    // Call the order controller
    next();
  } catch (error) {
    console.error('❌ Error resolving table:', error.message);
    return res.status(500).json({
      statusCode: 500,
      success: false,
      message: 'Failed to process order',
    });
  }
}, orderController.createOrder);

router.get('/orders/:orderId', async (req, res, next) => {
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

router.get('/orders/table/:tableNumber', async (req, res) => {
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
