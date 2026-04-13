#!/usr/bin/env node
/**
 * Fix managers with NULL restaurant_id
 * Managers showing 0 data: likely cause is missing restaurant_id
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function fixManagerRestaurantIds() {
  try {
    console.log('\n🔍 Finding managers with NULL restaurant_id...\n');

    // Get all managers with null restaurant_id
    const { data: managersWithoutRestaurant, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role, restaurant_id')
      .eq('role', 'manager')
      .is('restaurant_id', null);

    if (fetchError) throw fetchError;

    if (!managersWithoutRestaurant || managersWithoutRestaurant.length === 0) {
      console.log('✅ No managers with NULL restaurant_id found!\n');
      return;
    }

    console.log(`❌ Found ${managersWithoutRestaurant.length} manager(s) with NULL restaurant_id:\n`);
    managersWithoutRestaurant.forEach(m => {
      console.log(`  • ID: ${m.id}`);
      console.log(`    Email: ${m.email}`);
      console.log(`    Role: ${m.role}\n`);
    });

    // Get all restaurants
    const { data: allRestaurants } = await supabase
      .from('restaurants')
      .select('id, email, name')
      .limit(100);

    console.log(`\n📋 Available restaurants: ${allRestaurants?.length || 0}\n`);

    if (!allRestaurants || allRestaurants.length === 0) {
      console.warn('⚠️  No restaurants found. Cannot assign managers.\n');
      return;
    }

    // Assign each manager to a restaurant
    let fixed = 0;
    for (const manager of managersWithoutRestaurant) {
      let targetRestaurant = null;

      // Try to match by email
      if (manager.email) {
        targetRestaurant = allRestaurants.find(r => 
          r.email && r.email.toLowerCase() === manager.email.toLowerCase()
        );
      }

      // Fallback to first restaurant
      if (!targetRestaurant) {
        targetRestaurant = allRestaurants[0];
      }

      if (!targetRestaurant) {
        console.warn(`⚠️  Could not find restaurant for ${manager.email}`);
        continue;
      }

      console.log(`   🔗 ${manager.email} → ${targetRestaurant.name}`);

      const { error: updateError } = await supabase
        .from('users')
        .update({ restaurant_id: targetRestaurant.id })
        .eq('id', manager.id);

      if (updateError) {
        console.error(`       ❌ Error: ${updateError.message}`);
      } else {
        console.log(`       ✅ Fixed`);
        fixed++;
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Fixed ${fixed}/${managersWithoutRestaurant.length} managers!`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    process.exit(1);
  }
}

async function main() {
  console.log('\n🚀 Manager Restaurant ID Fixer');
  console.log('========================================\n');
  
  await fixManagerRestaurantIds();
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
