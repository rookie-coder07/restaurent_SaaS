import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

async function closeTopModal(page) {
  await page.locator('div.fixed.inset-0').last().locator('div.sticky').getByRole('button').click();
}

test.describe('Table Merge Flow', () => {
  test('blocks merging running tables and reflects merged names across manager and POS', async ({ page }) => {
    const tables = [
      { id: 'table-2', table_number: 2, status: 'occupied', capacity: 4, location: 'main' },
      { id: 'table-5', table_number: 5, status: 'available', capacity: 4, location: 'main' },
      { id: 'table-6', table_number: 6, status: 'available', capacity: 4, location: 'main' },
      { id: 'table-7', table_number: 7, status: 'available', capacity: 4, location: 'main' },
    ];

    const openBills = [
      {
        id: 'order-2',
        displayOrderNumber: 'ORD-20260405-002',
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash',
        tableId: 'table-2',
        tableNumber: 2,
        totalAmount: 340,
        createdAt: '2026-04-05T09:00:00.000Z',
        updatedAt: '2026-04-05T09:10:00.000Z',
        items: [{ menuItemId: 'item-1', name: 'Paneer Tikka', quantity: 2, unitPrice: 170 }],
      },
    ];

    await mockApi(page, async ({ url, method, body }) => {
      const { pathname } = url;

      if ((pathname.endsWith('/v1/auth/login') || pathname.endsWith('/v1/auth/staff/login')) && method === 'POST') {
        if (String(body?.email || '').includes('manager')) {
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
          });
        }

        return jsonSuccess({
          accessToken: createTestJwt({ role: 'staff', restaurantId: 'rest-1' }),
          refreshToken: createTestJwt({ role: 'staff', restaurantId: 'rest-1', type: 'refresh' }),
          user: {
            id: 'staff-1',
            name: 'POS Staff',
            email: 'pos@restaurant.com',
            role: 'staff',
            restaurantId: 'rest-1',
          },
        });
      }

      if (pathname.endsWith('/v1/restaurants/staff') && method === 'GET') {
        return jsonSuccess({
          staff: [{ id: 'staff-1', name: 'POS Staff', email: 'pos@restaurant.com', role: 'staff' }],
          total: 1,
          limit: 100,
          skip: 0,
        });
      }

      if (pathname.endsWith('/v1/orders/open') && method === 'GET') {
        return jsonSuccess(openBills);
      }

      if (pathname.endsWith('/v1/tables') && method === 'GET') {
        return jsonSuccess({
          tables: tables.map((table) => ({
            id: table.id,
            tableNumber: table.table_number,
            table_number: table.table_number,
            seatCapacity: table.capacity,
            capacity: table.capacity,
            location: table.location,
            status: table.status,
          })),
          total: tables.length,
          limit: 200,
          skip: 0,
        });
      }

      if (pathname.endsWith('/v1/menu/items') && method === 'GET') {
        return jsonSuccess({ items: [] });
      }

      if (pathname.endsWith('/v1/menu/categories') && method === 'GET') {
        return jsonSuccess({ categories: [] });
      }

      if (pathname.endsWith('/v1/orders/inbox/online') && method === 'GET') {
        return jsonSuccess([]);
      }

      return jsonSuccess({});
    });

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();

    await page.goto('/manager/tables');

    await page.getByRole('button', { name: /Table 2 busy 1 active orders/i }).click();
    await expect(page.getByText(/This table has a running order, so it cannot be merged right now\./i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Merge Picker/i })).toBeDisabled();
    await closeTopModal(page);

    await page.getByRole('button', { name: /Table 5 open 0 active orders/i }).click();
    await page.getByRole('button', { name: /Open Merge Picker/i }).click();
    await expect(page.getByText(/Choose the idle tables you want to merge with Table 5/i)).toBeVisible();
    await page.getByRole('button', { name: /^Table 6 open$/i }).click();
    await page.getByRole('button', { name: /Merge Selected Tables/i }).click();
    await expect(page.getByText(/Tables merged successfully\./i)).toBeVisible();
    await closeTopModal(page);

    await page.getByRole('button', { name: /Table 5/i }).click();
    await page.getByRole('button', { name: /Open Merge Picker/i }).click();
    await expect(page.getByText(/Choose the idle tables you want to merge with Table 5 \+ 6/i)).toBeVisible();
    await page.getByRole('button', { name: /^Table 7 open$/i }).click();
    await page.getByRole('button', { name: /Merge Selected Tables/i }).click();
    await expect(page.getByText(/Tables merged successfully\./i)).toBeVisible();
    await closeTopModal(page);

    await expect(page.getByText('Table 5 + 6 + 7')).toBeVisible();
    await expect(page.getByRole('button', { name: /Table 6 open 0 active orders/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Table 7 open 0 active orders/i })).toHaveCount(0);

    await page.goto('/pos/login');
    await page.getByLabel(/Email/i).fill('pos@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open POS Portal/i }).click();

    await page.goto('/pos/tables');
    await expect(page.getByText('Table 5 + 6 + 7')).toBeVisible();
    await expect(page.getByRole('button', { name: /Table 6 available/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Table 7 available/i })).toHaveCount(0);
  });
});
