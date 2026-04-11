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

    // Get all tables
    console.log('\n📋 Getting all table IDs...');
    let tablesRes = await apiCall('GET', '/tables', null, token, restaurantId);
    const tableIds = (tablesRes.data?.tables || []).map(t => t.id);
    console.log(`Found ${tableIds.length} table IDs`);

    // Get waiter
    console.log(`\n👥 Finding waiter: ${waiterEmail}...`);
    const staffRes = await apiCall('GET', '/restaurants/staff', null, token, restaurantId);
    const waiter = (staffRes.data?.staff || []).find(s => s.email === waiterEmail);
    
    if (!waiter) {
      console.log(`❌ Waiter not found!`);
      return;
    }
    
    console.log(`✅ Waiter: ${waiter.name} (ID: ${waiter.id})`);
   console.log(`   Current assignedTables: ${waiter.assignedTables?.length || 0}`);

    // Update waiter's assignedTables via staff endpoint
    console.log(`\n🔗 Updating waiter's assignedTables to ${tableIds.length} tables...`);
    
    const updateRes = await apiCall(
      'PUT',
      `/restaurants/staff/${waiter.id}`,
      { 
        assignedTables: tableIds,
      },
      token,
      restaurantId
    );

    console.log(`✅ Updated! Assigned tables: ${updateRes.data?.assignedTables?.length || 0}`);
    console.log(`\n✨ Setup complete! Waiter can now access ${tableIds.length} tables`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
