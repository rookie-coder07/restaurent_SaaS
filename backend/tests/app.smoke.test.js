import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';

// DO NOT import AuthService or OrderService here - import them in beforeAll after setting up mocks

describe('Backend deployment smoke', () => {
  let app;
  let AuthService;
  let OrderService;
  let setSupabaseForTesting;

  beforeAll(async () => {
    // Set test mode and global mock FIRST, before importing anything else
    process.env.NODE_ENV = 'test';
    
    // Create comprehensive mock chain
    const mockChain = {
      select: jest.fn(function() { return this; }),
      insert: jest.fn(function() { return this; }),
      update: jest.fn(function() { return this; }),
      delete: jest.fn(function() { return this; }),
      eq: jest.fn(function() { return this; }),
      is: jest.fn(function() { return this; }),
      order: jest.fn(function() { return this; }),
      limit: jest.fn(function() { return this; }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    
    // Create mock supabase object
    const mockSupabase = {
      from: jest.fn().mockReturnValue(mockChain),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Network error' }
        }),
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null
        }),
        signUp: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Network error' }
        }),
      },
    };
    
    // Set global mock BEFORE importing any app modules
    global.__SUPABASE_MOCK__ = mockSupabase;
    
    // NOW import app modules after mock is set up
    AuthService = (await import('../src/services/authService.js')).default;
    OrderService = (await import('../src/services/orderService.js')).default;
    const systemAccess = await import('../src/middleware/systemAccess.js');
    setSupabaseForTesting = systemAccess.setSupabaseForTesting;
    
    // Inject mock into services
    AuthService.setSupabase(mockSupabase);
    OrderService.setSupabase(mockSupabase);
    setSupabaseForTesting(mockSupabase);
    
    // Finally, import app after all modules and mocks are ready
    ({ default: app } = await import('../src/app.js'));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('GET /health returns a basic server status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status || response.body.success).toBeTruthy();
  });

  test('GET /api/health returns JSON health data', async () => {
    const response = await request(app).get('/api/health');

    expect([200, 503]).toContain(response.status);
    expect(response.body).toBeDefined();
  });

  test('POST /api/v1/auth/login validates required fields', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({});

    expect([400, 401]).toContain(response.status);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/v1/auth/me blocks unauthenticated access', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect([401,403]).toContain(response.status);
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
    expect(response.body.data.user.userId).toBeDefined();
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
    expect(response.body.data.user.userId).toBeDefined();
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

  test('POST /api/v1/inventory/items blocks manager write access', async () => {
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
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Rice',
        quantity: 10,
        unit: 'kg',
        threshold: 2,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('POST /api/v1/inventory/items validates owner payloads before any write happens', async () => {
    const token = jwt.sign(
      {
        userId: 'owner-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
        quantity: -1,
        unit: 'bad-unit',
        threshold: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });

  test('POST /api/v1/inventory/items/:itemId/add-stock validates owner payloads locally', async () => {
    const token = jwt.sign(
      {
        userId: 'owner-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post('/api/v1/inventory/items/item-1/add-stock')
      .set('Authorization', `Bearer ${token}`)
      .send({
        quantity: 0,
        reason: 'restock',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });

  test('POST /api/v1/inventory/items/:itemId/adjust validates stock adjustment actions locally', async () => {
    const token = jwt.sign(
      {
        userId: 'owner-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post('/api/v1/inventory/items/item-1/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: 'multiply',
        quantity: 5,
        reason: 'test',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });

  test('POST /api/v1/orders/:orderId/settle blocks waiter billing access', async () => {
    const token = jwt.sign(
      {
        userId: 'waiter-1',
        restaurantId: 'rest-1',
        email: 'waiter@example.com',
        role: 'staff',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post('/api/v1/orders/order-1/settle')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'cash',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Unauthorized: Only manager can perform billing actions');
  });

  test('PUT /api/v1/restaurants/settings/invoice blocks manager access', async () => {
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
      .put('/api/v1/restaurants/settings/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prefix: 'INV',
        startingNumber: 1001,
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('PUT /api/v1/restaurants/settings/invoice validates owner payloads before any write happens', async () => {
    const token = jwt.sign(
      {
        userId: 'owner-1',
        restaurantId: 'rest-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .put('/api/v1/restaurants/settings/invoice')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prefix: 'bad prefix!',
        startingNumber: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });
});
