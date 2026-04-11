import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

test.describe('Manager Portal Smoke', () => {
  test('manager login redirects into the operations portal and owner routes stay blocked', async ({ page }) => {
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
            {
              id: 'ord-2',
              displayOrderNumber: 'ORD-20260404-002',
              status: 'pending',
              paymentStatus: 'unpaid',
              tableId: 'table-2',
              tableNumber: 7,
              totalAmount: 560,
              createdAt: '2026-04-04T08:20:00.000Z',
              items: [{ name: 'Fried Rice', quantity: 1, unitPrice: 180 }],
            },
          ],
          total: 2,
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

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();

    await expect(page).toHaveURL(/\/manager$/);
    await expect(page.getByRole('heading', { name: /Daily restaurant operations at a glance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Tables$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Orders$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Kitchen$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Waiters$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Inventory$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Bills$/i })).toBeVisible();

    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/manager$/);

    await page.goto('/manager/orders');
    await expect(page.getByRole('heading', { name: /Control QR, POS, and waiter orders in one place/i })).toBeVisible();

    await page.goto('/manager/tables');
    await expect(page.getByRole('heading', { name: /Open, close, assign, transfer, and merge tables/i })).toBeVisible();

    await page.goto('/manager/bills');
    await expect(page.getByRole('heading', { name: /Track live bills, unpaid tables, and manager-approved discounts/i })).toBeVisible();
  });
});
