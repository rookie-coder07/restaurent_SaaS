import { createClient } from '@supabase/supabase-js';
import { normalizeRole, ROLES } from '../src/constants/index.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY; // must be service_role
const targetId = '1f086434-dd3b-46ec-b59f-7bd5abd29c8e';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function removeIfAdmin() {
  // 1) Check restaurant (owner/admin)
  const { data: restaurant, error: restErr } = await supabaseAdmin
    .from('restaurants')
    .select('id, email')
    .eq('id', targetId)
    .maybeSingle();
  if (restErr) throw restErr;

  if (restaurant) {
    await supabaseAdmin.from('restaurants').delete().eq('id', targetId);
    await supabaseAdmin.from('users').delete().eq('id', targetId);
    await supabaseAdmin.auth.admin.deleteUser(targetId);
    console.log(`Deleted admin/owner ${restaurant.email}`);
    return;
  }

  // 2) Check users table
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('id', targetId)
    .maybeSingle();
  if (userErr) throw userErr;

  if (!user) {
    console.log('User not found; nothing to do.');
    return;
  }

  const role = normalizeRole(user.role);

  if (role === ROLES.MANAGER) {
    console.log(`User ${user.email} is manager; not deleted.`);
    return;
  }

  if (role === ROLES.OWNER) {
    await supabaseAdmin.from('users').delete().eq('id', targetId);
    await supabaseAdmin.auth.admin.deleteUser(targetId);
    console.log(`Deleted admin ${user.email}`);
    return;
  }

  console.log(`User ${user.email} is role=${role}; not deleted.`);
}

removeIfAdmin().catch((e) => {
  console.error('Failure:', e.message);
  process.exit(1);
});
