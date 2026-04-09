import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const restaurantId = '515cfff9-6b46-49c1-b369-1d5650c95816';
  const orderId = '7b611950-fc5e-4375-9f7d-286b6ebc3782';

  console.log('Checking order is_archived status...\n');

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, is_archived')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (error) {
    console.log('Error:', error.message);
  } else if (order) {
    console.log('Order found:', JSON.stringify(order, null, 2));
    console.log('is_archived:', order.is_archived);
  } else {
    console.log('Order not found');
  }

  process.exit(0);
}

test().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
