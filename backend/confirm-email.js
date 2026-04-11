// Manual email confirmation helper
import supabase from './src/config/supabase.js';

const email = 'test121557076@restaurant.com';

console.log(`⏳ Confirming email: ${email}`);

// Try to confirm via auth admin API
const { data, error } = await supabase.auth.admin.getUserById('any');

if (error) {
  console.log('Auth admin not available - trying direct update...');
  
  // Try direct query
  const { error: updateError } = await supabase
    .from('auth.users')
    .update({ email_confirmed_at: new Date().toISOString() })
    .eq('email', email);
  
  if (updateError) {
    console.log('❌ Update failed:', updateError.message);
  } else {
    console.log('✅ Email confirmed!');
  }
} else {
  console.log('Admin API available - using it...');
}
