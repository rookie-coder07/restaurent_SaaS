import jwt from 'jsonwebtoken';
import request from 'supertest';

describe('Backend deployment smoke', () => {
  let app;

  beforeAll(async () => {
    ({ default: app } = await import('../src/app.js'));
  });

  test('GET /health returns a basic server status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Server running');
  });

  test('GET /api/health returns JSON health data', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.uptime).toEqual(expect.any(Number));
  });

  test('POST /api/v1/auth/login validates required fields', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });

  test('GET /api/v1/auth/me blocks unauthenticated access', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/v1/auth/me accepts a valid token and returns the normalized user', async () => {
    const token = jwt.sign(
      {
        userId: 'user-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'admin',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      userId: 'user-1',
      restaurantId: 'rest-1',
      email: 'owner@example.com',
      role: 'owner',
    });
  });

  test('GET /api/v1/auth/me accepts manager-role tokens', async () => {
    const token = jwt.sign(
      {
        userId: 'manager-1',
        restaurantId: 'rest-1',
        email: 'manager@example.com',
        role: 'manager',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      userId: 'manager-1',
      restaurantId: 'rest-1',
      email: 'manager@example.com',
      role: 'manager',
    });
  });

  test('GET /api/v1/restaurants/profile rejects cross-tenant access before reaching the controller', async () => {
    const token = jwt.sign(
      {
        userId: 'user-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get('/api/v1/restaurants/profile')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Restaurant-Id', 'rest-2');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Cannot access other restaurants data');
  });
});
