#!/usr/bin/env node

import http from 'http';

const API_URL = 'http://localhost:3000/api/v1';
const managerEmail = 'manager@restaurant.com';
const managerPassword = 'Manager123@456';

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
    console.log(`✅ Logged in`);

    // Get all staff
    console.log('\n👥 Getting all staff...');
    const staffRes = await apiCall('GET', '/restaurants/staff', null, token, restaurantId);
    const staff = staffRes.data?.staff || [];
    
    console.log(`Found ${staff.length} staff members:`);
    staff.forEach(s => {
      console.log(`  - ${s.name} (${s.email}): Role=${s.role}, AssignedTables=${s.assignedTables?.length || 0}`);
    });

    // Clear all assignedTables for all staff (set to empty array)
    console.log(`\n🔄 Clearing assigned tables for all staff...`);
    
    for (const member of staff) {
      try {
        await apiCall(
          'PUT',
          `/restaurants/staff/${member.id}`,
          { assignedTables: [] },
          token,
          restaurantId
        );
        console.log(`  ✅ ${member.name}: cleared`);
      } catch (err) {
        console.log(`  ⚠️  ${member.name}: ${err.message}`);
      }
    }

    //Now assign tables to test waiter
    const waiter = staff.find(s => s.email === 'testwaiter@pos.com');
    if (waiter) {
      console.log(`\n📋 Getting all table IDs...`);
      const tablesRes = await apiCall('GET', '/tables', null, token, restaurantId);
      const tableIds = (tablesRes.data?.tables || []).map(t => t.id);
      console.log(`Found ${tableIds.length} tables`);
      
      console.log(`\n🔗 Assigning ${tableIds.length} tables to ${waiter.name}...`);
      await apiCall(
        'PUT',
        `/restaurants/staff/${waiter.id}`,
        { assignedTables: tableIds },
        token,
        restaurantId
      );
      console.log(`✅ Done!`);
    }

    console.log(`\n✨ Setup complete!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
