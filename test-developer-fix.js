#!/usr/bin/env node

const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1';

// Mock developer JWT token
const DEVELOPER_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJkZXZlbG9wZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiZGV2ZWxvcGVyIiwicmVzdGF1cmFudElkIjpudWxsLCJ1c2VySWQiOiJkZXYtMDAxIiwiaWF0IjoxNjEyMzIyNDAwLCJleHAiOjE2MTIzMjYwMDB9.test';

async function testDeveloperAPI() {
  const endpoints = [
    '/developer/restaurants',
    '/developer/control-center/overview',
    '/developer/control-center/live',
    '/developer/settings',
    '/developer/dashboard'
  ];

  console.log('🧪 Testing Developer API Access\n');
  console.log(`Token: ${DEVELOPER_TOKEN}\n`);

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

function testEndpoint(path) {
  return new Promise((resolve) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': DEVELOPER_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const status = res.statusCode;
        const icon = status === 200 ? '✅' : '❌';
        console.log(`${icon} GET ${path}`);
        console.log(`   Status: ${status}`);
        if (status !== 200) {
          console.log(`   Response: ${data.substring(0, 100)}`);
        }
        console.log();
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`❌ GET ${path}`);
      console.log(`   Error: ${error.message}\n`);
      resolve();
    });

    req.end();
  });
}

testDeveloperAPI().catch(console.error);
