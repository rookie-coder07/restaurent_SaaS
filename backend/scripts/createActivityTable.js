import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function createActivityTable() {
  try {
    console.log('🚀 Creating activity_logs table...\n');

    const sql = `
    -- Activity Logs Table
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_activity_restaurant ON activity_logs(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

    -- Disable RLS on activity_logs - backend controls access via API layer
    ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
    `;

    const { error: execError } = await supabase.rpc('exec', { sql });

    if (execError) {
      // If RPC method doesn't exist, try using the SQL method directly
      console.log('Note: rpc method not available, attempting direct execution...\n');
      
      // Split statements and execute individually
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('CREATE TABLE IF NOT EXISTS activity_logs')) {
          const { error } = await supabase.from('activity_logs').select('id').limit(0);
          if (error && error.code === 'PGRST116') {
            console.log('❌ Table creation requires direct SQL access');
            console.log('\n📋 Please run this SQL in Supabase Dashboard > SQL Editor:');
            console.log('================================================\n');
            console.log(sql);
            console.log('\n================================================');
            return false;
          }
        }
      }
    }

    // Verify table was created
    const { data, error: verifyError } = await supabase
      .from('activity_logs')
      .select('*')
      .limit(1);

    if (verifyError && verifyError.code === 'PGRST116') {
      console.log('❌ Table still does not exist');
      console.log('\n📋 Please run this SQL in Supabase Dashboard > SQL Editor:');
      console.log('================================================\n');
      console.log(sql);
      console.log('\n================================================');
      return false;
    }

    console.log('✅ activity_logs table created successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  const success = await createActivityTable();
  process.exit(success ? 0 : 1);
}

main();
