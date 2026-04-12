#!/usr/bin/env node

import supabase from '../src/config/supabase.js';
import logger from '../src/utils/logger.js';

async function initActivityTable() {
  try {
    console.log('🔍 Checking if activity_logs table exists...\n');

    // Try to select from the table
    const { data, error } = await supabase
      .from('activity_logs')
      .select('id')
      .limit(1);

    if (!error) {
      console.log('✅ Table already exists!\n');
      console.log('Table is ready for activity logging.');
      return true;
    }

    if (error && error.code === 'PGRST116') {
      console.log('❌ Table does not exist. Creating...\n');

      // Create the table with SQL
      const createTableSQL = `
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
      `;

      const { error: createError } = await supabase.rpc('exec', { sql: createTableSQL }).catch(() => ({
        error: { message: 'RPC method not available' }
      }));

      if (createError) {
        console.log('⚠️  Automatic table creation failed.');
        console.log('\n📝 MANUAL SETUP REQUIRED\n');
        console.log('Please execute this SQL in your Supabase SQL Editor:\n');
        console.log(createTableSQL);
        console.log('\nSteps:');
        console.log('1. Go to Supabase Dashboard > Your Project > SQL Editor');
        console.log('2. Create a new query');
        console.log('3. Paste the SQL above');
        console.log('4. Click "Run"');
        return false;
      }

      console.log('✅ Table created successfully!\n');
      return true;
    }

    console.error('❌ Unexpected error:', error);
    return false;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

// Run the initialization
const success = await initActivityTable();
process.exit(success ? 0 : 1);
