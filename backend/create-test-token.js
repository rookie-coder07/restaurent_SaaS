import jwt from 'jsonwebtoken';

const secret = 'your-super-secret-jwt-key-min-32-characters-change-this-in-production';

const token = jwt.sign(
  {
    userId: 'test-owner-user-1',
    restaurantId: '11970000-0000-0000-0000-000000000001',
    email: 'owner@restaurant.com',
    role: 'owner',
  },
  secret
);

console.log(token);
