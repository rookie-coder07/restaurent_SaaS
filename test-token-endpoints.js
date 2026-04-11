import fetch from 'node-fetch';

async function testTokenEndpoints() {
  console.log('🧪 Testing Token Management Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing /health endpoint...');
    let res = await fetch('http://localhost:3000/health');
    let data = await res.json();
    console.log('✅ Health Status:', data);

    // Test 2: Login (we'll need valid credentials)
    console.log('\n2️⃣ Testing /auth/login-staff endpoint...');
    res = await fetch('http://localhost:3000/api/auth/login-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    });
    data = await res.text();
    console.log('Response:', data.substring(0, 200));

    // Test 3: Token info (needs auth)
    console.log('\n3️⃣ Testing /auth/token-info endpoint...');
    res = await fetch('http://localhost:3000/api/auth/token-info', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    data = await res.json();
    console.log('Token Info Response:', data);

    console.log('\n✅ All endpoint tests completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTokenEndpoints();
