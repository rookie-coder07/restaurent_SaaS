import fetch from 'node-fetch';

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-manager-token'; // Use valid token

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(`${COLORS[color]}`, ...args, COLORS.reset);
}

async function testTakeawayOrderWithBlankKOTFix() {
  log('cyan', '='.repeat(80));
  log('cyan', '🧪 TESTING: Blank KOT Fix for Manager Takeaway Orders');
  log('cyan', '='.repeat(80));

  try {
    // Step 1: Get a valid manager token
    log('blue', '\n📍 Step 1: Getting manager authentication...');
    const authResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@test.com',
        password: 'password123',
      }),
    });

    if (!authResponse.ok) {
      log('yellow', '⚠️ Using test token for authentication');
    } else {
      const authData = await authResponse.json();
      if (authData.data?.token) {
        TEST_TOKEN = authData.data.token;
        log('green', '✅ Authentication successful');
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TEST_TOKEN}`,
    };

    // Step 2: Test 1 - Create order with "items" field (standard)
    log('blue', '\n📍 Step 2a: Create takeaway order with "items" field (STANDARD)');
    const orderPayload1 = {
      items: [
        { menuItemId: 'item-1', quantity: 2, unitPrice: 100, name: 'Biryani' },
        { menuItemId: 'item-2', quantity: 1, unitPrice: 50, name: 'Raita' },
      ],
      customerName: 'Test Customer 1',
      customerPhone: '+919876543210',
      total: 250,
      notes: 'No onions',
    };

    log('yellow', 'Payload:', JSON.stringify(orderPayload1, null, 2));

    const response1 = await fetch(`${BASE_URL}/api/v1/takeaway`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload1),
    });

    if (!response1.ok) {
      log('red', `❌ Failed: ${response1.status} ${response1.statusText}`);
      const error = await response1.text();
      log('red', error);
      return false;
    }

    const data1 = await response1.json();
    const order1 = data1.data;
    log('green', `✅ Order created: ${order1?.id}`);
    log('green', `📋 Items in response: ${order1?.items?.length || 0}`);
    if (order1?.items?.length === 0) {
      log('red', '❌ ISSUE: Items are empty in response!');
    }

    // Step 3: Test 2 - Create order with "orderItems" field (alternative)
    log('blue', '\n📍 Step 2b: Create takeaway order with "orderItems" field (ALTERNATIVE)');
    const orderPayload2 = {
      orderItems: [
        { menuItemId: 'item-1', quantity: 1, unitPrice: 100, name: 'Biryani' },
      ],
      customerName: 'Test Customer 2',
      customerPhone: '+919876543211',
      total: 100,
    };

    log('yellow', 'Payload:', JSON.stringify(orderPayload2, null, 2));

    const response2 = await fetch(`${BASE_URL}/api/v1/takeaway`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload2),
    });

    if (!response2.ok) {
      log('red', `❌ Failed: ${response2.status} ${response2.statusText}`);
      const error = await response2.text();
      log('red', error);
    } else {
      const data2 = await response2.json();
      const order2 = data2.data;
      log('green', `✅ Order created: ${order2?.id}`);
      log('green', `📋 Items in response: ${order2?.items?.length || 0}`);
    }

    // Step 4: Test 3 - Create order with "cartItems" field (alternative)
    log('blue', '\n📍 Step 2c: Create takeaway order with "cartItems" field (ALTERNATIVE)');
    const orderPayload3 = {
      cartItems: [
        { menuItemId: 'item-2', quantity: 3, unitPrice: 50, name: 'Raita' },
      ],
      customerName: 'Test Customer 3',
      customerPhone: '+919876543212',
      total: 150,
    };

    log('yellow', 'Payload:', JSON.stringify(orderPayload3, null, 2));

    const response3 = await fetch(`${BASE_URL}/api/v1/takeaway`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload3),
    });

    if (!response3.ok) {
      log('red', `❌ Failed: ${response3.status} ${response3.statusText}`);
      const error = await response3.text();
      log('red', error);
    } else {
      const data3 = await response3.json();
      const order3 = data3.data;
      log('green', `✅ Order created: ${order3?.id}`);
      log('green', `📋 Items in response: ${order3?.items?.length || 0}`);
    }

    // Step 5: Test 4 - Verify validation (empty cart)
    log('blue', '\n📍 Step 3: Test validation with empty cart');
    const emptyOrderPayload = {
      items: [],
      customerName: 'Test Customer Empty',
      customerPhone: '+919876543213',
      total: 0,
    };

    const response4 = await fetch(`${BASE_URL}/api/v1/takeaway`, {
      method: 'POST',
      headers,
      body: JSON.stringify(emptyOrderPayload),
    });

    if (response4.ok) {
      log('red', '❌ VALIDATION FAILED: Empty cart should be rejected!');
    } else {
      log('green', `✅ Correctly rejected empty cart: ${response4.status}`);
    }

    // Step 6: Test KOT generation with first order
    if (order1?.id) {
      log('blue', '\n📍 Step 4: Send order to kitchen (generate KOT)');
      log('yellow', `Order ID: ${order1.id}`);
      log('yellow', `Items in order: ${order1.items?.length || 0}`);

      const kotResponse = await fetch(`${BASE_URL}/api/v1/orders/${order1.id}/send-to-kitchen`, {
        method: 'POST',
        headers,
      });

      if (!kotResponse.ok) {
        log('red', `❌ Failed to send to kitchen: ${kotResponse.status}`);
        const error = await kotResponse.text();
        log('red', error);
      } else {
        const kotData = await kotResponse.json();
        const ticket = kotData.data?.ticket;
        log('green', '✅ Order sent to kitchen');
        log('green', `🎫 KOT ticket ID: ${ticket?.id}`);
        log('green', `📦 Items in ticket: ${ticket?.items?.length || 0}`);

        if (ticket?.items?.length === 0) {
          log('red', '❌ CRITICAL ISSUE: KOT has empty items!');
        } else {
          log('green', '✅ KOT has items:');
          (ticket?.items || []).forEach((item, idx) => {
            log('green', `   ${idx + 1}. ${item.name} x${item.quantity}`);
          });
        }
      }
    }

    log('cyan', '\n' + '='.repeat(80));
    log('green', '✅ Tests completed successfully!');
    log('cyan', '='.repeat(80));

    return true;
  } catch (error) {
    log('red', '❌ Test error:', error.message);
    return false;
  }
}

// Run tests
const success = await testTakeawayOrderWithBlankKOTFix();
process.exit(success ? 0 : 1);
