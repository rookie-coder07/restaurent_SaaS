import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OWNER_EMAIL = process.env.POS_OWNER_EMAIL || 'test@example.com';
const POS_EMAIL = process.env.POS_STAFF_EMAIL || 'posbilling@gmail.com';
const POS_PASSWORD = process.env.POS_STAFF_PASSWORD || 'PosBilling123@456';
const POS_NAME = process.env.POS_STAFF_NAME || 'POS Billing Waiter';
const POS_PHONE = process.env.POS_STAFF_PHONE || '9876543212';

const main = async () => {
  const [{ default: supabase }, { default: AuthService }] = await Promise.all([
    import('../src/config/supabase.js'),
    import('../src/services/authService.js'),
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

  const passwordHash = await AuthService.hashPassword(POS_PASSWORD);
  const payload = {
    restaurant_id: restaurant.id,
    name: POS_NAME,
    email: POS_EMAIL.toLowerCase(),
    phone: POS_PHONE,
    role: 'staff',
    password_hash: passwordHash,
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
