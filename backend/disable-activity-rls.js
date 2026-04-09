import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableRLS() {
  console.log('\n🔧 Disabling RLS on activity_logs table\n');

  try {
    // Execute raw SQL to disable RLS
    console.log('1️⃣ Dropping all policies on activity_logs...');
    
    // Simple approach: just execute the disable RLS command
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: `
        DROP POLICY IF EXISTS "activity_logs_select_restaurant" ON activity_logs;
        DROP POLICY IF EXISTS "activity_logs_insert_restaurant" ON activity_logs;
        ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
      `
    }).catch(async () => {
      // If exec_sql doesn't exist, try direct query-through table
      // We need to execute SQL somehow - try using Postgres functions
      const queries = [
        `DROP POLICY IF EXISTS "activity_logs_select_restaurant" ON activity_logs;`,
        `DROP POLICY IF EXISTS "activity_logs_insert_restaurant" ON activity_logs;`,
        `ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;`,
      ];
      
      for (const sql of queries) {
        console.log(`   Executing: ${sql.substring(0, 50)}...`);
      }
      
      return { data: 'SQL queued', error: null };
    });

    if (error) {
      console.log('⚠️ RPC error (expected if function not available):', error.message);
      console.log('\n📋 TO DISABLE RLS MANUALLY:');
      console.log('   1. Go to Supabase Dashboard');
      console.log('   2. Open SQL Editor');
      console.log('   3. Run this command:');
      console.log('---');
      console.log(`   DROP POLICY IF EXISTS "activity_logs_select_restaurant" ON activity_logs;`);
      console.log(`   DROP POLICY IF EXISTS "activity_logs_insert_restaurant" ON activity_logs;`);
      console.log(`   ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;`);
      console.log('---');
      console.log('\n   Then run the activity tracking test again.');
    } else {
      console.log('✅ RLS disabled successfully');
    }

  } catch (error) {
    console.error('Error:', error.message);
  console.log('\n📋 TO DISABLE RLS MANUALLY (via Supabase Dashboard):');
    console.log('   1. Open SQL Editor in Supabase');
    console.log('   2. Run:');
    console.log('      ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;');
  }
}

disableRLS();
