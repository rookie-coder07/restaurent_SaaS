#!/usr/bin/env node

/**
 * Bulk Upload Debugging Script
 * Tests authentication, file upload, and backend processing
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'owner@test.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

let authToken = null;
let restaurantId = null;

// ============================================
// UTILITIES
// ============================================

const log = {
  title: (text) => console.log(`\n${'='.repeat(60)}\n${text}\n${'='.repeat(60)}`),
  success: (text) => console.log(`✓ ${text}`),
  error: (text) => console.error(`✗ ${text}`),
  info: (text) => console.log(`ℹ ${text}`),
  json: (obj) => console.log(JSON.stringify(obj, null, 2)),
};

// ============================================
// TEST 1: AUTHENTICATION
// ============================================

async function testAuthentication() {
  log.title('TEST 1: VERIFY AUTHENTICATION');

  try {
    log.info(`Logging in as: ${TEST_EMAIL}`);

    const response = await fetch(`${API_BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const data = await response.json();

    if (response.status !== 200) {
      log.error(`Login failed with status ${response.status}`);
      log.json(data);
      return false;
    }

    authToken = data.data?.accessToken;
    restaurantId = data.data?.restaurantId;

    if (!authToken) {
      log.error('No access token received from login');
      return false;
    }

    log.success(`Auth token received: ${authToken.substring(0, 20)}...`);
    log.success(`Restaurant ID: ${restaurantId}`);

    // Verify token structure
    const parts = authToken.split('.');
    if (parts.length !== 3) {
      log.error('Invalid JWT token format (expected 3 parts)');
      return false;
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      log.info('Token payload:');
      log.json({
        userId: payload.userId || payload.sub,
        email: payload.email,
        role: payload.role,
        restaurantId: payload.restaurantId,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      });
    } catch (e) {
      log.error('Could not decode token payload');
    }

    return true;
  } catch (error) {
    log.error(`Auth test failed: ${error.message}`);
    return false;
  }
}

// ============================================
// TEST 2: TOKEN HEADER VERIFICATION
// ============================================

async function testTokenHeader() {
  log.title('TEST 2: VERIFY AUTHORIZATION HEADER');

  try {
    log.info('Testing endpoint: GET /v1/menu/categories');

    const response = await fetch(`${API_BASE}/v1/menu/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Restaurant-Id': String(restaurantId),
      },
    });

    log.info(`Response status: ${response.status}`);

    if (response.status === 401) {
      log.error('Got 401 Unauthorized - Token may be invalid or expired');
      const data = await response.json();
      log.json(data);
      return false;
    }

    if (response.status === 200) {
      log.success('Authorization header accepted');
      return true;
    }

    log.error(`Unexpected status: ${response.status}`);
    const data = await response.json();
    log.json(data);
    return false;
  } catch (error) {
    log.error(`Header test failed: ${error.message}`);
    return false;
  }
}

// ============================================
// TEST 3: FILE UPLOAD STRUCTURE
// ============================================

async function testFileUpload() {
  log.title('TEST 3: VERIFY FILE UPLOAD STRUCTURE');

  try {
    // Create test CSV in memory
    const csvContent = `name,price,category
Biryani,350,Rice Dishes
Samosa,20,Appetizers
Chai,40,Beverages`;

    log.info('Test CSV content:');
    log.info(csvContent);

    // Create FormData with file
    const formData = new FormData();
    formData.append('file', Buffer.from(csvContent), {
      filename: 'test-menu.csv',
      contentType: 'text/csv',
    });

    log.info('Sending bulk upload request...');
    log.info(`Authorization: Bearer ${authToken.substring(0, 20)}...`);
    log.info(`X-Restaurant-Id: ${restaurantId}`);

    const response = await fetch(`${API_BASE}/v1/menu/bulk-upload`, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`,
        'X-Restaurant-Id': String(restaurantId),
      },
      body: formData,
    });

    log.info(`Response status: ${response.status}`);

    const responseData = await response.json();
    log.info('Response data:');
    log.json(responseData);

    if (response.status === 200 || response.status === 201) {
      log.success('File upload successful');
      return true;
    }

    if (response.status === 401) {
      log.error('Got 401 - Authentication failed');
      log.json({
        issue: 'Token not being sent or invalid',
        suggestedFix: 'Check Authorization header format',
      });
      return false;
    }

    if (response.status === 403) {
      log.error('Got 403 - Authorization failed');
      log.json({
        issue: 'User does not have permission',
        suggestedFix: 'Verify user has owner role and create_menu permission',
      });
      return false;
    }

    if (response.status === 400) {
      log.error('Got 400 - Bad request');
      log.json({
        issue: responseData.message,
        suggestedFix: 'Check CSV format: name, price, category required',
      });
      return false;
    }

    if (response.status === 500) {
      log.error('Got 500 - Server error');
      log.json({
        issue: responseData.message,
        suggestedFix: 'Check backend logs for [BULK_UPLOAD] errors',
      });
      return false;
    }

    return false;
  } catch (error) {
    log.error(`File upload test failed: ${error.message}`);
    log.json({
      error: error.message,
      stack: error.stack.split('\n').slice(0, 5),
    });
    return false;
  }
}

// ============================================
// TEST 4: REQUEST DEBUGGING
// ============================================

async function testDebugRequest() {
  log.title('TEST 4: DEBUG REQUEST DETAILS');

  try {
    const csvContent = `name,price,category
Test Item,100,Test Category`;

    const formData = new FormData();
    formData.append('file', Buffer.from(csvContent), {
      filename: 'debug-test.csv',
      contentType: 'text/csv',
    });

    const headers = {
      ...formData.getHeaders(),
      'Authorization': `Bearer ${authToken}`,
      'X-Restaurant-Id': String(restaurantId),
    };

    log.info('Request details:');
    log.json({
      method: 'POST',
      url: `${API_BASE}/v1/menu/bulk-upload`,
      headers: Object.keys(headers).reduce((acc, key) => {
        if (key === 'Authorization') {
          acc[key] = `Bearer ${authToken.substring(0, 20)}...`;
        } else {
          acc[key] = headers[key];
        }
        return acc;
      }, {}),
      body: 'FormData with file: debug-test.csv',
    });

    return true;
  } catch (error) {
    log.error(`Debug test failed: ${error.message}`);
    return false;
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  log.title('BULK UPLOAD DEBUGGING SUITE');

  const results = {
    authentication: false,
    tokenHeader: false,
    fileUpload: false,
    debugging: false,
  };

  // Test 1: Authentication
  results.authentication = await testAuthentication();
  if (!results.authentication) {
    log.error('Authentication failed - cannot proceed with other tests');
    printSummary(results);
    process.exit(1);
  }

  // Test 2: Token Header
  results.tokenHeader = await testTokenHeader();

  // Test 3: File Upload
  results.fileUpload = await testFileUpload();

  // Test 4: Debug Details
  results.debugging = await testDebugRequest();

  printSummary(results);

  if (results.fileUpload) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// ============================================
// RESULTS SUMMARY
// ============================================

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const tests = [
    ['Authentication', results.authentication],
    ['Authorization Header', results.tokenHeader],
    ['File Upload', results.fileUpload],
    ['Request Debugging', results.debugging],
  ];

  tests.forEach(([name, passed]) => {
    console.log(`${passed ? '✓' : '✗'} ${name}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('TROUBLESHOOTING GUIDE');
  console.log('='.repeat(60));

  if (!results.authentication) {
    console.log('\n❌ AUTHENTICATION FAILED:');
    console.log('  1. Check if API is running');
    console.log('  2. Verify TEST_EMAIL and TEST_PASSWORD environment variables');
    console.log('  3. Run: npm test or npm run test:api');
  }

  if (results.authentication && !results.tokenHeader) {
    console.log('\n❌ TOKEN HEADER FAILED:');
    console.log('  1. Token may have expired');
    console.log('  2. Check Authorization header format');
    console.log('  3. Verify X-Restaurant-Id header is being sent');
  }

  if (!results.fileUpload) {
    console.log('\n❌ FILE UPLOAD FAILED:');
    console.log('  1. Check req.file in backend logs');
    console.log('  2. Verify multer is configured for "file" key');
    console.log('  3. Check CSV format: name, price, category');
    console.log('  4. Look for [BULK_UPLOAD] logs in backend');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
