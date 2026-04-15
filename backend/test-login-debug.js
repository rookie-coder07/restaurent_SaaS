#!/usr/bin/env node
import 'dotenv/config';
import { getSupabase } from './src/config/supabase.js';
import AuthService from './src/services/authService.js';
import logger from './src/utils/logger.js';

const supabase = getSupabase();

async function testLogin() {
  console.log('\n=== LOGIN DEBUG TEST ===\n');

  // Test credentials
  const testEmail = 'test@example.com';
  const testPassword = 'Test@123456';

  // Step 1: Check if user exists in auth.users
  console.log('📍 STEP 1: Checking if user exists in Supabase Auth...');
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById('test-user-id').catch(() => ({ data: null, error: 'Not found' }));
    console.log('Auth users table check:', authError ? '❌ Error/Not found' : '✅ Found');
  } catch (err) {
    console.log('Auth check error:', err.message);
  }

  // Step 2: Check if user exists in users table
  console.log('\n📍 STEP 2: Checking if user exists in users table...');
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('email', testEmail)
    .maybeSingle();

  if (dbUser) {
    console.log('✅ Found user in database:', { id: dbUser.id, email: dbUser.email, role: dbUser.role, restaurant_id: dbUser.restaurant_id });
  } else {
    console.log('❌ User not found in database');
  }

  // Step 3: Check if user exists in restaurants table (as owner)
  console.log('\n📍 STEP 3: Checking restaurants table...');
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('email', testEmail)
    .maybeSingle();

  if (restaurants) {
    console.log('✅ Found restaurant:', { id: restaurants.id, name: restaurants.name, email: restaurants.email });
  } else {
    console.log('❌ No restaurant found');
  }

  // Step 4: Try login
  console.log('\n📍 STEP 4: Attempting login...');
  try {
    const result = await AuthService.login(testEmail, testPassword, 'admin');
    console.log('✅ LOGIN SUCCESS:', { userId: result.userId, role: result.role });
  } catch (error) {
    console.log('❌ LOGIN FAILED:', { message: error.message, code: error.code });
  }

  console.log('\n=== AVAILABLE USERS ===\n');
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, role, status, restaurant_id')
    .limit(10);

  if (allUsers && allUsers.length > 0) {
    console.log('Users in database:');
    allUsers.forEach(u => {
      console.log(`  - ${u.email} (${u.role}) - Status: ${u.status}`);
    });
  } else {
    console.log('No users found in database');
  }

  console.log('\n=== AVAILABLE RESTAURANTS ===\n');
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('id, name, email, status')
    .limit(10);

  if (allRestaurants && allRestaurants.length > 0) {
    console.log('Restaurants in database:');
    allRestaurants.forEach(r => {
      console.log(`  - ${r.email} (${r.name}) - Status: ${r.status}`);
    });
  } else {
    console.log('No restaurants found in database');
  }

  process.exit(0);
}

testLogin().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
