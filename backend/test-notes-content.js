import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const restaurantId = '515cfff9-6b46-49c1-b369-1d5650c95816';
  const orderId = '7b611950-fc5e-4375-9f7d-286b6ebc3782';

  console.log('Checking order notes that should contain [order-delete]...\n');

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, notes')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .single();

  if (error) {
    console.log('Error:', error.message);
    process.exit(1);
  }

  if (order) {
    console.log('Order found');
    console.log('Notes length:', order.notes?.length || 0);
    console.log('Contains [order-delete]?', (order.notes || '').includes('[order-delete]'));
    
    // Show the beginning and end of notes
    if (order.notes) {
      console.log('First 200 chars:', order.notes.substring(0, 200));
      console.log('Last 100 chars:', order.notes.substring(order.notes.length - 100));
    }
  }

  process.exit(0);
}

test().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
