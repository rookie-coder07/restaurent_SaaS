#!/usr/bin/env node
/**
 * Debug Manager Portal - Why is everything showing 0?
 * 
 * This script helps identify why manager pages show 0 for all data:
 * - Checks if manager account exists  
 * - Verifies manager has a valid restaurant_id
 * - Checks if there's any actual data in their restaurant
 * - Tests database connectivity
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
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function debugManagerPortal(managerEmail) {
  console.log(`\n📊 MANAGER PORTAL DEBUG REPORT`);
  console.log(`========================================\n`);
  console.log(`Manager Email: ${managerEmail}\n`);

  try {
    // Step 1: Find manager user
    console.log(`\n[1/5] 🔍 Finding manager account...\n`);
    const { data: manager, error: findError } = await supabase
      .from('users')
      .select('id, email, role, restaurant_id, status, created_at, name')
      .eq('email', managerEmail.toLowerCase())
      .maybeSingle();

    if (findError) {
      console.error(`     ❌ Database error: ${findError.message}`);
      return;
    }

    if (!manager) {
      console.log(`     ❌ Manager account not found!`);
      console.log(`\n     Possible reasons:`);
      console.log(`     • Email is incorrect or typo`);
      console.log(`     • Manager account hasn't been created yet`);
      console.log(`     • Account was deleted\n`);
      return;
    }

    console.log(`     ✅ Manager found:`);
    console.log(`        ID: ${manager.id}`);
    console.log(`        Name: ${manager.name}`);
    console.log(`        Role: ${manager.role}`);
    console.log(`        Status: ${manager.status}`);
    console.log(`        Restaurant ID: ${manager.restaurant_id || '❌ NULL'}`);
    console.log(`        Created: ${manager.created_at}\n`);

    // Step 2: Check restaurant
    if (!manager.restaurant_id) {
      console.log(`\n[2/5] ❌ CRITICAL: Manager has NO restaurant_id!`);
      console.log(`     This is why all data shows 0.`);
      console.log(`     Fix: Run: node fix-manager-restaurant-id.js\n`);
      return;
    }

    console.log(`\n[2/5] 🏪 Finding restaurant...\n`);
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, email, status, created_at, subscription_tier')
      .eq('id', manager.restaurant_id);

    if (restaurantError || !restaurant || restaurant.length === 0) {
      console.error(`     ❌ Restaurant not found!`);
      console.log(`        Restaurant ID: ${manager.restaurant_id}`);
      console.log(`        The restaurant_id doesn't exist in restaurants table!\n`);
      return;
    }

    const rest = restaurant[0];
    console.log(`     ✅ Restaurant found:`);
    console.log(`        Name: ${rest.name}`);
    console.log(`        Email: ${rest.email}`);
    console.log(`        Status: ${rest.status}`);
    console.log(`        Tier: ${rest.subscription_tier}`);
    console.log(`        Created: ${rest.created_at}\n`);

    //Step 3: Check data in restaurant
    console.log(`\n[3/5] 📦 Checking data in restaurant...\n`);

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', manager.restaurant_id);

    const { count: tableCount } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', manager.restaurant_id);

    const { count: staffCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', manager.restaurant_id)
      .in('role', ['staff', 'kitchen_staff', 'waiter']);

    const { count: menuCount } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', manager.restaurant_id);

    console.log(`     Orders:  ${orderCount || 0} ${orderCount === 0 ? '❌' : '✅'}`);
    console.log(`     Tables:  ${tableCount || 0} ${tableCount === 0 ? '❌' : '✅'}`);
    console.log(`     Staff:   ${staffCount || 0} ${staffCount === 0 ? '❌' : '✅'}`);
    console.log(`     Menu:    ${menuCount || 0} ${menuCount === 0 ? '❌' : '✅'}  \n`);

    if (orderCount === 0 && tableCount === 0 && staffCount === 0 && menuCount === 0) {
      console.log(`     ⚠️ WARNING: Restaurant is completely empty!`);
      console.log(`     This might be normal for a new restaurant.\n`);
    }

    // Step 4: Get actual orders
    if (orderCount > 0) {
      console.log(`\n[4/5] 📋 Sample Orders:\n`);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, display_order_number, status, created_at')
        .eq('restaurant_id', manager.restaurant_id)
        .limit(3);

      if (orders && orders.length > 0) {
        orders.forEach(o => {
          console.log(`     • Order ${o.display_order_number} (${o.status})`);
          console.log(`       ID: ${o.id}`);
          console.log(`       Created: ${new Date(o.created_at).toLocaleDateString()}\n`);
        });
      }
    }

    // Step 5: Recommendations
    console.log(`\n[5/5] 🎯 Summary:\n`);

    if (manager.status !== 'active') {
      console.log(`     ⚠️  Manager account is INACTIVE`);
      console.log(`     Fix: Activate the account in the database\n`);
    }

    if (orderCount === 0 && tableCount === 0) {
      console.log(`     ℹ️  Restaurant has NO orders and NO tables`);
      console.log(`     Action: Create some tables and orders to test\n`);
    }

    console.log(`   ========================================`);
    console.log(`   Manager Setup: ${manager.status === 'active' && manager.restaurant_id ? '✅ OK' : '❌ NEEDS FIX'}`);
    console.log(`   Data Status:   ${(orderCount + tableCount + staffCount + menuCount) > 0 ? '✅ HAS DATA' : '⚠️  EMPTY'}`);
    console.log(`   ========================================\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

async function main() {
  const managerEmail = process.argv[2];
  
  if (!managerEmail) {
    console.log(`\n🔍 Manager Portal Debugger\n`);
    console.log(`Usage: node debug-manager.js <manager-email>\n`);
    console.log(`Example: node debug-manager.js manager@restaurant.com\n`);
    process.exit(1);
  }

  await debugManagerPortal(managerEmail);
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
