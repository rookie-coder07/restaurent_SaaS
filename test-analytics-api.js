#!/usr/bin/env node

/**
 * Test script for Analytics Dashboard API endpoints
 * Run with: node test-analytics-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api/v1';
const TEST_RESTAURANT_ID = 'test-restaurant-123';
const TEST_AUTH_TOKEN = 'test-token-123'; // Replace with real token

function makeRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Restaurant-Id': TEST_RESTAURANT_ID,
      },
    };

    const req = http.request(urlObj, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Analytics API Tests\n');

  try {
    // Test 1: Dashboard endpoint
    console.log('Test 1: GET /analytics/dashboard?period=today');
    const dashboardRes = await makeRequest('GET', '/analytics/dashboard?period=today', TEST_AUTH_TOKEN);
    console.log(`Status: ${dashboardRes.status}`);
    console.log(`Data Keys: ${Object.keys(dashboardRes.data?.data || {}).join(', ')}\n`);

    // Test 2: KPI endpoint
    console.log('Test 2: GET /analytics/kpi?period=today');
    const kpiRes = await makeRequest('GET', '/analytics/kpi?period=today', TEST_AUTH_TOKEN);
    console.log(`Status: ${kpiRes.status}`);
    console.log(`KPI Data: ${JSON.stringify(kpiRes.data?.data, null, 2)}\n`);

    // Test 3: Revenue trend
    console.log('Test 3: GET /analytics/revenue-trend?period=week');
    const trendRes = await makeRequest('GET', '/analytics/revenue-trend?period=week', TEST_AUTH_TOKEN);
    console.log(`Status: ${trendRes.status}`);
    console.log(`Data Length: ${(trendRes.data?.data || []).length}\n`);

    // Test 4: Category performance
    console.log('Test 4: GET /analytics/category-performance?period=month');
    const categoryRes = await makeRequest('GET', '/analytics/category-performance?period=month', TEST_AUTH_TOKEN);
    console.log(`Status: ${categoryRes.status}`);
    console.log(`Categories: ${(categoryRes.data?.data || []).length}\n`);

    // Test 5: Top items
    console.log('Test 5: GET /analytics/items?period=month&limit=10');
    const itemsRes = await makeRequest('GET', '/analytics/items?period=month&limit=10', TEST_AUTH_TOKEN);
    console.log(`Status: ${itemsRes.status}`);
    console.log(`Items: ${(itemsRes.data?.data || []).length}\n`);

    // Test 6: Payment methods
    console.log('Test 6: GET /analytics/payment-methods?period=month');
    const paymentRes = await makeRequest('GET', '/analytics/payment-methods?period=month', TEST_AUTH_TOKEN);
    console.log(`Status: ${paymentRes.status}`);
    console.log(`Methods: ${(paymentRes.data?.data || []).length}\n`);

    // Test 7: Hourly data
    console.log('Test 7: GET /analytics/hourly-data?period=today');
    const hourlyRes = await makeRequest('GET', '/analytics/hourly-data?period=today', TEST_AUTH_TOKEN);
    console.log(`Status: ${hourlyRes.status}`);
    console.log(`Hours: ${(hourlyRes.data?.data || []).length}\n`);

    console.log('✅ All tests completed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
