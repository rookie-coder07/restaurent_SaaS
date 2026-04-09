import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeletion() {
  const restaurantId = '515cfff9-6b46-49c1-b369-1d5650c95816';
  const orderId = '7b611950-fc5e-4375-9f7d-286b6ebc3782';

  console.log('Testing direct Supabase deletion...\n');

  // Step 1: Fetch order to confirm it exists
  console.log('Step 1: Fetching order...');
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, restaurant_id, status, table_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (fetchError || !order) {
    console.log('Error fetching order:', fetchError?.message || 'Not found');
    process.exit(1);
  }

  console.log('✅ Order found:', { id: order.id, status: order.status, table_id: order.table_id });

  // Step 2: Delete the order
  console.log('\nStep 2: Deleting order...');
  const { data: deleteData, error: deleteError, count } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .select('id');

  if (deleteError) {
    console.log('❌ Delete failed:', deleteError.message);
    console.log('Error details:', deleteError);
    process.exit(1);
  }

  console.log('✅ Delete response:', { deleted: deleteData?.length || 0, count });

  // Step 3: Try to fetch the order again
  console.log('\nStep 3: Verifying deletion...');
  const { data: orderAfter, error: verifyError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (verifyError?.code === 'PGRST116') {
    console.log('✅ SUCCESS: Order deleted from database!');
    process.exit(0);
  } else if (orderAfter) {
    console.log('❌ ISSUE: Order still exists in database!');
    console.log('Order:', orderAfter);
    process.exit(1);
  } else {
    console.log('Unexpected error:', verifyError);
    process.exit(1);
  }
}

testDeletion().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
