#!/usr/bin/env node
/**
 * Fix Orphaned Restaurant IDs
 * 
 * Problem: Managers have restaurant_ids that don't exist in the restaurants table
 * Result: All API queries return 0 because they filter by non-existent restaurant_id
 * 
 * Solution: Reassign managers to existing restaurants
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function fixOrphanedRestaurantIds() {
  try {
    console.log('\n🔍 Searching for orphaned restaurant IDs...\n');

    // Get all managers and staff
    const { data: users } = await supabase
      .from('users')
      .select('id, email, role, restaurant_id')
      .in('role', ['manager', 'staff', 'kitchen_staff', 'waiter', 'admin']);

    if (!users || users.length === 0) {
      console.log('No users found');
      return;
    }

    // Get all valid restaurant IDs
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id');

    const validRestaurantIds = new Set(restaurants?.map(r => r.id) || []);

    // Find orphaned users (those with restaurant_id that doesn't exist)
    const orphaned = users.filter(u => u.restaurant_id && !validRestaurantIds.has(u.restaurant_id));

    if (orphaned.length === 0) {
      console.log('✅ No orphaned restaurant IDs found!\n');
      return;
    }

    console.log(`❌ Found ${orphaned.length} orphaned user(s):\n`);
    orphaned.forEach(u => {
      console.log(`  • ${u.email} (${u.role})`);
      console.log(`    Invalid restaurant_id: ${u.restaurant_id}\n`);
    });

    if (validRestaurantIds.size === 0) {
      console.error('\n❌ No valid restaurants to assign to!');
      process.exit(1);
    }

    console.log(`\n📋 Available restaurants: ${validRestaurantIds.size}\n`);

    // Assign each orphaned user to the first restaurant
    const targetRestaurantId = restaurants[0].id;
    let fixed = 0;

    for (const user of orphaned) {
      const { error } = await supabase
        .from('users')
        .update({ restaurant_id: targetRestaurantId })
        .eq('id', user.id);

      if (error) {
        console.log(`   ❌ ${user.email} - Failed: ${error.message}`);
      } else {
        console.log(`   ✅ ${user.email} → Reassigned`);
        fixed++;
      }
    }

    console.log(`\n✅ Fixed ${fixed}/${orphaned.length} orphaned user(s)!\n`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

async function main() {
  console.log('\n🚀 Orphaned Restaurant ID Fixer');
  console.log('========================================\n');
  
  await fixOrphanedRestaurantIds();
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
