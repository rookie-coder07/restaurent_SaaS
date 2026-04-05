import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

test.describe('Table Coherence', () => {
  test('manager table changes reflect in the POS tables workspace', async ({ page }) => {
    const tables = [
      { id: 'table-2', table_number: 2, status: 'occupied', capacity: 4, location: 'main' },
      { id: 'table-5', table_number: 5, status: 'available', capacity: 4, location: 'main' },
      { id: 'table-6', table_number: 6, status: 'available', capacity: 4, location: 'main' },
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

      if (pathname.endsWith('/v1/menu/items') && method === 'GET') {
        return jsonSuccess({ items: [{ id: 'item-1', name: 'Paneer Tikka', price: 170, category_id: 'cat-1', status: 'active' }] });
      }

      if (pathname.endsWith('/v1/menu/categories') && method === 'GET') {
        return jsonSuccess({ categories: [{ id: 'cat-1', name: 'Starters' }] });
      }

      if (pathname.endsWith('/v1/orders/inbox/online') && method === 'GET') {
        return jsonSuccess([]);
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

      if (pathname.endsWith('/v1/tables/table-6') && method === 'PUT') {
        const targetTable = tables.find((table) => table.id === 'table-6');
        targetTable.status = body?.status || targetTable.status;
        return jsonSuccess({
          id: targetTable.id,
          tableNumber: targetTable.table_number,
          seatCapacity: targetTable.capacity,
          location: targetTable.location,
          status: targetTable.status,
        });
      }

      if (pathname.endsWith('/v1/orders/order-2') && method === 'PUT') {
        openBills[0] = {
          ...openBills[0],
          tableId: body?.tableId || openBills[0].tableId,
          tableNumber: body?.tableId === 'table-5' ? 5 : openBills[0].tableNumber,
        };
        tables.find((table) => table.id === 'table-2').status = 'available';
        tables.find((table) => table.id === 'table-5').status = 'occupied';

        return jsonSuccess(openBills[0]);
      }

      if (pathname.endsWith('/v1/orders/table/table-5/active') && method === 'GET') {
        return jsonSuccess(openBills.find((order) => order.tableId === 'table-5') || null);
      }

      if (pathname.endsWith('/v1/orders/table/table-6/active') && method === 'GET') {
        return jsonSuccess(null);
      }

      return jsonSuccess({});
    });

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();

    await page.goto('/manager/tables');
    await page.getByRole('button', { name: /Table 6 open 0 active orders/i }).click();
    await page.getByRole('button', { name: /^Close Table$/i }).click();
    await expect(page.getByText(/Table closed\./i)).toBeVisible();
    await page.goto('/manager/tables');

    await page.getByRole('button', { name: /Table 2 busy 1 active orders/i }).click();
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Table 5' }) }).selectOption('table-5');
    await page.getByRole('button', { name: /^Transfer Table$/i }).click();
    await expect(page.getByText(/active bills moved/i)).toBeVisible();

    await page.goto('/pos/login');
    await page.getByLabel(/Email/i).fill('pos@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open POS Portal/i }).click();

    await page.goto('/pos/tables');
    await page.getByRole('button', { name: /Table 5 in use/i }).click();
    await expect(page.getByRole('heading', { name: /ORD-20260405-002/i })).toBeVisible();

    await page.goto('/pos/tables');
    await page.getByRole('button', { name: /Table 6 closed/i }).click();
    await expect(page.getByText(/Closed by manager/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Billing/i })).toBeDisabled();
  });
});
