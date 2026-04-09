import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteConditions() {
  const restaurantId = '515cfff9-6b46-49c1-b369-1d5650c95816';
  const orderId = '7b611950-fc5e-4375-9f7d-286b6ebc3782';

  console.log('Testing delete with different WHERE conditions...\n');

  // Test 1: Delete with just id
  console.log('Test 1: Delete with id only');
  let { error: e1 } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);
  console.log(e1 ? '❌ Error: ' + e1.message : '✅ No error');

  // Verify order still exists
  const { data: order1 } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();
  console.log(order1 ? 'Order exists' : 'Order deleted');

  // Test 2: Delete with id + restaurant_id
  console.log('\nTest 2: Delete with id + restaurant_id');
  let { error: e2 } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId);
  console.log(e2 ? '❌ Error: ' + e2.message : '✅ No error');

  // Verify order still exists
  const { data: order2 } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .single();
  console.log(order2 ? 'Order exists' : 'Order deleted');

  // Test 3: Check RLS policies
  console.log('\nTest 3: Checking table structure');
  const { data: orders, error: e3 } = await supabase
    .from('orders')
    .select('id, restaurant_id, is_deleted, deleted_at')
    .eq('id', orderId)
    .limit(1);

  if (e3) {
    console.log('Error fetching columns:', e3.message);
  } else {
    console.log('Order data:', JSON.stringify(orders[0], null, 2));
  }

  // Test 4: Try to remove by setting is_deleted
  console.log('\nTest 4: Try soft delete (update is_deleted flag)');
  const { error: e4, data: updated } = await supabase
    .from('orders')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .select();
  
  if (e4) {
    console.log('❌ Error: ' + e4.message);
  } else {
    console.log('✅ Updated:', updated?.length || 0, 'rows');
  }

  process.exit(0);
}

testDeleteConditions().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
