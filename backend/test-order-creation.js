import 'dotenv/config';
import supabase from './src/config/supabase.js';
import logger from './src/utils/logger.js';
import { randomUUID } from 'crypto';

async function testOrderCreation() {
  try {
    logger.info('🧪 Starting Order Creation Test...');

    // Get restaurant
    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name')
      .limit(1);

    if (restaurantError || !restaurants?.length) {
      logger.error('❌ No restaurants found', restaurantError);
      return;
    }

    const restaurantId = restaurants[0].id;
    logger.info(`✅ Found restaurant: ${restaurants[0].name} (${restaurantId})`);

    // Get table
    const { data: tables, error: tableError } = await supabase
      .from('tables')
      .select('id, table_number, restaurant_id')
      .eq('restaurant_id', restaurantId)
      .limit(1);

    if (tableError || !tables?.length) {
      logger.error('❌ No tables found', tableError);
      return;
    }

    const tableId = tables[0].id;
    const tableNumber = tables[0].table_number;
    logger.info(`✅ Found table: ${tableNumber} (${tableId})`);

    // Get menu item
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, price, restaurant_id')
      .eq('restaurant_id', restaurantId)
      .limit(1);

    if (menuError || !menuItems?.length) {
      logger.error('❌ No menu items found', menuError);
      return;
    }

    const menuItemId = menuItems[0].id;
    const itemPrice = menuItems[0].price;
    logger.info(`✅ Found menu item: ${menuItems[0].name} (${menuItemId}) - ₹${itemPrice}`);

    // Test create order
    logger.info('📝 Creating test order...');
    const orderId = randomUUID();
    const now = new Date().toISOString();

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        id: orderId,
        restaurant_id: restaurantId,
        table_id: tableId,
        order_type: 'dine-in',
        status: 'pending',
        total_amount: itemPrice,
        payment_method: 'cash',
        payment_status: 'pending',
        notes: 'Test order',
        created_at: now,
        updated_at: now,
      }])
      .select('id, restaurant_id, table_id, status, total_amount, created_at');

    console.log('Order Insert Response:', { orderData, orderError });

    if (orderError) {
      logger.error('❌ Order creation failed:', {
        message: orderError.message,
        code: orderError.code,
        details: orderError.details,
        hint: orderError.hint,
      });
      return;
    }

    if (!orderData || orderData.length === 0) {
      logger.error('❌ No order data returned');
      return;
    }

    const createdOrder = orderData[0];
    logger.info(`✅ Order created: ${createdOrder.id}`);

    // Test add order items
    logger.info('📦 Adding items to order...');
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .insert([{
        order_id: createdOrder.id,
        menu_item_id: menuItemId,
        quantity: 2,
        unit_price: itemPrice,
        sent_to_kitchen: false,
      }])
      .select('id, order_id, menu_item_id, quantity, unit_price');

    console.log('Order Items Insert Response:', { itemsData, itemsError });

    if (itemsError) {
      logger.error('❌ Items creation failed:', {
        message: itemsError.message,
        code: itemsError.code,
        details: itemsError.details,
        hint: itemsError.hint,
      });
      return;
    }

    logger.info(`✅ Items added: ${itemsData?.length || 0} items`);

    // Verify order
    logger.info('🔍 Verifying order...');
    const { data: verifyOrder, error: verifyError } = await supabase
      .from('orders')
      .select(`
        id,
        restaurant_id,
        table_id,
        status,
        total_amount,
        created_at,
        order_items(id, menu_item_id, quantity, unit_price)
      `)
      .eq('id', createdOrder.id)
      .single();

    if (verifyError) {
      logger.error('❌ Verification failed:', verifyError);
      return;
    }

    console.log('✅ Verified Order:', JSON.stringify(verifyOrder, null, 2));
    logger.info('✅ ORDER CREATION TEST PASSED!');

  } catch (error) {
    logger.error('❌ Test error:', error);
    console.log('Error:', error);
  } finally {
    process.exit(0);
  }
}

testOrderCreation();
