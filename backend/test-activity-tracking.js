import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

// Use service key to bypass RLS for testing
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_RESTAURANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_WAITER_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_WAITER_EMAIL = 'testwaiter@pos.com';

async function testActivityTracking() {
  console.log('\n🧪 Testing Activity Tracking System\n');

  try {
    // 1. Get waiter ID
    console.log('1️⃣ Fetching waiter...');
    const { data: waiter, error: waiterError } = await supabase
      .from('users')
      .select('id, name, email, restaurant_id')
      .eq('email', TEST_WAITER_EMAIL)
      .single();

    if (waiterError) {
      console.log('❌ Waiter not found:', waiterError.message);
      return;
    }

    console.log(`✅ Found waiter: ${waiter.name} (${waiter.email})`);
    console.log(`   ID: ${waiter.id}`);
    console.log(`   Restaurant: ${waiter.restaurant_id}`);

    const waiterId = waiter.id;
    const restaurantId = waiter.restaurant_id;

    // 2. Check existing activity
    console.log('\n2️⃣ Checking existing activity logs...');
    const { data: existingLogs, error: checkError } = await supabase
      .from('activity_logs')
      .select('id, action, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', waiterId)
      .order('created_at', { ascending: false });

    if (checkError) {
      console.log('❌ Query error:', checkError.message);
      return;
    }

    console.log(`✅ Found ${existingLogs?.length || 0} existing activity logs`);
    if (existingLogs?.length > 0) {
      existingLogs.slice(0, 3).forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.action} - ${log.created_at}`);
      });
    }

    // 3. Insert test activity
    console.log('\n3️⃣ Inserting test activity logs...');
    const testActivities = [
      {
        restaurant_id: restaurantId,
        user_id: waiterId,
        role: 'waiter',
        action: 'order_created',
        details: { orderId: 'test-001', tableId: 'T1', itemCount: 2, totalAmount: 299.99 },
      },
      {
        restaurant_id: restaurantId,
        user_id: waiterId,
        role: 'waiter',
        action: 'bill_generated',
        details: { orderId: 'test-001', invoiceNumber: 'INV-001', totalAmount: 299.99 },
      },
      {
        restaurant_id: restaurantId,
        user_id: waiterId,
        role: 'waiter',
        action: 'payment_completed',
        details: { orderId: 'test-001', paymentMethod: 'cash', amountReceived: 300 },
      },
    ];

    const { error: insertError } = await supabase
      .from('activity_logs')
      .insert(testActivities);

    if (insertError) {
      console.log('❌ Insert error:', insertError.message);
      return;
    }

    console.log(`✅ Inserted ${testActivities.length} test activity logs`);

    // 4. Verify inserts
    console.log('\n4️⃣ Verifying inserted activity...');
    const { data: newLogs, error: verifyError } = await supabase
      .from('activity_logs')
      .select('id, action, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', waiterId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (verifyError) {
      console.log('❌ Verification error:', verifyError.message);
      return;
    }

    console.log(`✅ Retrieved ${newLogs?.length || 0} activity logs (after insert)`);
    newLogs?.slice(0, 5).forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.action} - ${log.created_at}`);
    });

    // 5. Count by action
    console.log('\n5️⃣ Activity stats...');
    const { count: totalCount } = await supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', waiterId);

    const { count: orderCount } = await supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', waiterId)
      .eq('action', 'order_created');

    console.log(`   Total activities: ${totalCount || 0}`);
    console.log(`   Order creations: ${orderCount || 0}`);

    // 6. Last active
    console.log('\n6️⃣ Last active time...');
    const { data: lastActive } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', waiterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastActive) {
      console.log(`✅ Last active: ${new Date(lastActive.created_at).toLocaleString()}`);
    } else {
      console.log(`❌ No last active timestamp found`);
    }

    console.log('\n✅ Activity tracking test complete!\n');

  } catch (error) {
    console.error('🔴 Test failed:', error);
  }
}

testActivityTracking();
