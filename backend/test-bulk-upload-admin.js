#!/usr/bin/env node
/**
 * 🧪 BULK UPLOAD TEST - Royal Restaurant Admin
 * 
 * Tests bulk menu upload using admin credentials for Royal Restaurant
 * Email: testexample@gmail.com
 * 
 * Features:
 * - Login with admin credentials
 * - Verify admin/owner role
 * - Upload test menu files
 * - Show detailed error messages if anything fails
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

// Admin credentials - Using available test account
const ADMIN_EMAIL = 'test@example.com';
const ADMIN_PASSWORD = 'Test123@456';  // Standard test password

// Test CSV files
const TEST_FILES = [
  {
    name: 'Fresh Menu Items for Royal Restaurant',
    file: './test-menu-new-batch.csv',
    description: '10 fresh menu items with unique timestamps to prevent duplicates'
  },
];

let authToken = null;
let restaurantId = null;
let userRole = null;

async function login() {
  console.log('\n📝 STEP 1: LOGIN WITH ADMIN CREDENTIALS');
  console.log('═'.repeat(70));

  try {
    console.log(`🔐 Attempting login with: ${ADMIN_EMAIL}`);
    console.log(`🏪 Expected: Royal Restaurant (Admin/Owner role)`);
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        portal: 'admin'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Login failed');
      console.error(`Status: ${response.status}`);
      console.error(`Response:`, JSON.stringify(data, null, 2));
      throw new Error(`Login failed: ${data.message || response.statusText}`);
    }

    authToken = data.data?.accessToken;
    restaurantId = data.data?.user?.restaurantId;
    userRole = data.data?.user?.role;

    if (!authToken || !restaurantId) {
      throw new Error('Missing token or restaurantId in login response');
    }

    console.log('\n✅ LOGIN SUCCESSFUL');
    console.log('─'.repeat(70));
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🏪 Restaurant ID: ${restaurantId}`);
    console.log(`👤 User Role: ${userRole} ${userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'owner' ? '✅ (Admin)' : '⚠️ (Not Admin)'}`);
    console.log(`🔑 Token: ${authToken.substring(0, 40)}...[REDACTED]`);
    
    // Check if user is admin
    if (!['admin', 'owner'].includes((userRole || '').toLowerCase())) {
      console.warn(`\n⚠️  WARNING: User role is "${userRole}", expected "admin" or "owner"`);
      console.warn('Bulk upload may fail due to insufficient permissions');
    }

    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function testBulkUpload(testCase) {
  console.log(`\n🧪 TESTING: ${testCase.name}`);
  console.log('─'.repeat(70));
  console.log(`📋 ${testCase.description}`);

  try {
    // Find the CSV file
    const filePath = path.join(process.cwd(), testCase.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return false;
    }

    console.log(`📂 Reading file: ${path.basename(filePath)}`);
    const fileStats = fs.statSync(filePath);
    console.log(`📏 File size: ${fileStats.size} bytes`);
    
    // Create FormData
    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, path.basename(filePath));

    // Make request
    console.log(`📤 Sending bulk upload request...`);
    console.log(`🎯 Endpoint: POST ${API_BASE_URL}/menu/bulk-upload`);
    
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
      console.error(`\n❌ UPLOAD FAILED: ${response.status}`);
      console.error('─'.repeat(70));
      
      const errMsg = responseData.message || responseData.error || 'Unknown error';
      console.error(`Error Message: ${errMsg}`);
      
      if (responseData.errors) {
        console.error(`\nError Details:`, JSON.stringify(responseData.errors, null, 2));
      }
      
      if (responseData.data) {
        console.error(`\nResponse Data:`, JSON.stringify(responseData.data, null, 2));
      }
      
      // Special handling for common errors
      if (response.status === 403) {
        console.error('\n⚠️  PERMISSION DENIED - Possible causes:');
        console.error('  1. User is not an admin/owner');
        console.error('  2. User role is "manager" instead of "admin"');
        console.error('  3. Token has expired');
      }
      
      if (response.status === 400) {
        console.error('\n⚠️  BAD REQUEST - Possible causes:');
        console.error('  1. File is empty or invalid format');
        console.error('  2. CSV has no data rows');
        console.error('  3. Headers cannot be detected');
      }
      
      if (response.status === 500) {
        console.error('\n⚠️  SERVER ERROR - Check backend logs');
        console.error('Backend error:', responseData.message);
      }

      return false;
    }

    // Display results
    console.log('\n✅ UPLOAD SUCCESSFUL');
    console.log('─'.repeat(70));
    
    if (responseData.data) {
      const { created, updated, total, errors } = responseData.data;
      
      console.log('📊 Results:');
      console.log(`   ✅ Created: ${created}`);
      console.log(`   🔄 Updated: ${updated}`);
      console.log(`   📈 Total: ${total}`);
      console.log(`   ⚠️  Errors: ${errors?.length || 0}`);
      
      if (errors && errors.length > 0) {
        console.log('\n   Error Details:');
        errors.slice(0, 5).forEach((err, idx) => {
          console.log(`   [${idx + 1}] Row ${err.row}: ${err.reason}`);
        });
        if (errors.length > 5) {
          console.log(`   ... and ${errors.length - 5} more errors`);
        }
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

async function getRestaurantInfo() {
  console.log(`\n📊 STEP 3: GET RESTAURANT INFO`);
  console.log('═'.repeat(70));

  try {
    const response = await fetch(`${API_BASE_URL}/restaurants/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      console.log('⚠️  Could not fetch restaurant info');
      return;
    }

    const data = await response.json();
    const restaurant = data.data || data;

    console.log(`🏪 Restaurant Profile:`);
    console.log(`   Name: ${restaurant.name || 'N/A'}`);
    console.log(`   Email: ${restaurant.email || 'N/A'}`);
    console.log(`   Phone: ${restaurant.phone || 'N/A'}`);
    console.log(`   City: ${restaurant.city || 'N/A'}`);
    console.log(`   Status: ${restaurant.status || 'N/A'}`);
  } catch (error) {
    console.error(`⚠️  Error fetching restaurant info:`, error.message);
  }
}

async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' '.repeat(15) + '🧪 BULK MENU UPLOAD TEST - ROYAL RESTAURANT' + ' '.repeat(11) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  console.log(`\n🌐 API Base URL: ${API_BASE_URL}`);
  console.log(`⏰ Test Started: ${new Date().toISOString()}`);

  // Step 1: Login
  if (!await login()) {
    console.error('\n❌ Could not login. Aborting tests.');
    process.exit(1);
  }

  // Step 2: Get restaurant info
  await getRestaurantInfo();

  // Step 3: Test uploads
  console.log('\n\n2️⃣ STEP 2: BULK UPLOAD TESTS');
  console.log('═'.repeat(70));

  const results = [];
  for (const testCase of TEST_FILES) {
    const success = await testBulkUpload(testCase);
    results.push({ name: testCase.name, success });
    
    // Wait between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n📋 TEST SUMMARY');
  console.log('═'.repeat(70));
  
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
