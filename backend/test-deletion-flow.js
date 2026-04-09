import 'dotenv/config';
import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const RESTAURANT_ID = '515cfff9-6b46-49c1-b369-1d5650c95816';

// Generate a valid token with owner role for deletion testing
const token = jwt.sign(
  {
    userId: '8c5953f4-5afd-49e2-9a42-c5bd0620753c',
    restaurantId: RESTAURANT_ID,
    role: 'owner',
  },
  JWT_SECRET,
  { expiresIn: '15m' }
);

console.log('Testing Order Deletion Flow\n');
console.log('Token:', token, '\n');

// Step 1: Get orders
const getOrders = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/orders?limit=5&skip=0',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data?.items || json.data || []);
        } catch (e) {
          console.log('Error parsing response:', e.message);
          resolve([]);
        }
      });
    });
    req.on('error', err => {
      console.error('Error fetching orders:', err.message);
      resolve([]);
    });
    req.end();
  });
};

// Step 2: Delete an order
const deleteOrder = (orderId) => {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      reason: 'Testing deletion',
      current_password: ''  // Don't provide password
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/orders/${orderId}/delete`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': payload.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n✅ Delete Response Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('Delete Response:', JSON.stringify(json, null, 2).substring(0, 300));
        } catch (e) {
          console.log('Response:', data.substring(0, 300));
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', err => {
      console.error('Error deleting order:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
};

async function testDeletion() {
  console.log('Step 1: Fetching current orders...');
  const ordersBefore = await getOrders();
  console.log(`Found ${ordersBefore.length} orders`);
  
  if (ordersBefore.length === 0) {
    console.log('No orders to delete. Test cannot continue.');
    process.exit(1);
  }

  const orderToDelete = ordersBefore[0];
  console.log(`\nOrder to delete: ${orderToDelete.id} (${orderToDelete.displayOrderNumber})`);
  
  console.log('\nStep 2: Deleting order...');
  const deleted = await deleteOrder(orderToDelete.id);
  
  if (!deleted) {
    console.log('Deletion failed!');
    process.exit(1);
  }

  // Wait a bit for backend processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nStep 3: Fetching orders again to verify deletion...');
  const ordersAfter = await getOrders();
  console.log(`Found ${ordersAfter.length} orders after deletion`);

  const deletedOrderStillExists = ordersAfter.some(o => o.id === orderToDelete.id);
  
  if (deletedOrderStillExists) {
    console.log('\n❌ ISSUE: Deleted order still appears in the list!');
    console.log('Deleted order:', JSON.stringify(ordersAfter.find(o => o.id === orderToDelete.id), null, 2).substring(0, 300));
  } else {
    console.log('\n✅ SUCCESS: Deleted order no longer appears in the list');
  }

  process.exit(deletedOrderStillExists ? 1 : 0);
}

testDeletion().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
