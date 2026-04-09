import 'dotenv/config';
import logger from './src/utils/logger.js';

const BACKEND_URL = 'http://localhost:3000';
const RESTAURANT_ID = '515cfff9-6b46-49c1-b369-1d5650c95816';
const WAITER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFmOTQ0ZDcxLTE5MjgtNGY3Mi04ZmM1LWM2NWQ2MjkwZWQwMyIsImVtYWlsIjoidGVzdHdhaXRlckBwb3MuY29tIiwicmVzdGF1cmFudElkIjoiNTE1Y2ZmZjktNmI0Ni00OWMxLWIzNjktMWQ1NjUwYzk1ODE2Iiwicm9sZSI6IldBSVRFUiIsIm5hbWUiOiJUZXN0IFdhaXRlciIsImlhdCI6MTc3NTcyMDc5NiwiZXhwIjoxNzc1NzIxNjk2fQ.dmc0gX8Y5vqMv951syxNev7BLQM05xpzps4JxpHU7wk';

async function testWaiterKOTWorkflow() {
  try {
    console.log('\n🔍 Testing Waiter KOT Workflow After Fix\n');
    console.log('=' .repeat(60));

    const headers = {
      'Authorization': `Bearer ${WAITER_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Create a test table (or use existing)
    const testTableId = '550e8400-e29b-41d4-a716-446655440000';
    const testMenuItemId = '550e8400-e29b-41d4-a716-446655440001';

    console.log('\n📝 Step 1: Waiter Creating Order...');
    const orderPayload = {
      tableId: testTableId,
      items: [
        {
          menuItemId: testMenuItemId,
          quantity: 2,
          price: 250,
          name: 'Test Item',
        }
      ],
      orderType: 'dine-in',
      totalAmount: 500,
      notes: 'Test order for KOT workflow',
    };

    console.log('  Request:', JSON.stringify(orderPayload, null, 2));

    const createRes = await fetch(`${BACKEND_URL}/api/v1/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload),
    });

    const createData = await createRes.json();
    console.log(`  Response Status: ${createRes.status}`);
    console.log(`  Response:`, JSON.stringify(createData, null, 2));

    if (createRes.status !== 201) {
      console.log('\n❌ FAILED: Order creation failed!');
      console.log('  Expected: 201 Created');
      console.log(`  Got: ${createRes.status}`);
      if (createData.message) console.log(`  Error: ${createData.message}`);
      return false;
    }

    const orderId = createData.data?.id;
    if (!orderId) {
      console.log('\n❌ FAILED: No order ID in response');
      return false;
    }

    console.log(`\n✅ SUCCESS: Order created: ${orderId}`);

    // Step 2: Waiter sends order to kitchen
    console.log('\n📝 Step 2: Waiter Sending Order to Kitchen...');
    console.log(`  POST /api/v1/orders/${orderId}/send-to-kitchen`);

    const kotRes = await fetch(`${BACKEND_URL}/api/v1/orders/${orderId}/send-to-kitchen`, {
      method: 'POST',
      headers,
    });

    const kotData = await kotRes.json();
    console.log(`  Response Status: ${kotRes.status}`);
    console.log(`  Response:`, JSON.stringify(kotData, null, 2));

    if (kotRes.status !== 200) {
      console.log('\n❌ FAILED: KOT creation failed!');
      console.log('  Expected: 200 OK');
      console.log(`  Got: ${kotRes.status}`);
      if (kotData.message) console.log(`  Error: ${kotData.message}`);
      return false;
    }

    console.log('\n✅ SUCCESS: KOT sent to kitchen');

    // Step 3: Verify waiter CANNOT settle bill
    console.log('\n📝 Step 3: Verifying Waiter Cannot Settle Bill...');
    console.log(`  POST /api/v1/orders/${orderId}/settle`);

    const settleRes = await fetch(`${BACKEND_URL}/api/v1/orders/${orderId}/settle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });

    const settleData = await settleRes.json();
    console.log(`  Response Status: ${settleRes.status}`);
    console.log(`  Response:`, JSON.stringify(settleData, null, 2));

    if (settleRes.status !== 403) {
      console.log('\n⚠️  WARNING: Expected 403 Forbidden but got ' + settleRes.status);
      return false;
    }

    if (!settleData.message?.includes('billing')) {
      console.log('\n⚠️  WARNING: Expected billing error message');
      return false;
    }

    console.log('\n✅ SUCCESS: Waiter correctly denied billing access');

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✅ Waiter can create orders');
    console.log('  ✅ Waiter can send KOT to kitchen');
    console.log('  ✅ Waiter is denied billing operations');
    console.log('\n');

    return true;

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error(err);
    return false;
  }
}

// Run test
testWaiterKOTWorkflow().then(success => {
  process.exit(success ? 0 : 1);
});
