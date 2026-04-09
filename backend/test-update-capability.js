import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const restaurantId = '515cfff9-6b46-49c1-b369-1d5650c95816';
  const orderId = '7b611950-fc5e-4375-9f7d-286b6ebc3782';

  console.log('Testing if we can update ANY field on orders table...\n');

  // Try to update just the notes field
  const { error, data, count } = await supabase
    .from('orders')
    .update({ notes: 'TESTING UPDATE FLAG - ' + Date.now() })
    .eq('id', orderId);

  if (error) {
    console.log('❌ Update failed with error:', error.message);
  } else {
    console.log('✅ Update succeeded');
    console.log('Rows updated:', count || 0);
    console.log('Data returned:', data);
  }

  // Now verify
  const { data: order } = await supabase
    .from('orders')
    .select('id, notes')
    .eq('id', orderId)
    .single();

  console.log('\nOrder notes after update:', order?.notes);

  process.exit(0);
}

test().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
