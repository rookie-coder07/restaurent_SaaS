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

async function createDeveloperAccount() {
  try {
    const developerPassword = 'DevSecure2024!@#';
    const developerEmail = 'developer@platform.com';

    // First, check if user exists
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('email', developerEmail)
      .single();

    if (existingUser) {
      console.log('✅ Developer account already exists:', developerEmail);
      return;
    }

    // Create auth user
    console.log('Creating Supabase auth user...');
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: developerEmail,
      password: developerPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Platform Developer',
        role: 'developer',
      },
    });

    if (authError) {
      console.error('❌ Failed to create auth user:', authError.message);
      // Check if user already exists
      if (authError.message.includes('already exists')) {
        console.log('User already exists in auth, proceeding to create DB record...');
      } else {
        throw authError;
      }
    } else {
      console.log('✅ Auth user created:', authData.user.id);
    }

    // Create database user record
    const userId = authData?.user?.id || 'developer-user-id-placeholder';
    console.log('Creating database user record...');
    const { data: dbUser, error: dbError } = await client
      .from('users')
      .insert([
        {
          id: userId,
          name: 'Platform Developer',
          email: developerEmail,
          role: 'developer',
          status: 'active',
          phone: '',
        },
      ])
      .select('*')
      .single();

    if (dbError) {
      console.error('❌ Failed to create database user:', dbError.message);
      throw dbError;
    }

    console.log('✅ Developer account created successfully!');
    console.log(`   Email: ${developerEmail}`);
    console.log(`   Password: ${developerPassword}`);
    console.log(`   User ID: ${dbUser.id}`);
  } catch (error) {
    console.error('❌ Error creating developer account:', error.message);
    process.exit(1);
  }
}

createDeveloperAccount();
