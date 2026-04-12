#!/usr/bin/env node
/**
 * Reset Activity Logs Table
 * Deletes old activity_logs table and creates fresh one
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetActivityTable() {
  try {
    console.log('🔄 Resetting activity_logs table...\n');

    // Drop and recreate the table
    const sql = `
DROP TABLE IF EXISTS activity_logs CASCADE;

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
    `;

    // Execute SQL via Supabase RPC if available, otherwise direct query
    const { data, error } = await supabase.rpc('sql_exec', { sql }).catch(err => {
      // RPC might not be available, try direct insert/select
      return { data: null, error: err };
    });

    if (error && error.message.includes('sql_exec')) {
      console.log('⚠️  RPC method not available');
      console.log('\n📋 Please execute this SQL manually in Supabase:\n');
      console.log(sql);
      console.log('\n');
      console.log('Steps:');
      console.log('1. Go to Supabase Dashboard > Your Project');
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Create a new query');
      console.log('4. Paste the SQL above');
      console.log('5. Click "Run"\n');
      return false;
    }

    if (error) {
      console.error('❌ Error:', error.message);
      return false;
    }

    console.log('✅ Activity logs table reset successfully!\n');
    console.log('Table is ready for activity logging.');
    return true;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

// Run the reset
const success = await resetActivityTable();
process.exit(success ? 0 : 1);
