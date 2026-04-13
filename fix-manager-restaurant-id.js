#!/usr/bin/env node
import { createClient } from './backend/node_modules/@supabase/supabase-js/dist/main.mjs';
import dotenv from './backend/node_modules/dotenv/lib/main.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.resolve(__dirname, './backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function fixManagerRestaurantIds() {
  try {
    console.log('🔍 Finding managers with NULL restaurant_id...\n');

    // Get all managers with null restaurant_id
    const { data: managersWithoutRestaurant, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role, restaurant_id')
      .eq('role', 'manager')
      .is('restaurant_id', null);

    if (fetchError) throw fetchError;

    if (!managersWithoutRestaurant || managersWithoutRestaurant.length === 0) {
      console.log('✅ No managers with NULL restaurant_id found!');
      return;
    }

    console.log(`Found ${managersWithoutRestaurant.length} manager(s) with NULL restaurant_id:\n`);
    managersWithoutRestaurant.forEach(m => {
      console.log(`  - ID: ${m.id}`);
      console.log(`    Email: ${m.email}`);
      console.log(`    Role: ${m.role}\n`);
    });

    // Try to match managers to restaurants by email or assign to first restaurant
    const { data: allRestaurants } = await supabase
      .from('restaurants')
      .select('id, email, name')
      .limit(100);

    console.log(`\n📋 Available restaurants: ${allRestaurants?.length || 0}\n`);

    if (!allRestaurants || allRestaurants.length === 0) {
      console.warn('⚠️  No restaurants found. Cannot assign managers.');
      return;
    }

    // For each manager, try to find matching restaurant or use first one
    for (const manager of managersWithoutRestaurant) {
      let targetRestaurant = null;

      // Try to match by email domain
      if (manager.email) {
        targetRestaurant = allRestaurants.find(r => 
          r.email && r.email.toLowerCase() === manager.email.toLowerCase()
        );
      }

      // If no exact match, use first restaurant
      if (!targetRestaurant) {
        targetRestaurant = allRestaurants[0];
      }

      if (!targetRestaurant) {
        console.warn(`⚠️  Could not find restaurant for manager ${manager.email}`);
        continue;
      }

      console.log(`📝 Assigning manager ${manager.email} → Restaurant: ${targetRestaurant.name} (${targetRestaurant.id})`);

      const { error: updateError } = await supabase
        .from('users')
        .update({ restaurant_id: targetRestaurant.id })
        .eq('id', manager.id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated successfully\n`);
      }
    }

    console.log('\n========================================');
    console.log('✅ Manager restaurant_id fix complete!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Also check staff users
async function checkStaffRestaurantIds() {
  try {
    const { data: staffWithoutRestaurant } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', 'staff')
      .is('restaurant_id', null);

    if (staffWithoutRestaurant && staffWithoutRestaurant.length > 0) {
      console.log(`\n⚠️  Found ${staffWithoutRestaurant.length} staff member(s) with NULL restaurant_id`);
      console.log('   Consider running the same fix for staff members.');
    }
  } catch (error) {
    console.error('Error checking staff:', error.message);
  }
}

async function main() {
  console.log('🚀 Manager Restaurant ID Fixer\n');
  console.log('========================================\n');
  
  await fixManagerRestaurantIds();
  await checkStaffRestaurantIds();
}

main().catch(error => {
  console.error('\n❌ Script failed:', error.message);
  process.exit(1);
});
