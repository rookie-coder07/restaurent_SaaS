#!/usr/bin/env node
/**
 * Seed Test Data for Manager Restaurant
 * 
 * Populates the manager's restaurant with test data:
 * - Tables
 * - Menu items
 * - Categories
 * - Sample orders
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seedTestData() {
  try {
    const restaurantId = '48baf815-73c4-4976-a5a2-ddb8d7ad02ff'; // Manager's restaurant
    
    console.log('\n🌱 Seeding Test Data for Manager Restaurant\n');
    console.log('========================================\n');

    // 1. Create tables
    console.log('[1/5] 📋 Creating tables...\n');
    const tables = [];
    for (let i = 1; i <= 5; i++) {
      const { data: table, error } = await supabase
        .from('tables')
        .insert({
          restaurant_id: restaurantId,
          table_number: i,
          capacity: 4 + Math.floor(Math.random() * 6),
          location: 'main',
          status: 'available'
        })
        .select()
        .single();

      if (error) {
        console.log(`   ⚠️  Table ${i} - ${error.message}`);
      } else {
        tables.push(table);
        console.log(`   ✅ Table ${i}`);
      }
    }

    // 2. Create menu categories
    console.log('\n[2/5] 📂 Creating menu categories...\n');
    const categories = [];
    const categoryNames = ['Appetizers', 'Main Course', 'Desserts', 'Beverages'];
    
    for (const name of categoryNames) {
      const { data: category, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId,
          name: name,
          description: `${name} section`,
          display_order: categoryNames.indexOf(name)
        })
        .select()
        .single();

      if (error) {
        console.log(`   ⚠️  ${name} - ${error.message}`);
      } else {
        categories.push(category);
        console.log(`   ✅ ${name}`);
      }
    }

    // 3. Create menu items
    console.log('\n[3/5] 🍽️  Creating menu items...\n');
    const items = [];
    const menuItems = [
      { categoryIndex: 0, name: 'Samosa', price: 50 },
      { categoryIndex: 0, name: 'Pakora', price: 60 },
      { categoryIndex: 1, name: 'Butter Chicken', price: 250 },
      { categoryIndex: 1, name: 'Biryani', price: 200 },
      { categoryIndex: 2, name: 'Gulab Jamun', price: 80 },
      { categoryIndex: 3, name: 'Mango Lassi', price: 70 },
    ];

    for (const item of menuItems) {
      const categoryId = categories[item.categoryIndex]?.id;
      if (!categoryId) continue;

      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name: item.name,
          description: `Delicious ${item.name}`,
          price: item.price,
          availability: 'available',
          type: 'food'
        })
        .select()
        .single();

      if (error) {
        console.log(`   ⚠️  ${item.name} - ${error.message}`);
      } else {
        items.push(menuItem);
        console.log(`   ✅ ${item.name} (₹${item.price})`);
      }
    }

    // 4. Create sample orders
    console.log('\n[4/5] 📦 Creating sample orders...\n');
    
    const statuses = ['pending', 'preparing', 'ready', 'served', 'completed'];
    for (let i = 0; i < 3; i++) {
      const table = tables[i % tables.length];
      if (!table) continue;

      const status = statuses[i % statuses.length];
      const amount = 150 + Math.random() * 350;

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          table_id: table.id,
          table_number: table.table_number,
          status: status,
          order_type: 'dine_in',
          total_amount: amount,
          final_amount: amount,
          created_at: new Date(Date.now() - i * 3600000).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.log(`   ⚠️  Order ${i + 1} - ${error.message}`);
      } else {
        console.log(`   ✅ Order for Table ${table.table_number} - ${status}`);

        // Add order items
        if (items.length > 0) {
          const menuItem = items[i % items.length];
          await supabase.from('order_items').insert({
            order_id: order.id,
            menu_item_id: menuItem.id,
            quantity: 1 + Math.floor(Math.random() * 3),
            unit_price: menuItem.price
          });
        }
      }
    }

    console.log('\n[5/5] ✨ Summary\n');
    console.log(`   Tables created: ${tables.length}`);
    console.log(`   Categories created: ${categories.length}`);
    console.log(`   Menu items created: ${items.length}`);
    
    console.log(`\n========================================`);
    console.log(`✅ Test data seeded successfully!`);
    console.log(`\n📊 Manager portal should now show:`);
    console.log(`   • ${tables.length} tables`);
    console.log(`   • 3 orders`);
    console.log(`   • ${items.length} menu items\n`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

seedTestData();
