import { test, expect } from '@playwright/test';
import { jsonSuccess, mockApi } from './helpers/mockApi.js';

test.describe('POS Table Recall Smoke', () => {
  test('staff can log into POS and reopen an active table bill', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', (message) => {
      consoleMessages.push(message.text());
    });

    const menuItems = [
      { id: 'item-biryani', name: 'Chicken Biryani', price: 220, category_id: 'cat-main', status: 'active' },
      { id: 'item-coke', name: 'Coke', price: 40, category_id: 'cat-drinks', status: 'active' },
    ];
    const categories = [
      { id: 'cat-main', name: 'Main Course' },
      { id: 'cat-drinks', name: 'Drinks' },
    ];
    const tables = [
      { id: 'table-1', table_number: 1, status: 'available', capacity: 4, location: 'main' },
      { id: 'table-4', table_number: 4, status: 'occupied', capacity: 4, location: 'main' },
    ];
    const recalledOrder = {
      id: 'order-4',
      status: 'pending',
      tableId: 'table-4',
      tableNumber: 4,
      totalAmount: 260,
      displayOrderNumber: 'ORD-20260328-004',
      items: [
        { menuItemId: 'item-biryani', quantity: 1, unitPrice: 220, name: 'Chicken Biryani' },
        { menuItemId: 'item-coke', quantity: 1, unitPrice: 40, name: 'Coke' },
      ],
    };

    await mockApi(page, async ({ url, method }) => {
      const { pathname } = url;

      if (pathname.endsWith('/v1/auth/staff/login') && method === 'POST') {
        return jsonSuccess({
          accessToken: 'pos-token',
          refreshToken: 'pos-refresh',
          user: {
            id: 'staff-1',
            name: 'POS Staff',
            email: 'pos@restaurant.com',
            role: 'staff',
            restaurantId: 'rest-1',
          },
        }, 'Logged in');
      }

      if (pathname.endsWith('/v1/menu/items') && method === 'GET') {
        return jsonSuccess({ items: menuItems });
      }

      if (pathname.endsWith('/v1/menu/categories') && method === 'GET') {
        return jsonSuccess({ categories });
      }

      if (pathname.endsWith('/v1/tables') && method === 'GET') {
        return jsonSuccess({ tables, total: tables.length, limit: 200, skip: 0 });
      }

      if (pathname.endsWith('/v1/orders/table/table-4/active') && method === 'GET') {
        return jsonSuccess(recalledOrder, 'Active table order fetched successfully');
      }

      if (pathname.endsWith('/v1/orders/table/table-1/active') && method === 'GET') {
        return jsonSuccess(null, 'No active table order found');
      }

      return jsonSuccess({});
    });

    await page.goto('/pos/login');
    await page.getByLabel(/Email/i).fill('pos@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open POS Portal/i }).click();

    await expect(page).toHaveURL(/\/pos$/);
    await page.getByRole('button', { name: /Dine-In/i }).click();
    await page.getByRole('button', { name: /Table 4/i }).click();

    await expect(page.getByText(/Running Bill Reopened/i)).toBeVisible();
    await expect(page.getByText('ORD-20260328-004')).toBeVisible();
    await expect(
      page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: /Current Bill/i }) })
        .getByText('Chicken Biryani', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /SAVE & UPDATE BILL/i })).toBeVisible();

    expect(consoleMessages.some((message) => message.includes('Throttling navigation'))).toBeFalsy();
  });
});
