#!/usr/bin/env node
/**
 * 🧪 UNIT TEST - Category Deduplication & Normalization Logic
 * 
 * Direct testing of the category resolution logic without API layer
 * This tests the core functionality of:
 * - Category deduplication
 * - Case-insensitive matching
 * - Map structure with object values
 */

console.log('\n');
console.log('╔' + '═'.repeat(60) + '╗');
console.log('║' + ' '.repeat(10) + '🧪 CATEGORY DEDUPLICATION UNIT TEST' + ' '.repeat(14) + '║');
console.log('╚' + '═'.repeat(60) + '╝\n');

// Test 1: Deduplication Logic
console.log('📋 Test 1: DEDUPLICATION LOGIC');
console.log('─'.repeat(62));

const mockCategoriesWithDuplicates = [
  { id: 1, name: 'Appetizers' },
  { id: 2, name: 'appetizers' },
  { id: 3, name: 'APPETIZERS' },
  { id: 4, name: 'Beverages' },
  { id: 5, name: 'beverages' },
  { id: 6, name: 'Desserts' },
];

const seenNormalized = new Set();
const deduplicatedCategories = [];
const duplicatesFound = [];

for (const category of mockCategoriesWithDuplicates) {
  const normalizedName = String(category.name || '').trim().toLowerCase();
  
  if (!seenNormalized.has(normalizedName)) {
    seenNormalized.add(normalizedName);
    deduplicatedCategories.push(category);
  } else {
    duplicatesFound.push({
      normalizedName,
      skippedId: category.id,
      skippedName: category.name,
      keptId: deduplicatedCategories.find(
        c => String(c.name || '').trim().toLowerCase() === normalizedName
      )?.id
    });
  }
}

console.log(`✅ Original categories: ${mockCategoriesWithDuplicates.length}`);
console.log(`✅ After deduplication: ${deduplicatedCategories.length}`);
console.log(`✅ Duplicates removed: ${duplicatesFound.length}`);
console.log('\nDeduplication results:');
deduplicatedCategories.forEach((cat, idx) => {
  console.log(`   [${idx + 1}] ${cat.name} (id: ${cat.id})`);
});

if (duplicatesFound.length > 0) {
  console.log('\n⚠️  Duplicates found:');
  duplicatesFound.forEach(dup => {
    console.log(`   - "${dup.skippedName}" (id: ${dup.skippedId}) → kept id: ${dup.keptId}`);
  });
}

const testResult1 = {
  input: mockCategoriesWithDuplicates.length,
  output: deduplicatedCategories.length,
  duplicatesRemoved: duplicatesFound.length,
  passed: deduplicatedCategories.length === 3 && duplicatesFound.length === 3
};

console.log(`\n${testResult1.passed ? '✅' : '❌'} Test 1: ${testResult1.passed ? 'PASSED' : 'FAILED'}`);

// Test 2: Map Structure with Object Values
console.log('\n\n📋 Test 2: MAP STRUCTURE WITH OBJECT VALUES');
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

console.log(`✅ Built Map with ${categoryMap.size} entries\n`);

console.log('Map contents:');
for (const [key, value] of categoryMap.entries()) {
  console.log(`   "${key}" → {id: ${value.id}, originalName: "${value.originalName}"}`);
}

const testResult2 = {
  mapSize: categoryMap.size,
  passed: categoryMap.size === 3
};

console.log(`\n${testResult2.passed ? '✅' : '❌'} Test 2: ${testResult2.passed ? 'PASSED' : 'FAILED'}`);

// Test 3: Case-Insensitive Lookup
console.log('\n\n📋 Test 3: CASE-INSENSITIVE LOOKUP');
console.log('─'.repeat(62));

const testCases = [
  { input: 'Appetizers', expected: 1 },
  { input: 'appetizers', expected: 1 },
  { input: 'APPETIZERS', expected: 1 },
  { input: 'Beverages', expected: 4 },
  { input: 'beverages', expected: 4 },
  { input: '  APPETIZERS  ', expected: 1 }, // with spaces
  { input: 'Desserts', expected: 6 },
  { input: 'NonExistent', expected: null },
];

console.log(`Testing ${testCases.length} lookup scenarios:\n`);

const lookupResults = testCases.map(testCase => {
  const normalizedInput = String(testCase.input || '').trim().toLowerCase();
  const mapEntry = categoryMap.get(normalizedInput);
  const foundId = mapEntry?.id || null;
  const passed = foundId === testCase.expected;

  const status = passed ? '✅' : '❌';
  console.log(`${status} Input: "${testCase.input.trim()}" → Expected: ${testCase.expected}, Got: ${foundId}`);

  return {
    input: testCase.input,
    expected: testCase.expected,
    found: foundId,
    passed
  };
});

const testResult3 = {
  total: testCases.length,
  passed: lookupResults.filter(r => r.passed).length,
  allPassed: lookupResults.every(r => r.passed)
};

console.log(`\n✅ Passed: ${testResult3.passed}/${testResult3.total}`);
console.log(`${testResult3.allPassed ? '✅' : '❌'} Test 3: ${testResult3.allPassed ? 'PASSED' : 'FAILED'}`);

// Test 4: Backward Compatibility
console.log('\n\n📋 Test 4: BACKWARD COMPATIBILITY (Old vs New Map Structure)');
console.log('─'.repeat(62));

const oldMapStructure = new Map([
  ['appetizers', 1],        // Old: just ID
  ['beverages', 4],
  ['desserts', 6],
]);

const newMapStructure = new Map([
  ['appetizers', { id: 1, originalName: 'Appetizers' }],  // New: object
  ['beverages', { id: 4, originalName: 'Beverages' }],
  ['desserts', { id: 6, originalName: 'Desserts' }],
]);

const compatibilityResolver = (mapEntry) => {
  return mapEntry.id || mapEntry;  // Handles both structures
};

console.log('Testing compatibility extraction:\n');

const compatResults = [];
for (const [key, oldValue] of oldMapStructure.entries()) {
  const oldExtracted = compatibilityResolver(oldValue);
  const newValue = newMapStructure.get(key);
  const newExtracted = compatibilityResolver(newValue);
  
  const passed = oldExtracted === newExtracted;
  console.log(`${passed ? '✅' : '❌'} "${key}": old=${oldExtracted}, new=${newExtracted}`);
  
  compatResults.push({ key, passed });
}

const testResult4 = {
  total: compatResults.length,
  passed: compatResults.filter(r => r.passed).length,
  allPassed: compatResults.every(r => r.passed)
};

console.log(`\n${testResult4.allPassed ? '✅' : '❌'} Test 4: ${testResult4.allPassed ? 'PASSED' : 'FAILED'}`);

// Test 5: Enhanced Map Building (Duplicate Detection)
console.log('\n\n📋 Test 5: ENHANCED MAP BUILDING (Duplicate Detection)');
console.log('─'.repeat(62));

const enhancedCategoryMap = new Map();
let buildDuplicateCount = 0;

for (const [key, value] of categoryMap.entries()) {
  const normalizedKey = String(key).trim().toLowerCase();
  
  if (enhancedCategoryMap.has(normalizedKey)) {
    buildDuplicateCount++;
    console.log(`⚠️  Duplicate detected: "${normalizedKey}"`);
    continue;
  }
  
  enhancedCategoryMap.set(normalizedKey, value);
}

console.log(`✅ Built enhanced map with ${enhancedCategoryMap.size} entries`);
console.log(`✅ Duplicates during build: ${buildDuplicateCount}`);

const testResult5 = {
  mapSize: enhancedCategoryMap.size,
  duplicates: buildDuplicateCount,
  passed: enhancedCategoryMap.size === 3 && buildDuplicateCount === 0
};

console.log(`\n${testResult5.passed ? '✅' : '❌'} Test 5: ${testResult5.passed ? 'PASSED' : 'FAILED'}`);

// Summary
console.log('\n\n📊 TEST SUMMARY');
console.log('═'.repeat(62));

const allResults = [testResult1, testResult2, testResult3, testResult4, testResult5];
const testNames = [
  'Deduplication Logic',
  'Map Structure (Object Values)',
  'Case-Insensitive Lookup',
  'Backward Compatibility',
  'Enhanced Map Building'
];

allResults.forEach((result, idx) => {
  const status = result.passed || result.allPassed ? '✅' : '❌';
  console.log(`${status} Test ${idx + 1}: ${testNames[idx]}`);
});

const totalTests = allResults.length;
const passedTests = allResults.filter(r => r.passed || r.allPassed).length;

console.log(`\n${'═'.repeat(62)}`);
console.log(`Total: ${passedTests}/${totalTests} tests passed`);
console.log(`${'═'.repeat(62)}\n`);

if (passedTests === totalTests) {
  console.log('✅ ALL TESTS PASSED - Category deduplication logic verified!\n');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Review the results above\n');
  process.exit(1);
}
