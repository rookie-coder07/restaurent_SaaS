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
    const loginRes = await apiCall('POST', '/auth/login', {
      email: managerEmail,
      password: managerPassword,
    });

    const token = loginRes.data.accessToken;
    const restaurantId = loginRes.data.restaurant.id;
    console.log(`✅ Logged in as ${loginRes.data.user.name}`);
    console.log(`✅ Restaurant ID: ${restaurantId}`);

    // Get all tables
    console.log('\n📋 Getting all tables...');
    let tablesRes = await apiCall('GET', '/tables', null, token, restaurantId);
    let tables = tablesRes.data?.tables || [];
    console.log(`Found ${tables.length} tables`);

    // Get all staff
    console.log('\n👥 Getting staff list...');
    const staffRes = await apiCall('GET', '/restaurants/staff', null, token, restaurantId);
    const waiter = (staffRes.data?.staff || []).find(s => s.email === waiterEmail);
    
    if (!waiter) {
      console.log(`❌ Waiter ${waiterEmail} not found!`);
      return;
    }
    
    console.log(`✅ Target waiter: ${waiter.name} (ID: ${waiter.id})`);
    
    // Manually reassign each table to the waiter
    console.log(`\n🔗 Reassigning ${tables.length} tables to waiter...`);
    
    for (const table of tables) {
      try {
        await apiCall(
          'PUT',
          `/tables/${table.id}`,
          {
            assignedTo: waiter.id,
            lockedByQr: false,  // Clear QR lock
            status: 'available',
          },
          token,
          restaurantId
        );
        console.log(`  ✅ Table ${table.tableNumber} (${table.id}) assigned to ${waiter.name}`);
      } catch (err) {
        console.log(`  ⚠️  Table ${table.tableNumber}: ${err.message}`);
      }
    }

    console.log(`\n✨ Setup complete!`);
    console.log(`${tables.length} tables are now assigned to ${waiter.name}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
