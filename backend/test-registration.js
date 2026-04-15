#!/usr/bin/env node
import 'dotenv/config';
import { getSupabase } from './src/config/supabase.js';
import AuthService from './src/services/authService.js';
import logger from './src/utils/logger.js';

const supabase = getSupabase();

async function testRegistrationAndLogin() {
  console.log('\n=== REGISTRATION AND LOGIN TEST ===\n');

  const testEmail = 'testuser@demo.com';
  const testPassword = 'Demo@12345';
  const restaurantName = 'Demo Restaurant';

  // Step 1: Register restaurant
  console.log('📍 STEP 1: Registering restaurant...');
  try {
    // First create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: restaurantName,
        },
      },
    });

    if (authError) {
      console.log('❌ Auth registration failed:', authError.message);
      // If auth fails, we'll let database fallback handle it
    } else {
      console.log('✅ Auth registration successful:', { userId: authData.user?.id, email: authData.user?.email });
    }

    // Create restaurant in database
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .insert([{
        name: restaurantName,
        email: testEmail.toLowerCase(),
        status: 'active',
        password_hash: await AuthService.hashPassword(testPassword),
      }])
      .select()
      .single();

    if (restError) {
      console.log('❌ Restaurant creation failed:', restError.message);
      return;
    }

    console.log('✅ Restaurant created:', { id: restaurant.id, name: restaurant.name, email: restaurant.email });

    // Step 2: Try login
    console.log('\n📍 STEP 2: Testing login...');
    try {
      const result = await AuthService.login(testEmail, testPassword, 'admin');
      console.log('✅ LOGIN SUCCESS!', {
        userId: result.userId,
        role: result.role,
        restaurantId: result.restaurantId,
        accessToken: result.accessToken.substring(0, 20) + '...',
      });
    } catch (error) {
      console.log('❌ LOGIN FAILED:', error.message);
    }
  } catch (err) {
    console.error('Test error:', err.message);
  }

  process.exit(0);
}

testRegistrationAndLogin().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
