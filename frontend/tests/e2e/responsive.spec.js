import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
];

function trackClientIssues(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  return { pageErrors, consoleErrors };
}

async function expectNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 1;
  });

  expect(hasOverflow, `${label} should not overflow horizontally`).toBe(false);
}

async function installManagerMocks(page) {
  await mockApi(page, async ({ url, method }) => {
    const { pathname } = url;

    if ((pathname.endsWith('/v1/auth/login') || pathname.endsWith('/v1/auth/staff/login')) && method === 'POST') {
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
      return jsonSuccess({ staff: [], total: 0, limit: 100, skip: 0 });
    }

    if (pathname.endsWith('/v1/orders') && method === 'GET') {
      return jsonSuccess({ items: [], total: 0, limit: 150, skip: 0 });
    }

    if (pathname.endsWith('/v1/orders/open') && method === 'GET') {
      return jsonSuccess([]);
    }

    if (pathname.endsWith('/v1/tables') && method === 'GET') {
      return jsonSuccess({ tables: [] });
    }

    if (pathname.endsWith('/v1/kitchen/orders') && method === 'GET') {
      return jsonSuccess([]);
    }

    if (pathname.endsWith('/v1/inventory/summary') && method === 'GET') {
      return jsonSuccess({ lowStockCount: 0, lowStockItems: [] });
    }

    if (pathname.endsWith('/v1/inventory/items') && method === 'GET') {
      return jsonSuccess({ items: [] });
    }

    return jsonSuccess({});
  });
}

async function installPosMocks(page) {
  await mockApi(page, async ({ url, method }) => {
    const { pathname } = url;

    if (pathname.endsWith('/v1/auth/staff/login') && method === 'POST') {
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
      }, 'Logged in');
    }

    if (pathname.endsWith('/v1/menu/items') && method === 'GET') {
      return jsonSuccess({
        items: [{ id: 'item-1', name: 'Masala Dosa', price: 120, category_id: 'cat-1', status: 'active' }],
      });
    }

    if (pathname.endsWith('/v1/menu/categories') && method === 'GET') {
      return jsonSuccess({ categories: [{ id: 'cat-1', name: 'Breakfast' }] });
    }

    if (pathname.endsWith('/v1/tables') && method === 'GET') {
      return jsonSuccess({
        tables: [{ id: 'table-1', table_number: 1, status: 'available', capacity: 4, location: 'main' }],
        total: 1,
        limit: 200,
        skip: 0,
      });
    }

    if (pathname.endsWith('/v1/orders/open') && method === 'GET') {
      return jsonSuccess([]);
    }

    if (pathname.endsWith('/v1/orders/inbox/online') && method === 'GET') {
      return jsonSuccess([]);
    }

    if (pathname.endsWith('/v1/restaurants/profile') && method === 'GET') {
      return jsonSuccess({
        id: 'rest-1',
        name: 'Test Restaurant',
        role: 'owner',
      });
    }

    return jsonSuccess({});
  });
}

test.describe('Responsive Stability', () => {
  test('public entry screens stay usable across mobile, tablet, and desktop', async ({ page }) => {
    const { pageErrors, consoleErrors } = trackClientIssues(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto('/');
      await expect(page.getByRole('link', { name: /Admin Login/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `home (${viewport.name})`);

      await page.goto('/manager/login');
      await expect(page.getByRole('button', { name: /Open Manager Portal/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `manager login (${viewport.name})`);

      await page.goto('/pos/login');
      await expect(page.getByRole('button', { name: /Open POS Portal/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `pos login (${viewport.name})`);
    }

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('manager and POS workspaces stay readable across key breakpoints', async ({ page }) => {
    const { pageErrors, consoleErrors } = trackClientIssues(page);

    for (const viewport of VIEWPORTS) {
      await page.goto('/');
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await installManagerMocks(page);
      await page.goto('/manager/login');
      await page.getByLabel(/Email/i).fill('manager@restaurant.com');
      await page.getByLabel(/Password/i).fill('Test123@456');
      await page.getByRole('button', { name: /Open Manager Portal/i }).click();
      await expect(page).toHaveURL(/\/manager$/);
      await expect(page.getByRole('heading', { name: /Daily restaurant operations at a glance/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `manager dashboard (${viewport.name})`);

      await page.goto('/');
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await installPosMocks(page);
      await page.goto('/pos/login');
      await page.getByLabel(/Email/i).fill('pos@restaurant.com');
      await page.getByLabel(/Password/i).fill('Test123@456');
      await page.getByRole('button', { name: /Open POS Portal/i }).click();
      await expect(page).toHaveURL(/\/pos$/);
      await expect(page.getByRole('heading', { name: /Choose service type/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `pos workspace (${viewport.name})`);
    }

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
