import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    console.log('🚀 Running database migration: Add refresh_tokens table\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'backend/src/config/migrations/2026-04-10-add-refresh-tokens-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    const { error } = await supabase.rpc('query', { query: migrationSQL });

    if (error) {
      // If direct RPC doesn't work, try the REST approach
      console.log('📝 Note: Direct RPC failed, attempting alternative approach...');
      console.log('⚠️ Migration SQL file prepared. Please run it manually in Supabase dashboard:');
      console.log('\n' + '='.repeat(60));
      console.log('📋 MIGRATION SQL:');
      console.log('='.repeat(60) + '\n');
      console.log(migrationSQL);
      console.log('\n' + '='.repeat(60));
      console.log('📍 Location: ' + migrationPath);
      return;
    }

    console.log('✅ Migration executed successfully!\n');
    console.log('📊 Changes applied:');
    console.log('  ✓ Created refresh_tokens table');
    console.log('  ✓ Added 5 performance indexes');
    console.log('  ✓ Configured RLS policies');
    console.log('  ✓ Created cleanup function');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.log('\n📝 To run the migration manually:');
    console.log('1. Go to Supabase dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Paste the SQL from: backend/src/config/migrations/2026-04-10-add-refresh-tokens-table.sql');
    console.log('4. Click Execute');
  }
}

runMigration();
