import { test, expect } from '@playwright/test';

test.describe('Portal Access Smoke', () => {
  test('home access and staff portal selection stay stable without redirect loops', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', (message) => {
      consoleMessages.push(message.text());
    });

    await page.goto('/');

    await expect(page.getByRole('link', { name: /Admin Login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Staff Login/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);

    await page.getByRole('link', { name: /Staff Login/i }).click();
    await expect(page).toHaveURL(/\/staff\/login$/);

    await page.getByRole('link', { name: /POS Login/i }).click();
    await expect(page).toHaveURL(/\/pos\/login$/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/pos\/login$/);

    await page.goto('/admin/login');
    await expect(page.getByRole('link', { name: /POS Login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /KOT Login/i })).toHaveCount(0);

    await page.goto('/kot/login');
    await expect(page).toHaveURL(/\/staff\/login$/);

    expect(consoleMessages.some((message) => message.includes('Throttling navigation'))).toBeFalsy();
  });

  test('protected routes redirect unauthenticated users to the correct login entry', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto('/manager');
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto('/pos');
    await expect(page).toHaveURL(/\/pos\/login$/);

    await page.goto('/kot');
    await expect(page).toHaveURL(/\/staff\/login$/);
  });
});
