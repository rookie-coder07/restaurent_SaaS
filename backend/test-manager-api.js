#!/usr/bin/env node
/**
 * Test Manager API Flow
 * 
 * This script tests the complete manager authentication and data fetching flow:
 * 1. Login as manager
 * 2. Extract restaurantId from JWT token
 * 3. Fetch orders, tables, staff
 * 4. Show what the manager portal sees
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api/v1';

async function main() {
  console.log('\n🧪 Testing Manager API Flow');
  console.log('===============================================\n');

  try {
    // Step 1: Login
    console.log('[1/4] 🔐 Logging in as manager...\n');
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@restaurant.com',
        password: 'Manager123@456',
        portal: 'manager'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken;
    const restaurantId = loginData.data?.user?.restaurantId;

    console.log('✅ Login successful');
    console.log(`   Restaurant ID: ${restaurantId || '❌ MISSING!'}`);
    console.log(`   Token: ${token ? token.substring(0, 20) + '...[REDACTED]' : '❌ MISSING!'}\n`);

    if (!token || !restaurantId) {
      console.error('❌ Token or Restaurant ID missing from login response!\n');
      return;
    }

    // Decode JWT to check content
    const tokenParts = token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('📋 JWT Payload:');
    console.log(`   userId: ${payload.userId}`);
    console.log(`   restaurantId: ${payload.restaurantId || '❌ MISSING!'}`);
    console.log(`   email: ${payload.email}`);
    console.log(`   role: ${payload.role}\n`);

    // Step 2: Fetch orders
    console.log('[2/4] 📦 Fetching orders...\n');
    const ordersRes = await fetch(`${API_BASE_URL}/orders?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!ordersRes.ok) {
      console.error(`❌ Failed to fetch orders: ${ordersRes.status}`);
    } else {
      const ordersData = await ordersRes.json();
      const orders = ordersData.data?.items || [];
      console.log(`✅ Orders: ${orders.length} found`);
      if (orders.length > 0) {
        console.log(`   First order: ${orders[0].display_order_number}\n`);
      } else {
        console.log(`   ⚠️  No orders in restaurant\n`);
      }
    }

    // Step 3: Fetch tables
    console.log('[3/4] 🪑 Fetching tables...\n');
    const tablesRes = await fetch(`${API_BASE_URL}/tables?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!tablesRes.ok) {
      console.error(`❌ Failed to fetch tables: ${tablesRes.status}`);
    } else {
      const tablesData = await tablesRes.json();
      const tables = tablesData.data?.tables || [];
      console.log(`✅ Tables: ${tables.length} found`);
      if (tables.length > 0) {
        console.log(`   First table: Table ${tables[0].tableNumber}\n`);
      } else {
        console.log(`   ⚠️  No tables in restaurant\n`);
      }
    }

    // Step 4: Fetch staff
    console.log('[4/4] 👥 Fetching staff...\n');
    const staffRes = await fetch(`${API_BASE_URL}/restaurants/staff?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!staffRes.ok) {
      console.error(`❌ Failed to fetch staff: ${staffRes.status}`);
    } else {
      const staffData = await staffRes.json();
      const staff = staffData.data?.staff || [];
      console.log(`✅ Staff: ${staff.length} found`);
      if (staff.length > 0) {
        console.log(`   First staff: ${staff[0].name}\n`);
      } else {
        console.log(`   ⚠️  No staff in restaurant\n`);
      }
    }

    console.log('===============================================');
    console.log('✅ API Flow Test Complete\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

main();
