import http from 'http';

const testOrderCreation = async () => {
  console.log('Testing order creation API...\n');

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFmOTQ0ZDcxLTE5MjgtNGY3Mi04ZmM1LWM2NWQ2MjkwZWQwMyIsImVtYWlsIjoidGVzdHdhaXRlckBwb3MuY29tIiwicmVzdGF1cmFudElkIjoiNTE1Y2ZmZjktNmI0Ni00OWMxLWIzNjktMWQ1NjUwYzk1ODE2Iiwicm9sZSI6IldBSVRFUiIsIm5hbWUiOiJUZXN0IFdhaXRlciIsImlhdCI6MTc3NTcyOTI4OCwiZXhwIjoxNzc1NzMwMTg4fQ.PIxkX2vxnlU4whXeaKGKYv9KVTk1NLePERYlg0yQf_I'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Status Code:', res.statusCode);
        try {
          const json = JSON.parse(data);
          if (json.success) {
            console.log('✨ Order created successfully!');
            console.log(`   Order ID: ${json.data.id}`);
            console.log(`   Status: ${json.data.status}`);
            console.log(`   Items: ${json.data.items?.length || 0}`);
            console.log(`   Total: ₹${(json.data.totalAmount || 0) / 100}`);
          } else {
            console.log('❌ Error:', json.message);
          }
        } catch (e) {
          console.log('📝 Response:', data);
        }
        resolve(data);
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error:', error.message);
      reject(error);
    });
    
    const payload = JSON.stringify({
      tableId: 'f6315218-b8a5-4f34-8870-f20145aca55a',
      items: [
        {
          menuItemId: '997cf41c-ada4-4d32-8057-8d6ef2938e75',
          quantity: 2,
          specialInstructions: 'No ice'
        }
      ]
    });

    console.log('📤 Creating order for Table 1...\n');
    req.write(payload);
    req.end();
  });
};

await testOrderCreation().catch(err => console.error('Test failed:', err));
