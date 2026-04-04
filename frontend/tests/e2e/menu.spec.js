import { test, expect } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

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

  test('staff can settle an active bill and lands on the in-app bill view', async ({ page }) => {
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
      { id: 'table-4', table_number: 4, status: 'occupied', capacity: 4, location: 'main' },
    ];
    const activeOrder = {
      id: 'order-4',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      tableId: 'table-4',
      tableNumber: 4,
      totalAmount: 260,
      displayOrderNumber: 'ORD-20260405-004',
      createdAt: '2026-04-05T08:30:00.000Z',
      items: [
        { menuItemId: 'item-biryani', quantity: 1, unitPrice: 220, name: 'Chicken Biryani' },
        { menuItemId: 'item-coke', quantity: 1, unitPrice: 40, name: 'Coke' },
      ],
    };
    const settledOrder = {
      ...activeOrder,
      status: 'completed',
      paymentStatus: 'paid',
      settlement: {
        method: 'cash',
        amountReceived: 273,
        changeDue: 0,
        billing: {
          invoiceNumber: 'INV-20260405-000004',
          invoiceDate: '2026-04-05T08:45:00.000Z',
          subtotal: 260,
          orderDiscountAmount: 0,
          managerDiscountPercent: 0,
          managerDiscountAmount: 0,
          taxableAmount: 260,
          gstPercent: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          cgstAmount: 6.5,
          sgstAmount: 6.5,
          packingCharge: 0,
          serviceCharge: 0,
          deliveryCharge: 0,
          chargesTotal: 0,
          loyaltyRedeemedAmount: 0,
          loyaltyRedeemedPoints: 0,
          roundOff: 0,
          grandTotal: 273,
          paymentMode: 'cash',
          paidAmount: 273,
          cashierName: 'POS Staff',
        },
      },
      billing: {
        invoiceNumber: 'INV-20260405-000004',
        invoiceDate: '2026-04-05T08:45:00.000Z',
        subtotal: 260,
        orderDiscountAmount: 0,
        managerDiscountPercent: 0,
        managerDiscountAmount: 0,
        taxableAmount: 260,
        gstPercent: 5,
        cgstRate: 2.5,
        sgstRate: 2.5,
        cgstAmount: 6.5,
        sgstAmount: 6.5,
        packingCharge: 0,
        serviceCharge: 0,
        deliveryCharge: 0,
        chargesTotal: 0,
        loyaltyRedeemedAmount: 0,
        loyaltyRedeemedPoints: 0,
        roundOff: 0,
        grandTotal: 273,
        paymentMode: 'cash',
        paidAmount: 273,
        cashierName: 'POS Staff',
      },
    };

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

      if (pathname.endsWith('/v1/restaurants/profile') && method === 'GET') {
        return jsonSuccess({
          id: 'rest-1',
          name: 'Test Restaurant',
          address: 'MG Road, Bengaluru',
          phone: '9876543210',
          gstNumber: '29ABCDE1234F1Z5',
          enableGST: true,
          defaultGSTPercent: 5,
          role: 'owner',
        });
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

      if (pathname.endsWith('/v1/orders/inbox/online') && method === 'GET') {
        return jsonSuccess([]);
      }

      if (pathname.endsWith('/v1/orders/table/table-4/active') && method === 'GET') {
        return jsonSuccess(activeOrder, 'Active table order fetched successfully');
      }

      if (pathname.endsWith('/v1/orders/open') && method === 'GET') {
        return jsonSuccess([activeOrder]);
      }

      if (pathname.endsWith('/v1/orders/order-4/settle') && method === 'POST') {
        return jsonSuccess(settledOrder, 'Order settled successfully');
      }

      if (pathname.endsWith('/v1/orders/order-4') && method === 'GET') {
        return jsonSuccess(settledOrder, 'Order fetched successfully');
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

    await page.getByRole('button', { name: /Use Exact/i }).click();
    await page.getByRole('button', { name: /^SETTLE BILL$/i }).click();

    await expect(page).toHaveURL(/\/pos\/bill\/order-4$/);
    await expect(page.getByRole('heading', { name: /ORD-20260405-004/i })).toBeVisible();
    await expect(page.getByText('INV-20260405-000004')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Bill breakdown/i })).toBeVisible();
    await expect(page.getByText('Chicken Biryani', { exact: true })).toBeVisible();
    await expect(page.getByText(/CGST \(2.5%\)/i)).toBeVisible();
    await expect(page.getByText('Final Amount')).toBeVisible();
    await expect(page.getByRole('button', { name: /Print Bill/i })).toBeVisible();

    expect(consoleMessages.some((message) => /no bill data/i.test(message))).toBeFalsy();
  });
});
