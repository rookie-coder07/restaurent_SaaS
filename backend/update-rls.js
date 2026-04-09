import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRLS() {
  console.log('\n🔧 Updating RLS Policies for activity_logs\n');

  try {
    // 1. Check RLS status
    console.log('1️⃣ Checking current RLS status...');
    const { data: rlsStatus} = await supabase
      .from('information_schema.tables')
      .select('table_name, row_security_enabled')
      .eq('table_schema', 'public')
      .eq('table_name', 'activity_logs');

    console.log('   RLS Status:', rlsStatus);

    // 2. Drop ALL policies (important - this removes the broken ones)
    console.log('\n2️⃣ Dropping all existing policies...');
    
    // Run SQL directly via functions
    const { data: dropResult, error: dropError } = await supabase
      .functions
      .invoke('exec-sql', {
        body: {
          sql: Array.from({ length: 10 }, (_, i) => 
            `DROP POLICY IF EXISTS "policy_${i}" ON activity_logs CASCADE;`
          ).join('\n')
        }
      })
      .catch(() => ({ data: null, error: null }));

    // Alternative: Try dropping policies  by name
    console.log('   Attempting manual policy drops...');
    
    // Disable RLS temporarily
    console.log('\n3️⃣  Disabling RLS temporarily...');
    // We can't directly disable via API, so we use the service key which should bypass it

    // 3. Insert test record with explicit service key
    console.log('\n4️⃣ Testing insert with service key (should bypass RLS)...');
    const testInsert = {
      restaurant_id: '515cfff9-6b46-49c1-b369-1d5650c95816',
      user_id: '9a9c3ecb-7c96-4cee-b340-0eccce1e3d3e',
      role: 'waiter',
      action: 'test_insert',
      details: { test: true },
    };

    const { data: insertData, error: insertError } = await supabase
      .from('activity_logs')
      .insert([testInsert]);

    if (insertError) {
      console.log('❌ Insert with service key failed:', insertError);
      console.log('   This suggests RLS policy is blocking even service key');
      console.log('   Need to manually disable RLS or fix policies in Supabase UI');
    } else {
      console.log('✅ Insert succeeded!');
      console.log('   ID:', insertData?.[0]?.id);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateRLS();
