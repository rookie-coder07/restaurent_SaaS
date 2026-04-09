import 'dotenv/config';
import logger from './src/utils/logger.js';
import { randomUUID } from 'crypto';

async function testOrderAPI() {
  try {
    logger.info('🧪 Testing Order API Endpoint...');

    // First, login to get auth token
    logger.info('🔐 Logging in...');
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@nisarga.com',
        password: 'Test@123',
      }),
    });

    const loginData = await loginRes.json();
    if (!loginData.data?.token) {
      logger.error('❌ Login failed:', loginData);
      return;
    }

    const token = loginData.data.token;
    logger.info('✅ Logged in, got token');

    // Get restaurant info
    const meRes = await fetch('http://localhost:3000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    const restaurantId = meData.data?.restaurantId;
    logger.info(`✅ Restaurant ID: ${restaurantId}`);

    // Get a table
    const tablesRes = await fetch(`http://localhost:3000/api/v1/tables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tablesData = await tablesRes.json();
    const tableId = tablesData.data?.[0]?.id;
    logger.info(`✅ Table ID: ${tableId}`);

    // Get menu items
    const menuRes = await fetch(`http://localhost:3000/api/v1/menu`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const menuData = await menuRes.json();
    const menuItem = menuData.data?.find(item => item.id);
    logger.info(`✅ Menu item: ${menuItem?.name} (${menuItem?.price})`);

    // Create order via API
    logger.info('📝 Creating order via API...');
    const createOrderRes = await fetch('http://localhost:3000/api/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tableId,
        items: [{
          menuItemId: menuItem.id,
          quantity: 1,
          unitPrice: menuItem.price,
          name: menuItem.name,
        }],
        totalAmount: menuItem.price,
        orderType: 'dine-in',
        paymentMethod: 'cash',
        notes: 'Test from API',
      }),
    });

    const orderResponseText = await createOrderRes.text();
    console.log('Order API Response:', orderResponseText);

    const orderData = JSON.parse(orderResponseText);
    if (orderData.success && orderData.data?.id) {
      logger.info(`✅ Order created: ${orderData.data.id}`);
      logger.info(`   Items: ${orderData.data.items?.length || 0}`);
      logger.info(`   Status: ${orderData.data.status}`);
      logger.info(`   Total: ${orderData.data.totalAmount}`);
    } else {
      logger.error('❌ Order creation failed:', orderData);
    }

  } catch (error) {
    logger.error('❌ Test error:', error);
    console.log('Error:', error);
  } finally {
    process.exit(0);
  }
}

testOrderAPI();
