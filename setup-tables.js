#!/usr/bin/env node

import http from 'http';

const API_URL = 'http://localhost:3000/api/v1';
const managerEmail = 'manager@restaurant.com';
const managerPassword = 'Manager123@456';
const waiterEmail = 'testwaiter@pos.com';

// Simple HTTP request wrapper
function apiCall(method, path, body = null, token = null, restaurantId = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (restaurantId) options.headers['x-restaurant-id'] = restaurantId;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${json.message}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  try {
    console.log('🔐 Login as Manager...');
    const loginRes = await apiCall('POST', '/auth/staff/login', {
      email: managerEmail,
      password: managerPassword,
    });

    const token = loginRes.data.accessToken;
    const restaurantId = loginRes.data.restaurant.id;
    console.log(`✅ Logged in as ${loginRes.data.user.name}`);
    console.log(`✅ Restaurant ID: ${restaurantId}`);

    // Check existing tables
    console.log('\n📋 Getting existing tables...');
    let tablesRes = await apiCall('GET', '/tables', null, token, restaurantId);
    let tables = tablesRes.data?.tables || [];
    console.log(`Found ${tables.length} tables`);

    // Create tables if needed
    let tableIds = [];
    if (tables.length === 0) {
      console.log('\n🔨 Creating 3 sample tables...');
      for (let i = 1; i <= 3; i++) {
        const createRes = await apiCall(
          'POST',
          '/tables',
          {
            tableNumber: `${i}`,
            capacity: 4,
            status: 'available',
          },
          token,
          restaurantId
        );
        const tableId = createRes.data?.id;
        tableIds.push(tableId);
        console.log(`  ✅ Created Table ${i} (ID: ${tableId})`);
      }
    } else {
      tableIds = tables.map(t => t.id);
      console.log('\n✅ Using existing tables:');
      tables.forEach(t => console.log(`  Table ${t.tableNumber} (ID: ${t.id})`));
    }

    // Get waiter
    console.log(`\n👤 Looking for waiter: ${waiterEmail}...`);
    const staffRes = await apiCall('GET', '/restaurants/staff', null, token, restaurantId);
    const waiter = (staffRes.data?.staff || []).find(s => s.email === waiterEmail);

    if (!waiter) {
      console.log(`❌ Waiter ${waiterEmail} not found!`);
      console.log('Available staff:');
      (staffRes.data?.staff || []).forEach(s => {
        console.log(`  - ${s.name} (${s.email}) - Role: ${s.role}`);
      });
      return;
    }

    console.log(`✅ Waiter found: ${waiter.name} (ID: ${waiter.id})`);

    // Assign tables to waiter
    console.log('\n🔗 Assigning tables to waiter...');
    const updateRes = await apiCall(
      'PUT',
      `/restaurants/staff/${waiter.id}`,
      { assignedTables: tableIds },
      token,
      restaurantId
    );

    console.log(`✅ Assigned ${tableIds.length} tables to ${waiter.name}`);
    console.log(`\n✨ Setup complete!`);
    console.log(`Waiter can now use tables: ${tableIds.slice(0, 3).join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
