import 'dotenv/config';
import supabase, { getSupabaseAdmin } from '../src/config/supabase.js';

const PAGE_SIZE = 200;

async function getAllAuthUsers() {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await getSupabaseAdmin().auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    all.push(...(data?.users || []));
    if (!data || (data.users || []).length < PAGE_SIZE) break;
  }
  return all;
}

async function main() {
  console.log('Syncing auth.users to users table...');
  const authUsers = await getAllAuthUsers();

  // Pick a default restaurant for non-developer users if needed
  let defaultRestaurantId = null;
  const { data: restaurants } = await supabase.from('restaurants').select('id').limit(1);
  defaultRestaurantId = restaurants?.[0]?.id || null;

  for (const user of authUsers) {
    const { id, email } = user;
    const role = (user.user_metadata?.role || '').toLowerCase();

    const { data: existing, error: selError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (selError) {
      console.error('Select error', email, selError.message);
      continue;
    }

    if (!existing) {
      const restaurantId = role === 'developer' ? null : defaultRestaurantId;
      const { error: insError } = await supabase.from('users').insert([{
        id,
        email: email?.toLowerCase(),
        name: user.user_metadata?.name || email?.split('@')[0] || 'User',
        restaurant_id: restaurantId,
        role: role || 'staff',
        status: 'active',
      }]);
      if (insError) {
        console.error('Insert error', email, insError.message);
      } else {
        console.log('Inserted user', email);
      }
    }
  }
  console.log('Sync complete.');
}

main().catch((err) => {
  console.error('Sync failed', err);
  process.exit(1);
});
