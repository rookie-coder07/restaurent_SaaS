import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';
const RESTAURANT_ID = '515cfff9-6b46-49c1-b369-1d5650c95816';

// Generate a test waiter token
const waiterToken = jwt.sign(
  {
    userId: '1f944d71-1928-4f72-8fc5-c65d6290ed03',
    email: 'testwaiter@pos.com',
    restaurantId: RESTAURANT_ID,
    role: 'waiter',
    name: 'Test Waiter',
  },
  JWT_SECRET,
  { expiresIn: '15m' }
);

console.log('Valid Waiter Token:');
console.log(waiterToken);
console.log('\nUse this token in test scripts and API calls');
