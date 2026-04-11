import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const email = 'manager@restaurant.com';

async function removeAdmin() {
  // Delete profile rows first (idempotent)
  const { error: userDelErr } = await supabaseAdmin.from('users').delete().eq('email', email);
  if (userDelErr) throw userDelErr;

  const { error: restaurantDelErr } = await supabaseAdmin.from('restaurants').delete().eq('email', email);
  if (restaurantDelErr) throw restaurantDelErr;

  // Find auth user and delete
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ email });
  if (listErr) throw listErr;
  const authUser = list?.users?.[0];

  if (authUser?.id) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    if (delErr) throw delErr;
  }

  console.log(`Removed admin ${email}`);
}

removeAdmin().catch((e) => {
  console.error('Cleanup failed:', e.message);
  process.exit(1);
});
