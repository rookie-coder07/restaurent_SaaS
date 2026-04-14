#!/usr/bin/env node

/**
 * Manager Login Fix Test Suite
 * Tests all components of the manager login fix
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

// Test credentials
const TEST_MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@restaurant.com';
const TEST_MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'Manager123@456';
const TEST_MANAGER_PORTAL = 'manager';

const TEST_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const TEST_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const TEST_ADMIN_PORTAL = 'admin';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(70));
  log(title, 'cyan');
  console.log('═'.repeat(70));
}

function logTest(name) {
  log(`\n📋 ${name}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test 1: Admin Login (Control Test)
async function test1_AdminLogin() {
  logTest('Test 1: Admin Login (Should Work)');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
        portal: TEST_ADMIN_PORTAL,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logSuccess(`Admin login successful`);
      logSuccess(`Token received: ${data.data?.accessToken?.substring(0, 20)}...`);
      logSuccess(`Redirect: ${data.data?.redirectTo}`);
      return { success: true, token: data.data?.accessToken, role: data.data?.role };
    } else {
      logError(`Admin login failed: ${data.message || response.statusText}`);
      if (data.errors) logError(`Errors: ${JSON.stringify(data.errors)}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Admin login request failed: ${error.message}`);
    return { success: false };
  }
}

// Test 2: Manager Login with Correct Password
async function test2_ManagerLoginCorrectPassword() {
  logTest('Test 2: Manager Login with Correct Password');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_MANAGER_EMAIL,
        password: TEST_MANAGER_PASSWORD,
        portal: TEST_MANAGER_PORTAL,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logSuccess(`Manager login successful`);
      logSuccess(`Email: ${TEST_MANAGER_EMAIL}`);
      logSuccess(`Role: ${data.data?.role}`);
      logSuccess(`Token: ${data.data?.accessToken?.substring(0, 20)}...`);
      logSuccess(`Redirect: ${data.data?.redirectTo}`);
      logSuccess(`Restaurant ID: ${data.data?.restaurantId}`);
      return { success: true, token: data.data?.accessToken, role: data.data?.role };
    } else {
      logError(`Manager login failed: ${data.message || response.statusText}`);
      if (data.errors) logError(`Errors: ${JSON.stringify(data.errors)}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Manager login request failed: ${error.message}`);
    return { success: false };
  }
}

// Test 3: Manager Login with Wrong Password
async function test3_ManagerLoginWrongPassword() {
  logTest('Test 3: Manager Login with Wrong Password (Should Fail)');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_MANAGER_EMAIL,
        password: 'WrongPassword123!',
        portal: TEST_MANAGER_PORTAL,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      logSuccess(`Manager login correctly rejected with wrong password`);
      logSuccess(`Error message: ${data.message}`);
      return { success: true };
    } else {
      logError(`Manager login should have failed with wrong password`);
      return { success: false };
    }
  } catch (error) {
    logError(`Manager login request failed: ${error.message}`);
    return { success: false };
  }
}

// Test 4: Manager Login with Wrong Email
async function test4_ManagerLoginWrongEmail() {
  logTest('Test 4: Manager Login with Non-existent Email (Should Fail)');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: TEST_MANAGER_PASSWORD,
        portal: TEST_MANAGER_PORTAL,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      logSuccess(`Manager login correctly rejected with non-existent email`);
      logSuccess(`Error message: ${data.message}`);
      return { success: true };
    } else {
      logError(`Manager login should have failed with non-existent email`);
      return { success: false };
    }
  } catch (error) {
    logError(`Manager login request failed: ${error.message}`);
    return { success: false };
  }
}

// Test 5: Verify Token
async function test5_VerifyManagerToken(token) {
  logTest('Test 5: Verify Manager Token');

  if (!token) {
    logWarning('Skipping token verification - no token from previous test');
    return { success: false };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logSuccess(`Token verified`);
      logSuccess(`User ID: ${data.data?.id}`);
      logSuccess(`Email: ${data.data?.email}`);
      logSuccess(`Role: ${data.data?.role}`);
      logSuccess(`Restaurant ID: ${data.data?.restaurantId}`);
      return { success: true };
    } else {
      logError(`Token verification failed: ${data.message}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Token verification request failed: ${error.message}`);
    return { success: false };
  }
}

// Main test runner
async function main() {
  logSection('🧪 MANAGER LOGIN FIX TEST SUITE');
  log(`API: ${API_BASE_URL}`, 'cyan');
  log(`Test Manager: ${TEST_MANAGER_EMAIL}`, 'cyan');
  log(`Test Admin: ${TEST_ADMIN_EMAIL}`, 'cyan');

  const results = [];

  // Run tests
  const test1 = await test1_AdminLogin();
  results.push({ name: '1. Admin Login (Control)', pass: test1.success });

  const test2 = await test2_ManagerLoginCorrectPassword();
  results.push({ name: '2. Manager Login (Correct Password)', pass: test2.success });
  const managerToken = test2.token;

  const test3 = await test3_ManagerLoginWrongPassword();
  results.push({ name: '3. Manager Login Rejected (Wrong Password)', pass: test3.success });

  const test4 = await test4_ManagerLoginWrongEmail();
  results.push({ name: '4. Manager Login Rejected (Wrong Email)', pass: test4.success });

  const test5 = managerToken ? await test5_VerifyManagerToken(managerToken) : { success: false };
  results.push({ name: '5. Manager Token Verification', pass: test5.success });

  // Print results
  logSection('📊 TEST RESULTS');
  let passed = 0;
  let failed = 0;

  results.forEach((result) => {
    if (result.pass) {
      logSuccess(`${result.name}`);
      passed++;
    } else {
      logError(`${result.name}`);
      failed++;
    }
  });

  logSection('Summary');
  log(`Passed: ${passed}/${results.length}`, 'green');
  if (failed > 0) {
    log(`Failed: ${failed}/${results.length}`, 'red');
  }

  if (passed === results.length) {
    logSuccess('ALL TESTS PASSED! ✨');
    process.exit(0);
  } else {
    logError('SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch((error) => {
  logError(`Test suite error: ${error.message}`);
  process.exit(1);
});
