import supabase from '../src/config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createActivityTables() {
  try {
    console.log('📦 Creating activity_logs table...');

    // Create activity_logs table
    const { error: tableError } = await supabase.from('activity_logs').select('id').limit(0);
    
    if (tableError && tableError.code === 'PGRST116') {
      // Table doesn't exist, need to create it
      console.log('📝 Table does not exist. Attempting to create...');
      
      // For Supabase, we need to use the SQL Editor or API
      // The tables should be created via the Supabase dashboard
      console.log(`
⚠️  MANUAL SETUP REQUIRED
=====================================================
Please execute the following SQL in your Supabase SQL Editor:

From file: ACTIVITY_SCHEMA.sql

Steps:
1. Go to Supabase Dashboard > Your Project > SQL Editor
2. Create a new query
3. Copy the contents of ACTIVITY_SCHEMA.sql
4. Execute the query

The script will verify after you deploy.
=====================================================
      `);
      
      return;
    }

    if (!tableError) {
      console.log('✅ Table already exists!');
      return;
    }

    if (tableError && tableError.code !== 'PGRST116') {
      console.error('❌ Unexpected error:', tableError);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function verifyActivitySchema() {
  try {
    console.log('\n📋 Verifying activity schema...');

    // Check if table exists
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      console.log('❌ activity_logs table does not exist yet');
      console.log('   Please deploy ACTIVITY_SCHEMA.sql to Supabase first');
      return false;
    }

    if (!error) {
      console.log('✅ activity_logs table verified!');
      return true;
    }

    console.log('⚠️  Status unknown:', error.message);
    return false;
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Activity Schema Deployment\n');
  
  await createActivityTables();
  const verified = await verifyActivitySchema();

  if (!verified) {
    console.log('\n💡 Next steps:');
    console.log('1. Open Supabase Dashboard > SQL Editor');
    console.log('2. Run the SQL from ACTIVITY_SCHEMA.sql');
    console.log('3. Re-run this script to verify');
    console.log('\nFile path: ./ACTIVITY_SCHEMA.sql');
  } else {
    console.log('\n✅ Activity schema is ready to use!');
  }
}

main();

