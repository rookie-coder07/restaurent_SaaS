import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

test.describe('Phase 0 Smoke', () => {
  test('kitchen staff can log in and advance a KOT ticket', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', (message) => {
      consoleMessages.push(message.text());
    });

    let activeOrders = [
      {
        id: 'order-kot-1',
        status: 'pending',
        createdAt: '2026-03-28T08:30:00.000Z',
        tableNumber: 6,
        displayOrderNumber: 'ORD-20260328-006',
        items: [{ menuItemId: 'item-1', quantity: 2, name: 'Paneer Fried Rice' }],
      },
    ];

    await mockApi(page, async ({ url, method, body }) => {
      const { pathname } = url;

      if (pathname.endsWith('/v1/auth/staff/login') && method === 'POST') {
        return jsonSuccess({
          accessToken: createTestJwt({ role: 'kitchen_staff', restaurantId: 'rest-1' }),
          refreshToken: createTestJwt({ role: 'kitchen_staff', restaurantId: 'rest-1', type: 'refresh' }),
          user: {
            id: 'kitchen-1',
            name: 'Kitchen Staff',
            email: 'kot@restaurant.com',
            role: 'kitchen_staff',
            restaurantId: 'rest-1',
          },
        }, 'Logged in');
      }

      if (pathname.endsWith('/v1/orders/active') && method === 'GET') {
        return jsonSuccess(activeOrders, 'Active orders fetched successfully');
      }

      if (pathname.endsWith('/v1/orders/order-kot-1/status') && method === 'PATCH') {
        activeOrders = activeOrders.map((order) =>
          order.id === 'order-kot-1' ? { ...order, status: body.status } : order
        );
        return jsonSuccess({ ...activeOrders[0] }, 'Order status updated successfully');
      }

      return jsonSuccess({});
    });

    const accessToken = createTestJwt({ role: 'kitchen_staff', restaurantId: 'rest-1' });
    const refreshToken = createTestJwt({ role: 'kitchen_staff', restaurantId: 'rest-1', type: 'refresh' });

    await page.addInitScript(({ seededAccessToken, seededRefreshToken }) => {
      window.sessionStorage.setItem(
        'portal-auth:kot',
        JSON.stringify({
          accessToken: seededAccessToken,
          refreshToken: seededRefreshToken,
          user: {
            id: 'kitchen-1',
            name: 'Kitchen Staff',
            email: 'kot@restaurant.com',
            role: 'kitchen_staff',
            restaurantId: 'rest-1',
          },
        })
      );
    }, { seededAccessToken: accessToken, seededRefreshToken: refreshToken });

    await page.goto('/kot');

    await expect(page).toHaveURL(/\/kot$/);
    await expect(page.getByText('#06')).toBeVisible();
    await page.getByRole('button', { name: /Start Preparing/i }).click();
    await expect(page.getByText(/Order moved to preparing\./i)).toBeVisible();

    expect(consoleMessages.some((message) => message.includes('Throttling navigation'))).toBeFalsy();
  });

  test('admin can create staff access and see it in the staff list', async ({ page }) => {
    let staffUsers = [];

    await mockApi(page, async ({ url, method, body }) => {
      const { pathname, searchParams } = url;

      if (pathname.endsWith('/v1/auth/login') && method === 'POST') {
        return jsonSuccess({
          accessToken: createTestJwt({ role: 'owner', restaurantId: 'rest-1' }),
          refreshToken: createTestJwt({ role: 'owner', restaurantId: 'rest-1', type: 'refresh' }),
          restaurant: {
            id: 'rest-1',
            restaurantId: 'rest-1',
            name: 'Test Restaurant',
            email: 'test@example.com',
            role: 'owner',
          },
        }, 'Logged in');
      }

      if (pathname.endsWith('/v1/restaurants/profile') && method === 'GET') {
        return jsonSuccess({
          id: 'rest-1',
          name: 'Test Restaurant',
          role: 'owner',
        });
      }

      if (pathname.endsWith('/v1/restaurants/staff') && method === 'GET') {
        const requestedRole = searchParams.get('role');
        const filtered = requestedRole ? staffUsers.filter((member) => member.role === requestedRole) : staffUsers;
        return jsonSuccess({ staff: filtered, total: filtered.length, limit: 100, skip: 0 });
      }

      if (pathname.endsWith('/v1/restaurants/staff') && method === 'POST') {
        const createdStaff = {
          id: `staff-${staffUsers.length + 1}`,
          name: body.name,
          email: body.email,
          phone: body.phone,
          role: body.role,
          isActive: true,
        };
        staffUsers = [...staffUsers, createdStaff];
        return jsonSuccess(createdStaff, 'Staff user created successfully', 201);
      }

      if (pathname.endsWith('/v1/orders') && method === 'GET') {
        return jsonSuccess({ items: [], total: 0, limit: 50, skip: 0 });
      }

      return jsonSuccess({});
    });

    await page.goto('/admin/login');
    await page.getByLabel(/Email/i).fill('test@example.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Admin Portal/i }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/staff');
    await expect(page.getByRole('heading', { name: /Create POS and KOT staff access/i })).toBeVisible();

    await page.getByRole('button', { name: /Add POS Staff/i }).click();
    await page.getByLabel(/^Name$/i).fill('Waiter One');
    await page.getByLabel(/^Email$/i).fill('waiter1@restaurant.com');
    await page.getByLabel(/^Phone$/i).fill('9876543210');
    await page.getByLabel(/Temporary Password/i).fill('Temp123@456');
    await page.getByRole('button', { name: /Create Login/i }).click();

    await expect(page.getByText(/POS Staff login created for waiter1@restaurant.com/i)).toBeVisible();
    await expect(page.getByText('waiter1@restaurant.com', { exact: true })).toBeVisible();
  });
});
