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

// Get public menu items (no auth required)
// This endpoint is called by customers who scanned a QR code
// Pass ?table=X to get the menu for that table's restaurant
router.get('/menu/items', async (req, res) => {
  try {
    const { table } = req.query;
    console.log(`📋 Customer menu request - Table: ${table}`);

    if (!table) {
      console.warn('⚠️  Missing table parameter');
      return res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Table number is required',
      });
    }

    // Get restaurant ID from table lookup
    console.log(`🔍 Looking up table ${table}...`);
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('restaurant_id')
      .eq('table_number', parseInt(table))
      .limit(1)
      .single();

    if (tableError || !tableData) {
      console.error('❌ Table lookup error:', tableError?.message || 'Table not found');
      return res.status(404).json({
        statusCode: 404,
        success: false,
        message: `Table ${table} not found in system`,
      });
    }

    const restaurantId = tableData.restaurant_id;
    console.log(`✅ Found restaurant: ${restaurantId} for table ${table}`);

    // Get all menu items for this restaurant
    console.log(`📦 Fetching menu items for restaurant ${restaurantId}...`);
    const result = await MenuService.getMenuItems(restaurantId, {
      limit: 100,
      skip: 0,
    });

    console.log(`✅ Retrieved ${result?.length || 0} menu items`);
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

    // Get menu items
    const result = await MenuService.getMenuItems(restaurantId, {
      limit: 100,
      skip: 0,
    });

    res.status(200).json({
      statusCode: 200,
      success: true,
      data: result,
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
    // If tableNumber is provided but not tableId, resolve it
    if (req.body.tableNumber && !req.body.tableId) {
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('id, restaurant_id')
        .eq('table_number', parseInt(req.body.tableNumber))
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

export default router;
