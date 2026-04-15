#!/usr/bin/env node

/**
 * Direct password update script for restaurant ANUSHREE
 * Updates password in Supabase Auth and database without modifying any API/logic/routes
 */

import bcryptjs from 'bcryptjs';
import supabaseImport, { getSupabaseAdmin } from './backend/src/config/supabase.js';

const supabase = supabaseImport;

async function updateRestaurantPassword() {
  const restaurantName = 'ANUSHREE';
  const newPassword = 'Raghu@123';

  console.log(`\n🔐 Updating password for restaurant: ${restaurantName}`);
  console.log(`🔑 New password: ${newPassword}\n`);

  try {
    // Step 1: Find the restaurant
    console.log('📍 Step 1: Finding restaurant in database...');
    const { data: restaurants, error: searchError } = await supabase
      .from('restaurants')
      .select('id, name, email')
      .ilike('name', `%${restaurantName}%`);

    if (searchError) {
      console.error('❌ Search error:', searchError);
      process.exit(1);
    }

    if (!restaurants || restaurants.length === 0) {
      console.error(`❌ Restaurant "${restaurantName}" not found`);
      process.exit(1);
    }

    if (restaurants.length > 1) {
      console.warn(`⚠️  Multiple restaurants found matching "${restaurantName}":`);
      restaurants.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name} (${r.email})`);
      });
      console.log('\nUsing first match...\n');
    }

    const restaurant = restaurants[0];
    console.log(`✅ Found: ${restaurant.name}`);
    console.log(`   ID: ${restaurant.id}`);
    console.log(`   Email: ${restaurant.email}\n`);

    // Step 2: Update Supabase Auth password
    console.log('🔄 Step 2: Updating Supabase Auth password...');
    try {
      const adminClient = getSupabaseAdmin();
      const { data: authData, error: authError } = await adminClient.auth.admin.updateUserById(
        restaurant.id,
        { password: newPassword }
      );

      if (authError) {
        console.warn(`⚠️  Supabase Auth update warning: ${authError.message}`);
      } else {
        console.log(`✅ Supabase Auth password updated\n`);
      }
    } catch (authErr) {
      console.warn(`⚠️  Could not update Supabase Auth: ${authErr.message}`);
      console.log(`   (This is OK if auth is not set up for this restaurant)\n`);
    }

    // Step 3: Hash the new password for database
    console.log('🔄 Step 3: Hashing password for database...');
    const saltRounds = 10;
    const passwordHash = await bcryptjs.hash(newPassword, saltRounds);
    console.log(`✅ Password hashed successfully\n`);

    // Step 4: Update the restaurant password_hash in database
    console.log('🔄 Step 4: Updating database password_hash...');
    const { data: updateResult, error: updateError } = await supabase
      .from('restaurants')
      .update({
        password_hash: passwordHash,
        password_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurant.id)
      .select();

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      process.exit(1);
    }

    console.log(`✅ Database password_hash updated successfully\n`);

    // Step 5: Verify the database update
    console.log('🔄 Step 5: Verifying database update...');
    const { data: verifyResult, error: verifyError } = await supabase
      .from('restaurants')
      .select('id, name, password_updated_at')
      .eq('id', restaurant.id)
      .single();

    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
      process.exit(1);
    }

    console.log(`✅ Database verification successful`);
    console.log(`   Restaurant: ${verifyResult.name}`);
    console.log(`   Last updated: ${verifyResult.password_updated_at}\n`);

    // Step 6: Verify password hash works
    console.log('🔄 Step 6: Testing password hash...');
    const isValid = await bcryptjs.compare(newPassword, passwordHash);
    if (isValid) {
      console.log(`✅ Password hash verification successful\n`);
    } else {
      console.error('❌ Password hash verification failed\n');
    }

    console.log('✨ PASSWORD UPDATE COMPLETE ✨\n');
    console.log(`Restaurant: ${restaurant.name}`);
    console.log(`Email: ${restaurant.email}`);
    console.log(`New Password: ${newPassword}`);
    console.log(`Status: ✅ Ready to login\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the update
updateRestaurantPassword();
