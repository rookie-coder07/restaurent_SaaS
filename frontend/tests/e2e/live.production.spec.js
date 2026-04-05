import { test, expect } from '@playwright/test';

const API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api/v1';
const OWNER_EMAIL = 'test@example.com';
const OWNER_PASSWORD = 'Test123@456';
const MANAGER_EMAIL = 'manager@restaurant.com';
const MANAGER_PASSWORD = 'Manager123@456';
const POS_EMAIL = 'posbilling@gmail.com';
const POS_PASSWORD = 'PosBilling123@456';
const INVENTORY_TRACKED_NAMES = ['Chicken', 'Butter', 'Cream', 'Masala Base', 'Onion', 'Tomato'];
const TARGET_MENU_ITEM = 'Butter Chicken';

async function loginByApi(request, path, body) {
  const response = await request.post(`${API_BASE_URL}${path}`, { data: body });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.data;
}

async function fetchInventoryMap(request, token) {
  const response = await request.get(`${API_BASE_URL}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const items = payload.data?.items || payload.data || [];
  return new Map(items.map((item) => [item.name, item]));
}

test('live UI smoke covers manager login, POS billing, invoice, print, and inventory deduction', async ({
  browser,
  request,
}) => {
  const ownerAuth = await loginByApi(request, '/auth/login', {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  const ownerToken = ownerAuth.accessToken;

  const menuResponse = await request.get(`${API_BASE_URL}/menu/items`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  expect(menuResponse.ok()).toBeTruthy();
  const menuPayload = await menuResponse.json();
  const menuItems = menuPayload.data?.items || menuPayload.data?.menuItems || menuPayload.data || [];
  const targetItem = menuItems.find((item) => item.name === TARGET_MENU_ITEM);
  expect(targetItem).toBeTruthy();

  const tablesResponse = await request.get(`${API_BASE_URL}/tables`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  expect(tablesResponse.ok()).toBeTruthy();
  const tablesPayload = await tablesResponse.json();
  const tables = tablesPayload.data?.tables || tablesPayload.data || [];
  const targetTable = tables.find((table) => String(table.status || '').toLowerCase() === 'available') || tables[0];
  expect(targetTable).toBeTruthy();

  const inventoryBefore = await fetchInventoryMap(request, ownerToken);

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await managerPage.goto('/manager/login');
  await managerPage.getByLabel(/Email/i).fill(MANAGER_EMAIL);
  await managerPage.getByLabel(/Password/i).fill(MANAGER_PASSWORD);
  await managerPage.getByRole('button', { name: /Open Manager Portal/i }).click();
  await expect(managerPage).toHaveURL(/\/manager$/);
  await expect(managerPage.getByRole('heading', { name: /Daily restaurant operations at a glance/i })).toBeVisible();
  await managerContext.close();

  const posContext = await browser.newContext();
  await posContext.addInitScript(() => {
    window.__printTriggered = false;
    window.print = () => {
      window.__printTriggered = true;
    };
  });
  const posPage = await posContext.newPage();

  await posPage.goto('/pos/login');
  await posPage.getByLabel(/Email/i).fill(POS_EMAIL);
  await posPage.getByLabel(/Password/i).fill(POS_PASSWORD);
  await posPage.getByRole('button', { name: /Open POS Portal/i }).click();
  await expect(posPage).toHaveURL(/\/pos$/);
  await expect(posPage.getByRole('heading', { name: /Choose service type/i })).toBeVisible();

  await posPage.getByRole('button', { name: /Dine-In/i }).click();
  await posPage.getByRole('button').filter({
    hasText: new RegExp(`Table\\s*${targetTable.tableNumber}`, 'i'),
  }).first().click();

  await expect(posPage.getByText(new RegExp(`Table\\s*${targetTable.tableNumber}`, 'i'))).toBeVisible();
  await posPage.getByRole('button', { name: new RegExp(`Add\\s+${TARGET_MENU_ITEM}`, 'i') }).click();
  await expect(posPage.getByRole('button', { name: /SEND TO KITCHEN/i })).toBeVisible();

  const sendButton = posPage.getByRole('button', { name: /SEND TO KITCHEN/i });
  await expect(sendButton).toBeVisible();
  await sendButton.click();

  await expect(posPage).toHaveURL(/\/pos\/kot\//);

  const inventoryAfterKitchenSend = await fetchInventoryMap(request, ownerToken);
  for (const inventoryName of INVENTORY_TRACKED_NAMES) {
    const before = inventoryBefore.get(inventoryName);
    const after = inventoryAfterKitchenSend.get(inventoryName);
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(Number(after.quantity)).toBeLessThan(Number(before.quantity));
  }

  await posPage.goto('/pos');
  await posPage.getByRole('button', { name: /Dine-In/i }).click();
  await posPage.getByRole('button').filter({
    hasText: new RegExp(`Table\\s*${targetTable.tableNumber}`, 'i'),
  }).first().click();
  await expect(posPage.getByText(/Running Bill Reopened/i)).toBeVisible();

  await posPage.getByRole('button', { name: /Use Exact/i }).click();
  const settleButton = posPage.getByRole('button', { name: /SETTLE BILL/i });
  await expect(settleButton).toBeEnabled();
  await settleButton.click();

  await expect(posPage).toHaveURL(/\/pos\/bill\//);
  await expect(posPage.getByText(/Invoice No/i)).toBeVisible();
  await expect(posPage.getByRole('button', { name: /Print Bill/i })).toBeVisible();
  await posPage.getByRole('button', { name: /Print Bill/i }).click();
  await expect.poll(async () => posPage.evaluate(() => window.__printTriggered)).toBeTruthy();

  await posContext.close();
});
