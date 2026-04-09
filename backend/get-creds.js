import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pzjjuuqwpbfbfosgblzv.supabase.co',
  'sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn'
);

(async () => {
  const { data: users } = await supabase
    .from('users')
    .select('email, role, restaurant_id')
    .eq('restaurant_id', '515cfff9-6b46-49c1-b369-1d5650c95816')
    .order('role', { ascending: false });
  
  console.log('Manager and Admin users:');
  users.forEach(u => {
    if (u.role === 'manager' || u.role === 'admin') {
      console.log(`[${u.role.toUpperCase()}] ${u.email} - password: password123`);
    }
  });
})();
