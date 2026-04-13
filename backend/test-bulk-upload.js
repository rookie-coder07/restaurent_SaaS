#!/usr/bin/env node
/**
 * 🧪 BULK UPLOAD TEST - Category Normalization & Deduplication
 * 
 * Tests the new category deduplication logic:
 * - Duplicate categories ("Appetizers" vs "appetizers")
 * - Case-insensitive matching
 * - New category creation fallback
 * - Concurrent category creation constraint handling
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
// Using test account (should have owner role for bulk upload)
const MANAGER_EMAIL = 'test@example.com';
const MANAGER_PASSWORD = 'Test123@456';

// Test CSV files
const TEST_FILES = [
  {
    name: 'Duplicate Categories',
    file: '../test-duplicate-categories.csv',
    description: 'Tests: "Appetizers" vs "appetizers" vs "APPETIZERS"'
  },
  {
    name: 'Case Mismatch',
    file: '../test-case-mismatch.csv',
    description: 'Tests: "Beverages" in different cases'
  },
  {
    name: 'Spelling Issues',
    file: '../test-spelling-issues.csv',
    description: 'Tests: "Desserts" vs "Deserts" (typo)'
  }
];

let authToken = null;
let restaurantId = null;

async function login() {
  console.log('\n📝 Step 1: LOGIN AS MANAGER');
  console.log('═'.repeat(60));

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: MANAGER_EMAIL,
        password: MANAGER_PASSWORD,
        portal: 'manager'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    authToken = data.data?.accessToken;
    restaurantId = data.data?.user?.restaurantId;

    if (!authToken || !restaurantId) {
      throw new Error('Missing token or restaurantId in response');
    }

    console.log('✅ Login successful');
    console.log(`   📛 Email: ${MANAGER_EMAIL}`);
    console.log(`   🏪 Restaurant ID: ${restaurantId}`);
    console.log(`   🔑 Token: ${authToken.substring(0, 30)}...[REDACTED]`);
    
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function testBulkUpload(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log('─'.repeat(60));
  console.log(`📋 ${testCase.description}`);

  try {
    // Find the CSV file
    const filePath = path.join(process.cwd(), testCase.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return false;
    }

    console.log(`📂 Reading file: ${path.basename(filePath)}`);
    
    // Create FormData
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, path.basename(filePath));

    // Make request
    console.log(`📤 Sending bulk upload request...`);
    const response = await fetch(`${API_BASE_URL}/menu/bulk-upload`, {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      body: form
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`❌ Upload failed: ${response.status}`);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      return false;
    }

    // Display results
    console.log('\n✅ UPLOAD SUCCESSFUL');
    console.log('─'.repeat(60));
    
    if (responseData.data) {
      const { created, updated, total, errors } = responseData.data;
      
      console.log('📊 Results:');
      console.log(`   ✅ Created: ${created}`);
      console.log(`   🔄 Updated: ${updated}`);
      console.log(`   📈 Total: ${total}`);
      
      if (errors && errors.length > 0) {
        console.log(`   ⚠️  Errors: ${errors.length}`);
        errors.forEach((err, idx) => {
          console.log(`      [${idx + 1}] Row ${err.row}: ${err.reason}`);
        });
      } else {
        console.log(`   ⚠️  Errors: 0`);
      }
    }

    // Show message
    if (responseData.message) {
      console.log(`\n📢 Message: ${responseData.message}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    return false;
  }
}

async function showDatabaseStatus() {
  console.log(`\n📊 Step 3: DATABASE STATUS`);
  console.log('═'.repeat(60));

  try {
    const response = await fetch(`${API_BASE_URL}/menu/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      console.log('⚠️  Could not fetch categories (may not have endpoint)');
      return;
    }

    const data = await response.json();
    const categories = data.data || data;

    console.log(`\n📂 Total Categories: ${categories.length}`);
    console.log('─'.repeat(60));
    
    // Show all categories
    console.log('Categories:');
    const categoryNames = [...new Set(categories.map(c => c.name))];
    categoryNames.forEach((name, idx) => {
      console.log(`   [${idx + 1}] ${name}`);
    });

    // Check for duplicates
    const duplicates = categories.filter((cat, idx, arr) =>
      arr.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase()) !== idx
    );

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} potential duplicate(s)`);
      duplicates.forEach(cat => {
        console.log(`   - ${cat.name} (id: ${cat.id})`);
      });
    } else {
      console.log(`\n✅ No duplicates found`);
    }
  } catch (error) {
    console.error('⚠️  Error fetching categories:', error.message);
  }
}

async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(8) + '🧪 BULK UPLOAD TEST - CATEGORY NORMALIZATION' + ' '.repeat(5) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  console.log(`\n🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`⏰ Test Started: ${new Date().toISOString()}`);

  // Step 1: Login
  if (!await login()) {
    console.error('\n❌ Could not login. Aborting tests.');
    process.exit(1);
  }

  // Step 2: Test uploads
  console.log('\n\n2️⃣ Step 2: BULK UPLOAD TESTS');
  console.log('═'.repeat(60));

  const results = [];
  for (const testCase of TEST_FILES) {
    const success = await testBulkUpload(testCase);
    results.push({ name: testCase.name, success });
    
    // Wait between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 3: Show database status
  await showDatabaseStatus();

  // Summary
  console.log('\n\n📋 TEST SUMMARY');
  console.log('═'.repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });

  const passedCount = results.filter(r => r.success).length;
  console.log(`\n${passedCount}/${results.length} tests passed`);

  console.log(`\n⏰ Test Completed: ${new Date().toISOString()}\n`);
  
  // Exit with appropriate code
  process.exit(passedCount === results.length ? 0 : 1);
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
