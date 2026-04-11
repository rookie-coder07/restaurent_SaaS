import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

function createFailureCollectors(page) {
  const pageErrors = [];
  const requestFailures = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText || 'unknown error';
    if (errorText === 'net::ERR_ABORTED') {
      return;
    }

    requestFailures.push(`${request.method()} ${request.url()} :: ${errorText}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, requestFailures, consoleErrors };
}

async function installManagerMocks(page) {
  await mockApi(page, async ({ url, method }) => {
    const { pathname } = url;

    if (pathname.endsWith('/v1/auth/login') && method === 'POST') {
      return jsonSuccess({
        accessToken: createTestJwt({ role: 'manager', restaurantId: 'rest-1' }),
        refreshToken: createTestJwt({ role: 'manager', restaurantId: 'rest-1', type: 'refresh' }),
        restaurant: {
          id: 'rest-1',
          restaurantId: 'rest-1',
          name: 'Ops Restaurant',
          email: 'manager@restaurant.com',
          role: 'manager',
        },
      }, 'Logged in');
    }

    if (pathname.endsWith('/v1/restaurants/staff') && method === 'GET') {
      return jsonSuccess({
        staff: [
          {
            id: 'waiter-1',
            name: 'Aarav',
            email: 'aarav@restaurant.com',
            role: 'staff',
          },
        ],
        total: 1,
        limit: 100,
        skip: 0,
      });
    }

    if (pathname.endsWith('/v1/orders') && method === 'GET') {
      return jsonSuccess({
        items: [
          {
            id: 'ord-1',
            displayOrderNumber: 'ORD-20260404-001',
            status: 'preparing',
            paymentStatus: 'unpaid',
            tableId: 'table-1',
            tableNumber: 4,
            totalAmount: 740,
            createdAt: '2026-04-04T08:00:00.000Z',
            items: [{ name: 'Paneer Tikka', quantity: 2, unitPrice: 220 }],
          },
        ],
        total: 1,
        limit: 150,
        skip: 0,
      });
    }

    if (pathname.endsWith('/v1/orders/open') && method === 'GET') {
      return jsonSuccess([
        {
          id: 'ord-1',
          displayOrderNumber: 'ORD-20260404-001',
          status: 'preparing',
          paymentStatus: 'unpaid',
          tableId: 'table-1',
          tableNumber: 4,
          totalAmount: 740,
          createdAt: '2026-04-04T08:00:00.000Z',
          items: [{ name: 'Paneer Tikka', quantity: 2, unitPrice: 220 }],
        },
      ]);
    }

    if (pathname.endsWith('/v1/tables') && method === 'GET') {
      return jsonSuccess({
        tables: [
          { id: 'table-1', tableNumber: 4, seatCapacity: 4, location: 'Main Hall', status: 'occupied' },
          { id: 'table-2', tableNumber: 7, seatCapacity: 6, location: 'Window', status: 'available' },
        ],
      });
    }

    if (pathname.endsWith('/v1/kitchen/orders') && method === 'GET') {
      return jsonSuccess([
        {
          id: 'ticket-1',
          orderId: 'ord-1',
          displayOrderNumber: 'ORD-20260404-001',
          tableNumber: 4,
          status: 'pending',
          createdAt: '2026-04-04T08:00:00.000Z',
          items: [{ name: 'Paneer Tikka', quantity: 2 }],
        },
      ]);
    }

    if (pathname.endsWith('/v1/inventory/summary') && method === 'GET') {
      return jsonSuccess({
        lowStockCount: 1,
        lowStockItems: [{ id: 'inv-1', name: 'Paneer', quantity: 2, unit: 'kg', isLowStock: true }],
      });
    }

    if (pathname.endsWith('/v1/inventory/items') && method === 'GET') {
      return jsonSuccess({
        items: [{ id: 'inv-1', name: 'Paneer', quantity: 2, unit: 'kg', threshold: 5, isLowStock: true }],
      });
    }

    return jsonSuccess({});
  });
}

test.describe('Route Crawl Smoke', () => {
  test('public entry routes render without client-side failures', async ({ page }) => {
    const { pageErrors, requestFailures, consoleErrors } = createFailureCollectors(page);
    const publicRoutes = ['/', '/admin/login', '/manager/login', '/register'];

    for (const route of publicRoutes) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      await expect(page).not.toHaveURL(/\/404$/);
    }

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(requestFailures, `request failures:\n${requestFailures.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('manager routes stay reachable after login crawl', async ({ page }) => {
    const { pageErrors, requestFailures, consoleErrors } = createFailureCollectors(page);
    const managerRoutes = [
      '/manager',
      '/manager/orders',
      '/manager/tables',
      '/manager/kitchen',
      '/manager/waiters',
      '/manager/inventory',
      '/manager/bills',
    ];

    await installManagerMocks(page);

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();
    await expect(page).toHaveURL(/\/manager$/);

    for (const route of managerRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`));
      await expect(page.getByRole('heading').first()).toBeVisible();
    }

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(requestFailures, `request failures:\n${requestFailures.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
