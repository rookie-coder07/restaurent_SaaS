#!/usr/bin/env node

/**
 * Simple password update script for ANUSHREE restaurant
 * Direct database update
 */

import bcryptjs from 'bcryptjs';

async function updatePassword() {
  const restaurantName = 'ANUSHREE';
  const newPassword = 'Raghu@123';

  console.log(`\n🔐 Update password for: ${restaurantName}`);
  console.log(`🔑 New password: ${newPassword}\n`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials not configured');
    console.error(`   SUPABASE_URL: ${supabaseUrl ? '✓ set' : '✗ missing'}`);
    console.error(`   SUPABASE_ANON_KEY: ${supabaseKey ? '✓ set' : '✗ missing'}`);
    process.exit(1);
  }

  try {
    // Hash the password
    console.log('🔄 Hashing password...');
    const passwordHash = await bcryptjs.hash(newPassword, 10);
    console.log('✅ Password hashed\n');

    // Fetch restaurants
    console.log('📍 Fetching restaurants...');
    const listRes = await fetch(`${supabaseUrl}/rest/v1/restaurants?select=id,name,email`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!listRes.ok) {
      console.error(`❌ Failed to fetch restaurants: ${listRes.status}`);
      const errText = await listRes.text();
      console.error(`   ${errText}`);
      process.exit(1);
    }

    const restaurants = await listRes.json();
    console.log(`✅ Found ${restaurants.length} restaurants\n`);

    if (restaurants.length === 0) {
      console.error('❌ No restaurants found');
      process.exit(1);
    }

    // List all restaurants
    console.log('Available restaurants:');
    restaurants.forEach(r => {
      console.log(`  - ${r.name} (ID: ${r.id})`);
    });
    console.log();

    // Find ANUSHREE
    const restaurant = restaurants.find(r => 
      r.name && r.name.toUpperCase() === restaurantName.toUpperCase()
    );

    if (!restaurant) {
      console.error(`❌ Restaurant "${restaurantName}" not found`);
      process.exit(1);
    }

    console.log(`✅ Found restaurant: ${restaurant.name}`);
    console.log(`   ID: ${restaurant.id}`);
    console.log(`   Email: ${restaurant.email}\n`);

    // Update password
    console.log('🔄 Updating password in database...');
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/restaurants?id=eq.${restaurant.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          password_hash: passwordHash,
          password_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!updateRes.ok) {
      console.error(`❌ Failed to update password: ${updateRes.status}`);
      const errText = await updateRes.text();
      console.error(`   ${errText}`);
      process.exit(1);
    }

    const updated = await updateRes.json();
    console.log('✅ Password updated successfully\n');

    // Verify
    console.log('🔄 Verifying update...');
    const verifyRes = await fetch(
      `${supabaseUrl}/rest/v1/restaurants?id=eq.${restaurant.id}&select=id,name,password_updated_at`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (verifyRes.ok) {
      const data = await verifyRes.json();
      if (data.length > 0) {
        console.log(`✅ Verified update:`);
        console.log(`   Restaurant: ${data[0].name}`);
        console.log(`   Updated: ${data[0].password_updated_at}\n`);
      }
    }

    console.log('✨ PASSWORD UPDATE COMPLETE ✨\n');
    console.log(`Restaurant: ${restaurant.name}`);
    console.log(`Email: ${restaurant.email}`);
    console.log(`New Password: ${newPassword}`);
    console.log(`Status: ✅ Ready to login\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

updatePassword();
