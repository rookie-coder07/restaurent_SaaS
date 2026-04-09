import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pzjjuuqwpbfbfosgblzv.supabase.co',
  'sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn'
);

(async () => {
  try {
    // Find posbilling user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', '%posbilling%')
      .single();
    
    if (userError || !user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ Found user:', user.email);
    
    // Find pending password reset requests
    const { data: requests, error: fetchError } = await supabase
      .from('password_reset_requests')
      .select('id, status, requested_at')
      .eq('user_id', user.id);
    
    if (fetchError) throw fetchError;
    
    if (!requests || requests.length === 0) {
      console.log('ℹ️  No password reset requests found for this user');
      process.exit(0);
    }
    
    console.log('Found requests:', requests.length);
    requests.forEach(r => console.log('  -', r.id, 'status:', r.status, 'date:', r.requested_at));
    
    // Delete all password reset requests for this user
    const { error: deleteError } = await supabase
      .from('password_reset_requests')
      .delete()
      .eq('user_id', user.id);
    
    if (deleteError) throw deleteError;
    
    console.log('✅ Deleted all password reset requests for', user.email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
