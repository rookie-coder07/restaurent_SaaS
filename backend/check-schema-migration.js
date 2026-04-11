import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  try {
    console.log('Checking restaurants table schema...');
    
    // Attempt to insert with empty password_hash to test current constraint
    const testId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('restaurants')
      .insert([{
        id: testId,
        name: 'Schema Test',
        email: 'schema-test-' + Date.now() + '@test.local',
        password_hash: '',  // Try empty string
        phone: '1234567890'
      }]);

    if (insertError && insertError.message.includes('password_hash')) {
      console.log('❌ Schema check failed - password_hash constraint issue detected');
      console.log('Error:', insertError.message);
      console.log('\nMigration SQL needs to be applied manually via Supabase dashboard:');
      console.log(`
ALTER TABLE restaurants ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
UPDATE restaurants SET password_hash = '' WHERE password_hash IS NULL;
UPDATE users SET password_hash = '' WHERE password_hash IS NULL;
      `);
    } else if (insertError) {
      console.log('Insert error:', insertError.message);
    } else {
      console.log('✅ Schema allows empty password_hash - migration already applied or not needed');
      // Clean up test record
      await supabase
        .from('restaurants')
        .delete()
        .eq('id', testId)
        .catch(() => {}); // Ignore cleanup errors
    }
  } catch (error) {
    console.error('Migration check failed:', error.message);
    process.exit(1);
  }
}

runMigration();
