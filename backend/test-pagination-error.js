import 'dotenv/config';
import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const RESTAURANT_ID = '515cfff9-6b46-49c1-b369-1d5650c95816';

// Generate a valid manager token
const managerToken = jwt.sign(
  {
    userId: '8c5953f4-5afd-49e2-9a42-c5bd0620753c',
    restaurantId: RESTAURANT_ID,
    role: 'manager',
  },
  JWT_SECRET,
  { expiresIn: '15m' }
);

console.log('Token:', managerToken, '\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/orders?limit=20&skip=0',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${managerToken}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('\nResponse:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

req.end();
