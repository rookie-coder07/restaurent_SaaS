import { expect, test } from '@playwright/test';
import { createTestJwt, jsonSuccess, mockApi } from './helpers/mockApi.js';

test.describe('Manager Production Hardening', () => {
  test('dashboard quick add order sends manager to takeaway orders', async ({ page }) => {
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
        });
      }

      if (pathname.endsWith('/v1/orders') && method === 'GET') {
        return jsonSuccess({ items: [], total: 0, limit: 150, skip: 0 });
      }

      if (pathname.endsWith('/v1/tables') && method === 'GET') {
        return jsonSuccess({ tables: [], total: 0, limit: 200, skip: 0 });
      }

      if (pathname.endsWith('/v1/kitchen/orders') && method === 'GET') {
        return jsonSuccess([]);
      }

      if (pathname.endsWith('/v1/inventory/summary') && method === 'GET') {
        return jsonSuccess({ lowStockCount: 0, lowStockItems: [] });
      }

      if (pathname.endsWith('/v1/restaurants/staff') && method === 'GET') {
        return jsonSuccess({ staff: [], total: 0, limit: 100, skip: 0 });
      }

      return jsonSuccess({});
    });

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();

    await page.getByRole('link', { name: /Quick Add Order/i }).click();
    await expect(page).toHaveURL(/\/manager\/takeaway-orders$/);
    await expect(page.getByRole('heading', { name: /Fast Billing/i })).toBeVisible();
  });

  test('manager can send takeaway to kitchen and settle it without breaking flow', async ({ page }) => {
    const draftOrder = {
      id: 'takeaway-1',
      displayOrderNumber: '#011',
      orderType: 'takeaway',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      tableNumber: null,
      createdAt: '2026-04-06T12:10:00.000Z',
      items: [
        { menuItemId: 'item-fries', name: 'French Fries', quantity: 2, unitPrice: 85 },
      ],
      totalAmount: 170,
      kitchenTickets: [],
    };

    const kitchenTicket = {
      id: 'ticket-1',
      sequence: 3,
      displayOrderNumber: '#011',
      tableNumber: 'Walk-in',
      createdAt: '2026-04-06T12:12:00.000Z',
      items: [{ name: 'French Fries', quantity: 2 }],
      type: 'send',
      status: 'pending',
    };

    const settledOrder = {
      ...draftOrder,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      billing: {
        invoiceNumber: 'INV-1001',
        paymentMode: 'cash',
        paidAmount: 179,
        subtotal: 170,
        cgstRate: 2.5,
        sgstRate: 2.5,
        cgstAmount: 4.25,
        sgstAmount: 4.25,
        grandTotal: 179,
      },
      settlement: {
        amountReceived: 179,
      },
    };

    await page.addInitScript(() => {
      window.print = () => {};
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = function patchedCreateElement(tagName, options) {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'iframe') {
          Object.defineProperty(element, 'contentWindow', {
            configurable: true,
            value: {
              focus: () => {},
              print: () => {},
            },
          });
        }
        return element;
      };
    });

    await mockApi(page, async ({ url, method, body }) => {
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
          user: {
            id: 'manager-1',
            name: 'Manager',
            email: 'manager@restaurant.com',
            role: 'manager',
            restaurantId: 'rest-1',
          },
        });
      }

      if (pathname.endsWith('/v1/restaurants/profile') && method === 'GET') {
        return jsonSuccess({
          id: 'rest-1',
          name: 'Ops Restaurant',
          printing: {
            provider: 'browser',
            autoPrintBill: false,
            autoPrintKOT: false,
            receiptWidthMm: 80,
          },
          defaultCGSTPercent: 2.5,
          defaultSGSTPercent: 2.5,
        });
      }

      if (pathname.endsWith('/v1/menu/items') && method === 'GET') {
        return jsonSuccess({
          items: [
            {
              id: 'item-fries',
              name: 'French Fries',
              description: 'Crispy fries',
              price: 85,
              category_id: 'cat-1',
              status: 'active',
            },
          ],
        });
      }

      if (pathname.endsWith('/v1/menu/categories') && method === 'GET') {
        return jsonSuccess({
          categories: [{ id: 'cat-1', name: 'Snacks' }],
        });
      }

      if (pathname.endsWith('/v1/orders') && method === 'POST') {
        draftOrder.items = body.items;
        draftOrder.totalAmount = body.totalAmount;
        draftOrder.customerName = body.customerName;
        draftOrder.customerPhone = body.customerPhone;
        return jsonSuccess(draftOrder);
      }

      if (pathname.endsWith('/v1/orders/takeaway-1/send-to-kitchen') && method === 'POST') {
        draftOrder.kitchenTickets = [kitchenTicket];
        return jsonSuccess({ order: draftOrder, ticket: kitchenTicket });
      }

      if (pathname.endsWith('/v1/orders/takeaway-1') && method === 'GET') {
        return jsonSuccess(draftOrder.kitchenTickets.length ? settledOrder : { ...draftOrder, kitchenTickets: [kitchenTicket] });
      }

      if (pathname.endsWith('/v1/orders/takeaway-1/settle') && method === 'POST') {
        settledOrder.settlement.amountReceived = Number(body?.amountReceived || 0);
        settledOrder.billing.paidAmount = Number(body?.amountReceived || 0);
        settledOrder.paymentMethod = body?.paymentMethod || 'cash';
        settledOrder.billing.paymentMode = body?.paymentMethod || 'cash';
        return jsonSuccess(settledOrder);
      }

      return jsonSuccess({});
    });

    await page.goto('/manager/login');
    await page.getByLabel(/Email/i).fill('manager@restaurant.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Manager Portal/i }).click();

    await page.goto('/manager/takeaway-orders');
    const friesMenuButton = page.getByRole('button', { name: /French Fries\s+Crispy fries/i });
    await friesMenuButton.click();
    await friesMenuButton.click();

    await page.getByRole('button', { name: /Send to Kitchen/i }).click();
    await expect(page.getByText(/sent to kitchen/i)).toBeVisible();

    await page.getByRole('button', { name: /^Settle Bill$/i }).click();
    await expect(page.getByRole('heading', { name: /Settle Takeaway Bill/i })).toBeVisible();
    await page.getByLabel(/Cash Received/i).fill('179');
    await page.getByRole('button', { name: /Confirm Settlement/i }).click();

    await expect(page).toHaveURL(/\/manager\/bills\/takeaway-1$/);
    await expect(page.getByText(/Bill No/i)).toBeVisible();
    await expect(page.getByText(/INV-1001/i)).toBeVisible();
  });
});
