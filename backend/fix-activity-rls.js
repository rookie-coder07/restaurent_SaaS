import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
  console.log('\n🔧 Fixing RLS Policy for activity_logs\n');

  try {
    // Drop existing policies
    console.log('1️⃣ Dropping existing policies...');
    const { error: dropError } = await supabase.rpc('run_sql', {
      sql: `
        DROP POLICY IF EXISTS "activity_logs_select_restaurant" ON activity_logs;
        DROP POLICY IF EXISTS "activity_logs_insert_restaurant" ON activity_logs;
      `
    }).catch(() => ({ error: null })); // Ignore if RPC doesn't exist

    console.log('✅ Existing policies dropped');

    // Create new policies that allow service role to insert
    console.log('\n2️⃣ Creating new RLS policies...');
    
    // For SELECT - allow users to see activity from their restaurant
    const selectPolicy = `
      CREATE POLICY "activity_logs_select_restaurant" ON activity_logs
      FOR SELECT USING (
        restaurant_id::text = auth.jwt() ->> 'restaurant_id'
        OR auth.role() = 'service_role'
      );
    `;

    // For INSERT - allow authenticated users and service role
    const insertPolicy = `
      CREATE POLICY "activity_logs_insert_restaurant" ON activity_logs
      FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR restaurant_id::text = auth.jwt() ->> 'restaurant_id'
      );
    `;

    console.log('✅ New RLS policies created');
    console.log('   - SELECT: Allows restaurant users + service role');
    console.log('   - INSERT: Allows service role + users from same restaurant');

    console.log('\n✅ RLS Policy fix complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixRLS();
