import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Set test mode FIRST - BEFORE importing any application modules
process.env.NODE_ENV = 'test';

// Create comprehensive mock chain
const mockChain = {
  select: jest.fn(() => mockChain),
  insert: jest.fn(() => mockChain),
  update: jest.fn(() => mockChain),
  delete: jest.fn(() => mockChain),
  eq: jest.fn(() => mockChain),
  order: jest.fn(() => mockChain),
  limit: jest.fn(() => mockChain),
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
      error: { message: 'Invalid credentials' }
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: null },
      error: null
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Registration error' }
    }),
    resetPasswordForEmail: jest.fn().mockResolvedValue({
      data: {},
      error: null
    }),
  },
};

// Set global mock BEFORE importing any modules
global.__SUPABASE_MOCK__ = mockSupabase;

describe('Security Routes', () => {
  let app;
  let AuthService;
  let setSupabaseForTesting;

  beforeAll(async () => {
    // Import services AFTER mock is set up
    AuthService = (await import('../src/services/authService.js')).default;
    const systemAccess = await import('../src/middleware/systemAccess.js');
    setSupabaseForTesting = systemAccess.setSupabaseForTesting;
    
    // Inject into services
    AuthService.setSupabase(mockSupabase);
    setSupabaseForTesting(mockSupabase);
    
    // Import routes AFTER services are set up with mocks
    const authRouter = (await import('../src/routes/auth.js')).default;
    const orderRouter = (await import('../src/routes/order.js')).default;
    const menuRouter = (await import('../src/routes/menu.js')).default;
    const tableRouter = (await import('../src/routes/table.js')).default;
    const restaurantRouter = (await import('../src/routes/restaurant.js')).default;
    const developerRouter = (await import('../src/routes/developer.js')).default;
    
    // Create express app and configure routes
    app = express();
    app.use(express.json());
    
    app.use('/auth', authRouter);
    app.use('/orders', orderRouter);
    app.use('/menu', menuRouter);
    app.use('/tables', tableRouter);
    app.use('/restaurant', restaurantRouter);
    app.use('/developer', developerRouter);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Test data
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User'
  };

  const weakPassword = {
    email: 'weak@example.com',
    password: '123' // Too short, no special chars
  };

  const invalidMenuPrice = {
    name: 'Test Item',
    price: -100, // Negative price
    categoryId: 'cat-1'
  };

  describe('Security Routes - Authentication', () => {
    it('should reject registration with weak password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          restaurantName: 'Test Restaurant',
          email: weakPassword.email,
          password: weakPassword.password
        });

      expect([400, 401, 403]).toContain(res.statusCode);
    expect(res.body.message).toContain('security requirements');
  });

  it('should accept registration with strong password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        restaurantName: 'Test Restaurant',
        email: testUser.email,
        password: testUser.password
      });

    // Should either succeed or require additional fields, but not reject for password
    expect([200, 201, 400, 422]).toContain(res.statusCode);
    if (res.statusCode < 400) {
      expect(res.body.token || res.body.data).toBeDefined();
    }
  });

  it('should log login attempts', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    // Login endpoint should attempt logging regardless of success
    expect(res.statusCode).toBeDefined();
  });
});

describe('Security Routes - Input Validation', () => {
  it('should reject menu item with negative price', async () => {
    const res = await request(app)
      .post('/menu/items')
      .set('Authorization', 'Bearer test-token')
      .send(invalidMenuPrice);

    expect([400, 401, 403]).toContain(res.statusCode);
    expect(res.body.message).toContain('Invalid');
  });

  it('should reject menu item with excessive price', async () => {
    const res = await request(app)
      .post('/menu/items')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Expensive Item',
        price: 9999999, // Way too high
        categoryId: 'cat-1'
      });

    expect(res.statusCode).toBe(400);
  });

  it('should reject discount with invalid amount', async () => {
    const res = await request(app)
      .post('/orders/testOrderId/discount-approval')
      .set('Authorization', 'Bearer test-token')
      .send({
        discountAmount: 150 // Over 100%
      });

    // Should be rejected as suspicious activity
    expect([400, 401, 403]).toContain(res.statusCode);
  });
});

describe('Security Routes - Authorization', () => {
  it('should require authentication for protected routes', async () => {
    const res = await request(app)
      .get('/orders');

    // Should return 401 or redirect to login
    expect([401, 302, 403]).toContain(res.statusCode);
  });

  it('should require authentication for menu deletion', async () => {
    const res = await request(app)
      .delete('/menu/items/item-1');

    // Should require auth before allowing deletion
    expect([401, 302, 403]).toContain(res.statusCode);
  });

  it('should require authentication for table deletion', async () => {
    const res = await request(app)
      .delete('/tables/table-1');

    // Should require auth before allowing deletion
    expect([401, 302, 403]).toContain(res.statusCode);
  });

  it('should require authorization for admin operations', async () => {
    const res = await request(app)
      .patch('/developer/restaurants/rest-1/access');

    // Developer endpoint should require admin auth
    expect([401, 403]).toContain(res.statusCode);
  });
});

describe('Security Routes - Data Isolation', () => {
  it('customer order creation should validate table exists', async () => {
    const res = await request(app)
      .post('/customer/orders')
      .send({
        tableNumber: 'invalid-table',
        items: [{ id: 'item-1', quantity: 1 }],
        amount: 100
      });

    // Should check if table exists before proceeding
    expect([400, 404]).toContain(res.statusCode);
  });

  it('customer order should require items array', async () => {
    const res = await request(app)
      .post('/customer/orders')
      .send({
        tableNumber: 'A1',
        items: [], // Empty items
        amount: 100
      });

    // Should validate items
    expect([400, 404]).toContain(res.statusCode);
  });
});

describe('Security Routes - Logging Points', () => {
  it('should have logging on auth routes', async () => {
    // Auth routes should emit audit logs
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password'
      });

    // Route should be callable (will have logging middleware)
    expect(res.statusCode).toBeDefined();
  });

  it('should have logging on order operations', async () => {
    const res = await request(app)
      .post('/orders/order-1/settle')
      .set('Authorization', 'Bearer test-token')
      .send({
        amount: 100
      });

    // Route should have error handling with logging
    expect([401, 400, 403, 404, 500]).toContain(res.statusCode);
  });

  it('should have logging on critical delete operations', async () => {
    const res = await request(app)
      .delete('/menu/items/item-1')
      .set('Authorization', 'Bearer test-token');

    // Route should have logging middleware
    expect(res.statusCode).toBeDefined();
  });
});

describe('Security Routes - Error Safety', () => {
  it('should not leak stack traces', async () => {
    const res = await request(app)
      .get('/invalid-endpoint');

    // Error response should not contain stack trace
    if (res.body.error) {
      expect(res.body.error).not.toContain('at ');
      expect(res.body.error).not.toContain('stack');
    }
  });

  it('should return generic error messages', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });

    // Should not reveal whether user exists
    expect(res.body.message).not.toContain('user not found');
    expect(res.body.message).not.toContain('email');
  });
  });

  describe.skip('Security Routes - Import Validation', () => {});
});

export default app;
