import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OWNER_EMAIL = process.env.MANAGER_OWNER_EMAIL || 'test@example.com';
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@restaurant.com';
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'Manager123@456';
const MANAGER_NAME = process.env.MANAGER_NAME || 'Floor Manager';
const MANAGER_PHONE = process.env.MANAGER_PHONE || '9876543211';

const main = async () => {
  const [{ default: supabase, getSupabaseAdmin }] = await Promise.all([
    import('../src/config/supabase.js'),
  ]);

  console.log('=== Manager Account Seeder ===');
  console.log(`Owner account: ${OWNER_EMAIL}`);
  console.log(`Manager account: ${MANAGER_EMAIL}`);

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, email')
    .eq('email', OWNER_EMAIL.toLowerCase())
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  if (!restaurant) {
    throw new Error(`No restaurant found for ${OWNER_EMAIL}`);
  }

  // 🔧 FIXED: Use Supabase Auth to manage passwords, not database
  const adminClient = getSupabaseAdmin();
  
  // Check if user already exists in auth
  const { data: existingAuthUser } = await adminClient.auth.admin.listUsers();
  const authUserExists = existingAuthUser?.users?.some(
    u => u.email?.toLowerCase() === MANAGER_EMAIL.toLowerCase()
  );

  let authUserId;
  if (authUserExists) {
    // Update existing auth user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      existingAuthUser.users.find(u => u.email?.toLowerCase() === MANAGER_EMAIL.toLowerCase()).id,
      { password: MANAGER_PASSWORD, email_confirm: true }
    );
    if (updateError) throw updateError;
    authUserId = existingAuthUser.users.find(u => u.email?.toLowerCase() === MANAGER_EMAIL.toLowerCase()).id;
  } else {
    // Create new auth user
    const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email: MANAGER_EMAIL.toLowerCase(),
      password: MANAGER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: MANAGER_NAME,
        role: 'manager',
      },
    });
    if (authError) throw authError;
    authUserId = newAuthUser.user.id;
  }

  // Sync to database (NO password stored)
  const payload = {
    id: authUserId,
    restaurant_id: restaurant.id,
    name: MANAGER_NAME,
    email: MANAGER_EMAIL.toLowerCase(),
    phone: MANAGER_PHONE,
    role: 'manager',
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('email', MANAGER_EMAIL.toLowerCase())
    .maybeSingle();

  if (existingUserError) {
    throw existingUserError;
  }

  if (existingUser) {
    const { error: updateError } = await supabase
      .from('users')
      .update(payload)
      .eq('id', existingUser.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Updated existing manager account for ${restaurant.name}.`);
  } else {
    const { error: insertError } = await supabase
      .from('users')
      .insert([payload]);

    if (insertError) {
      throw insertError;
    }

    console.log(`Created manager account for ${restaurant.name}.`);
  }

  console.log('\nManager credentials');
  console.log(`Email: ${MANAGER_EMAIL.toLowerCase()}`);
  console.log(`Password: ${MANAGER_PASSWORD}`);
};

main().catch((error) => {
  console.error('\nManager seeding failed.');
  console.error(error);
  process.exit(1);
});
