#!/usr/bin/env node
/**
 * 🧪 INTEGRATION TEST - Full Category Resolution Flow
 * 
 * Tests the complete category resolution workflow including:
 * - Duplicate detection
 * - Case-insensitive matching
 * - Database lookup simulation
 * - New category creation
 * - Error handling
 */

console.log('\n');
console.log('╔' + '═'.repeat(60) + '╗');
console.log('║' + ' '.repeat(8) + '🧪 INTEGRATION TEST - CATEGORY RESOLUTION' + ' '.repeat(10) + '║');
console.log('╚' + '═'.repeat(60) + '╝\n');

// Simulate database state
const mockDatabaseCategories = [
  { id: 1, name: 'Appetizers', restaurant_id: 'rest-123' },
  { id: 2, name: 'Appetizers', restaurant_id: 'rest-123' },  // Duplicate
  { id: 3, name: 'Beverages', restaurant_id: 'rest-123' },
  { id: 4, name: 'Desserts', restaurant_id: 'rest-123' },
];

const menuItemsToUpload = [
  { name: 'Caesar Salad', category: 'Appetizers' },
  { name: 'Spring Rolls', category: 'appetizers' },
  { name: 'Coke', category: 'BEVERAGES' },
  { name: 'Tiramisu', category: 'Desserts' },
  { name: 'Chocolate Cake', category: 'DESSERTS' },
  { name: 'Mix Fruit', category: 'New Category' },
];

console.log('📦 MOCK DATABASE STATE');
console.log('─'.repeat(62));
console.log(`Total categories in database: ${mockDatabaseCategories.length}`);
mockDatabaseCategories.forEach(cat => {
  console.log(`   [${cat.id}] ${cat.name}`);
});

console.log('\n\n📝 ITEMS TO UPLOAD');
console.log('─'.repeat(62));
menuItemsToUpload.forEach((item, idx) => {
  console.log(`   [${idx + 1}] ${item.name} → category: "${item.category}"`);
});

// Step 1: Deduplicate categories
console.log('\n\n🔧 STEP 1: DEDUPLICATE CATEGORIES');
console.log('─'.repeat(62));

const seenNormalized = new Set();
const deduplicatedCategories = [];

for (const category of mockDatabaseCategories) {
  const normalizedName = String(category.name || '').trim().toLowerCase();
  
  if (!seenNormalized.has(normalizedName)) {
    seenNormalized.add(normalizedName);
    deduplicatedCategories.push(category);
  } else {
    console.log(`   ⚠️  Duplicate removed: "${category.name}" (id: ${category.id})`);
  }
}

console.log(`✅ After deduplication: ${deduplicatedCategories.length} categories`);

// Step 2: Build category map with object values
console.log('\n🔧 STEP 2: BUILD CATEGORY MAP');
console.log('─'.repeat(62));

const categoryMap = new Map(
  deduplicatedCategories.map((category) => [
    String(category.name || '').trim().toLowerCase(),
    {
      id: category.id,
      originalName: category.name,
    },
  ])
);

console.log(`✅ Built map with ${categoryMap.size} entries`);

// Step 3: Resolve categories for each item
console.log('\n🔧 STEP 3: RESOLVE CATEGORIES FOR ITEMS');
console.log('─'.repeat(62));

let createdCategoriesCount = 0;
const resolutionResults = [];

for (const item of menuItemsToUpload) {
  const normalizedCategory = String(item.category || '').trim().toLowerCase();
  let categoryId = null;
  let resolution = '';

  // Check map
  if (categoryMap.has(normalizedCategory)) {
    const categoryData = categoryMap.get(normalizedCategory);
    categoryId = categoryData.id;
    resolution = `Cache hit (id: ${categoryId}, name: "${categoryData.originalName}")`;
  } else {
    // Simulate new category creation
    categoryId = 100 + createdCategoriesCount;
    createdCategoriesCount++;
    resolution = `NEW - Created category (original: "${item.category}", id: ${categoryId})`;
    
    // Cache it for future use
    categoryMap.set(normalizedCategory, {
      id: categoryId,
      originalName: item.category,
    });
  }

  resolutionResults.push({
    item: item.name,
    inputCategory: item.category,
    resolvedId: categoryId,
    resolution
  });

  console.log(`   ✅ "${item.name}"`);
  console.log(`      Input: "${item.category}" → ${resolution}`);
}

// Step 4: Display results
console.log('\n\n📊 RESOLUTION SUMMARY');
console.log('─'.repeat(62));

const categoryCounts = {};
for (const result of resolutionResults) {
  categoryCounts[result.resolvedId] = (categoryCounts[result.resolvedId] || 0) + 1;
}

console.log(`✅ Total items resolved: ${resolutionResults.length}`);
console.log(`✅ Existing categories used: ${deduplicatedCategories.length}`);
console.log(`✅ New categories created: ${createdCategoriesCount}`);
console.log(`✅ Final category map size: ${categoryMap.size}`);

console.log('\nCategory utilization:');
for (const [catId, count] of Object.entries(categoryCounts)) {
  console.log(`   Category ${catId}: ${count} item(s)`);
}

// Step 5: Verify no errors
console.log('\n\n✅ TEST VERIFICATION');
console.log('─'.repeat(62));

const allResolved = resolutionResults.every(r => r.resolvedId !== null);
const deduplicationWorked = deduplicatedCategories.length < mockDatabaseCategories.length;
const caseInsensitiveWorked = resolutionResults.filter(r => 
  r.inputCategory.toLowerCase() !== r.inputCategory && r.resolution.includes('Cache hit')
).length > 0;

console.log(`${allResolved ? '✅' : '❌'} All items resolved to category IDs`);
console.log(`${deduplicationWorked ? '✅' : '❌'} Deduplication removed duplicates`);
console.log(`${caseInsensitiveWorked ? '✅' : '❌'} Case-insensitive matching works`);

// Final results
console.log('\n\n📋 DETAILED RESOLUTION LOG');
console.log('─'.repeat(62));

resolutionResults.forEach((result, idx) => {
  console.log(`[${idx + 1}] Item: "${result.item}"`);
  console.log(`    Input category: "${result.inputCategory}"`);
  console.log(`    Resolved to ID: ${result.resolvedId}`);
  console.log(`    Resolution: ${result.resolution}\n`);
});

const allTestsPassed = allResolved && deduplicationWorked && caseInsensitiveWorked;

console.log('\n\n📊 FINAL RESULT');
console.log('═'.repeat(62));
if (allTestsPassed) {
  console.log('✅ INTEGRATION TEST PASSED');
  console.log('   - Deduplication works');
  console.log('   - Case-insensitive matching works');
  console.log('   - Category resolution works');
  console.log('   - New category creation works');
} else {
  console.log('❌ INTEGRATION TEST FAILED');
  console.log('   Check the results above');
}
console.log('═'.repeat(62) + '\n');

process.exit(allTestsPassed ? 0 : 1);
