import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CATEGORIES = [
  { name: 'Appetizers', order: 1 },
  { name: 'Main Course', order: 2 },
  { name: 'Breads', order: 3 },
  { name: 'Rice & Biryani', order: 4 },
  { name: 'Desserts', order: 5 },
  { name: 'Beverages', order: 6 },
];

const MENU_ITEMS = [
  // Appetizers
  { categoryName: 'Appetizers', name: 'Samosa', price: 80, description: 'Crispy pastry filled with spiced potatoes and peas' },
  { categoryName: 'Appetizers', name: 'Paneer Tikka', price: 250, description: 'Cottage cheese marinated in yogurt and spices' },
  { categoryName: 'Appetizers', name: 'Chicken Wings', price: 220, description: 'Crispy chicken wings with special seasoning' },
  { categoryName: 'Appetizers', name: 'Manchurian', price: 180, description: 'Crispy fritters in tangy sauce' },
  
  // Main Course
  { categoryName: 'Main Course', name: 'Butter Chicken', price: 350, description: 'Tender chicken in creamy tomato sauce' },
  { categoryName: 'Main Course', name: 'Paneer Butter Masala', price: 320, description: 'Cottage cheese in rich creamy sauce' },
  { categoryName: 'Main Course', name: 'Dal Makhani', price: 280, description: 'Slow-cooked black lentils with cream' },
  { categoryName: 'Main Course', name: 'Palak Paneer', price: 300, description: 'Cottage cheese in spinach gravy' },
  { categoryName: 'Main Course', name: 'Chicken Tikka Masala', price: 380, description: 'Marinated chicken in tomato cream sauce' },
  { categoryName: 'Main Course', name: 'Lamb Rogan Josh', price: 420, description: 'Aromatic lamb curry with yogurt' },
  
  // Breads
  { categoryName: 'Breads', name: 'Naan', price: 60, description: 'Traditional Indian flatbread' },
  { categoryName: 'Breads', name: 'Butter Naan', price: 70, description: 'Naan brushed with butter' },
  { categoryName: 'Breads', name: 'Garlic Naan', price: 80, description: 'Naan with garlic and herbs' },
  { categoryName: 'Breads', name: 'Roti', price: 40, description: 'Whole wheat Indian bread' },
  { categoryName: 'Breads', name: 'Paratha', price: 90, description: 'Layered Indian flatbread' },
  
  // Rice & Biryani
  { categoryName: 'Rice & Biryani', name: 'Chicken Biryani', price: 380, description: 'Fragrant rice cooked with chicken' },
  { categoryName: 'Rice & Biryani', name: 'Mutton Biryani', price: 420, description: 'Fragrant rice cooked with mutton' },
  { categoryName: 'Rice & Biryani', name: 'Paneer Biryani', price: 340, description: 'Fragrant rice cooked with paneer' },
  { categoryName: 'Rice & Biryani', name: 'Vegetable Pulao', price: 260, description: 'Aromatic rice with seasonal vegetables' },
  { categoryName: 'Rice & Biryani', name: 'Egg Fried Rice', price: 200, description: 'Fluffy rice with scrambled eggs' },
  
  // Desserts
  { categoryName: 'Desserts', name: 'Gulab Jamun', price: 120, description: 'Soft cottage cheese balls in sugar syrup' },
  { categoryName: 'Desserts', name: 'Mango Kulfi', price: 100, description: 'Indian ice cream with mango flavor' },
  { categoryName: 'Desserts', name: 'Kheer', price: 110, description: 'Rice pudding with cardamom and nuts' },
  { categoryName: 'Desserts', name: 'Jalebi', price: 90, description: 'Crispy spirals soaked in sugar syrup' },
  
  // Beverages
  { categoryName: 'Beverages', name: 'Masala Tea', price: 50, description: 'Tea with aromatic spices' },
  { categoryName: 'Beverages', name: 'Filter Coffee', price: 60, description: 'South Indian coffee' },
  { categoryName: 'Beverages', name: 'Lassi', price: 70, description: 'Yogurt-based refreshing drink' },
  { categoryName: 'Beverages', name: 'Mango Shake', price: 120, description: 'Creamy shake made with fresh mangoes' },
  { categoryName: 'Beverages', name: 'Soft Drink', price: 50, description: 'Assorted soft drinks' },
];

const main = async () => {
  const [{ default: supabase }] = await Promise.all([
    import('../src/config/supabase.js'),
  ]);

  console.log('🚀 Starting Menu Items Seed Script\n');

  try {
    // Get restaurant ID (assuming first restaurant)
    console.log('📂 Getting restaurant...');
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);

    if (!restaurants || restaurants.length === 0) {
      throw new Error('No restaurant found');
    }

    const restaurantId = restaurants[0].id;
    console.log('✅ Found restaurant:', restaurantId);

    // Create categories
    console.log('\n📂 Creating categories...');
    const categories = {};

    for (const category of CATEGORIES) {
      // Check if exists
      const { data: existing } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('name', category.name)
        .maybeSingle();

      if (existing) {
        categories[category.name] = existing.id;
        console.log(`  ✓ Found category: ${category.name}`);
        continue;
      }

      // Create new
      const { data: newCategory, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId,
          name: category.name,
          display_order: category.order,
        })
        .select('id')
        .single();

      if (error) {
        console.log(`  ⚠️  Could not create category ${category.name}: ${error.message}`);
        continue;
      }

      categories[category.name] = newCategory.id;
      console.log(`  ✓ Created category: ${category.name}`);
    }

    // Create menu items
    console.log('\n🍽️  Creating menu items...');
    let created = 0;

    for (const item of MENU_ITEMS) {
      const categoryId = categories[item.categoryName];
      if (!categoryId) {
        console.log(`  ⚠️  Skipping ${item.name}: category not found`);
        continue;
      }

      const { error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          status: 'active',
        });

      if (error) {
        console.log(`  ⚠️  Could not create ${item.name}: ${error.message}`);
        continue;
      }

      console.log(`  ✓ ${item.name} - ₹${item.price}`);
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Created: ${created} items`);
    console.log(`  📦 Total categories: ${Object.keys(categories).length}`);
    console.log('\n🎉 Menu items loaded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
};

main();
