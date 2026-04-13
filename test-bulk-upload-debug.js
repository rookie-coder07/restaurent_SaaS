#!/usr/bin/env node
/**
 * Debugging Test - Bulk Upload Error Diagnosis
 * 
 * This script tests the bulk upload endpoint with detailed logging
 * to diagnose what exact error is causing the 500 response
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE_URL = process.env.API_URL || 'https://restaurent-backend-448t.onrender.com/api/v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(70), 'cyan');
  log(title, 'cyan');
  log('='.repeat(70) + '\n', 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function getOwnerToken() {
  logInfo('Logging in as owner to get token...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@restaurant.com',
        password: 'Owner123@456',
        portal: 'admin',
      }),
    });

    if (!response.ok) {
      logError(`Login failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const token = data.data?.accessToken;

    if (!token) {
      logError('No token in response');
      return null;
    }

    logSuccess(`Got token: ${token.substring(0, 20)}...`);
    return token;
  } catch (error) {
    logError(`Login error: ${error.message}`);
    return null;
  }
}

async function testBulkUploadWithFile(token, filePath) {
  logSection('Testing Bulk Upload with File');
  
  try {
    if (!fs.existsSync(filePath)) {
      logError(`File not found: ${filePath}`);
      return false;
    }

    const fileSize = fs.statSync(filePath).size;
    logInfo(`File: ${path.basename(filePath)}`);
    logInfo(`Size: ${fileSize} bytes`);
    logInfo(`Max allowed: 5MB (5242880 bytes)`);

    if (fileSize > 5 * 1024 * 1024) {
      logError('File exceeds 5MB limit');
      return false;
    }

    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);
    form.append('file', fileStream, path.basename(filePath));

    logInfo(`Sending POST request to ${API_BASE_URL}/menu/bulk-upload`);
    logInfo(`Authorization: Bearer ${token.substring(0, 20)}...`);

    const response = await fetch(`${API_BASE_URL}/menu/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    logInfo(`Response status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok) {
      logSuccess('Upload successful!');
      logInfo(`Inserted: ${data.data?.inserted || 0}`);
      logInfo(`Skipped: ${data.data?.skipped || 0}`);
      if (data.data?.errors?.length > 0) {
        logWarning(`Errors: ${data.data.errors.length}`);
        data.data.errors.slice(0, 5).forEach((err, i) => {
          logInfo(`  Row ${err.row}: ${err.reason}`);
        });
      }
      return true;
    }

    if (response.status === 401) {
      logError('401 Unauthorized - Token not working');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }

    if (response.status === 403) {
      logError('403 Forbidden - Check user permissions');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }

    if (response.status === 400) {
      logError('400 Bad Request - File format issue');
      logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }

    if (response.status === 500) {
      logError('500 Internal Server Error - Backend error');
      logError(`Message: ${data.message}`);
      logWarning('Full response:');
      logInfo(JSON.stringify(data, null, 2));
      
      logSection('Debugging Tips');
      logWarning('1. Check if file is valid CSV or XLSX');
      logWarning('2. Verify file is not empty');
      logWarning('3. Check if file columns include: name, price, category');
      logWarning('4. Check backend logs: docker logs restaurent-backend 2>&1 | grep BULK_UPLOAD');
      logWarning('5. Verify database connection is working');
      
      return false;
    }

    logError(`Unexpected status: ${response.status}`);
    logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
    return false;
  } catch (error) {
    logError(`Error: ${error.message}`);
    logInfo(error.stack);
    return false;
  }
}

async function testBulkUploadWithString(token, csvContent) {
  logSection('Testing Bulk Upload with CSV String');
  
  try {
    logInfo(`CSV content:\n${csvContent}\n`);

    const form = new FormData();
    form.append('file', Buffer.from(csvContent), 'test-menu.csv');

    logInfo(`Sending POST request to ${API_BASE_URL}/menu/bulk-upload`);

    const response = await fetch(`${API_BASE_URL}/menu/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    logInfo(`Response status: ${response.status}`);

    const data = await response.json();

    if (response.ok) {
      logSuccess('Upload successful!');
      return true;
    }

    logError(`Failed with status ${response.status}`);
    logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
    return false;
  } catch (error) {
    logError(`Error: ${error.message}`);
    return false;
  }
}

async function main() {
  logSection('🔍 BULK UPLOAD ERROR DIAGNOSIS');

  const token = await getOwnerToken();
  if (!token) {
    logError('Cannot proceed without token');
    process.exit(1);
  }

  logSection('Test 1: Simple CSV String');
  const csvContent = `name,price,category
Paneer Butter Masala,350,Indian
Naan,50,Bread
Coca Cola,80,Beverages`;

  const result1 = await testBulkUploadWithString(token, csvContent);

  logSection('Test 2: Look for CSV Files');
  const csvFiles = [
    './menu.csv',
    './test-menu.csv',
    path.join(__dirname, 'menu.csv'),
  ];

  for (const csvFile of csvFiles) {
    if (fs.existsSync(csvFile)) {
      logInfo(`Found file: ${csvFile}`);
      const result2 = await testBulkUploadWithFile(token, csvFile);
      if (result2) break;
    }
  }

  logSection('📊 Diagnosis Complete');
  logInfo('If you still see 500 errors:');
  logInfo('1. Check backend logs for detailed error');
  logInfo('2. Verify Supabase connection');
  logInfo('3. Check file permissions');
  logInfo('4. Ensure restaurantId is set correctly in token');
}

main().catch(console.error);
