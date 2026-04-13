import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OWNER_EMAIL = process.env.POS_OWNER_EMAIL || 'test@example.com';
const POS_EMAIL = process.env.POS_STAFF_EMAIL || 'posbilling@gmail.com';
const POS_PASSWORD = process.env.POS_STAFF_PASSWORD || 'staff123';
const POS_NAME = process.env.POS_STAFF_NAME || 'POS Billing Waiter';
const POS_PHONE = process.env.POS_STAFF_PHONE || '9876543212';

const main = async () => {
  const [{ default: supabase, getSupabaseAdmin }] = await Promise.all([
    import('../src/config/supabase.js'),
  ]);

  console.log('=== POS Staff Account Seeder ===');
  console.log(`Owner account: ${OWNER_EMAIL}`);
  console.log(`POS account: ${POS_EMAIL}`);

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
    u => u.email?.toLowerCase() === POS_EMAIL.toLowerCase()
  );

  let authUserId;
  if (authUserExists) {
    // Update existing auth user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      existingAuthUser.users.find(u => u.email?.toLowerCase() === POS_EMAIL.toLowerCase()).id,
      { password: POS_PASSWORD, email_confirm: true }
    );
    if (updateError) throw updateError;
    authUserId = existingAuthUser.users.find(u => u.email?.toLowerCase() === POS_EMAIL.toLowerCase()).id;
  } else {
    // Create new auth user
    const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email: POS_EMAIL.toLowerCase(),
      password: POS_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: POS_NAME,
        role: 'staff',
      },
    });
    if (authError) throw authError;
    authUserId = newAuthUser.user.id;
  }

  // Sync to database (NO password stored)
  const payload = {
    id: authUserId,
    restaurant_id: restaurant.id,
    name: POS_NAME,
    email: POS_EMAIL.toLowerCase(),
    phone: POS_PHONE,
    role: 'staff',
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('email', POS_EMAIL.toLowerCase())
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

    console.log(`Updated existing POS staff account for ${restaurant.name}.`);
  } else {
    const { error: insertError } = await supabase
      .from('users')
      .insert([payload]);

    if (insertError) {
      throw insertError;
    }

    console.log(`Created POS staff account for ${restaurant.name}.`);
  }

  console.log('\nPOS staff credentials');
  console.log(`Email: ${POS_EMAIL.toLowerCase()}`);
  console.log(`Password: ${POS_PASSWORD}`);
};

main().catch((error) => {
  console.error('\nPOS staff seeding failed.');
  console.error(error);
  process.exit(1);
});
