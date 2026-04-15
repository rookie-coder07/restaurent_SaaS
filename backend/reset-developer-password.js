import 'dotenv/config.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const developerPassword = 'DevSecure2024!@#';
const developerEmail = 'developer@platform.com';

async function resetDeveloperPassword() {
  try {
    // Find the developer user in auth
    console.log('Finding developer user in auth system...');
    const { data: { users }, error: findError } = await client.auth.admin.listUsers({
      perPage: 100,
    });

    if (findError) {
      console.error('❌ Failed to list users:', findError.message);
      throw findError;
    }

    const devAuthUser = users.find(u => u.email === developerEmail);
    if (!devAuthUser) {
      console.error('❌ Developer user not found in auth system');
      process.exit(1);
    }

    console.log('✅ Found developer auth user:', devAuthUser.id);

    // Reset password
    console.log('Resetting password...');
    const { data, error: resetError } = await client.auth.admin.updateUserById(devAuthUser.id, {
      password: developerPassword,
    });

    if (resetError) {
      console.error('❌ Failed to reset password:', resetError.message);
      throw resetError;
    }

    console.log('✅ Password reset successfully!');
    console.log(`   Email: ${developerEmail}`);
    console.log(`   New Password: ${developerPassword}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetDeveloperPassword();
