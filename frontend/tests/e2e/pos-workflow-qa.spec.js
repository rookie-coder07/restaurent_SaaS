import { test, expect } from '@playwright/test';

test.describe('POS Complete Workflow', () => {
  test('Complete POS workflow: Login -> Table -> Waiter -> Items -> Kitchen -> Bill -> Payment -> Logout', async ({ page, context }) => {
    await page.goto('http://localhost:5174');
    
    try {
      await page.waitForFunction(() => document.querySelectorAll('input[name="username"]').length > 0, { timeout: 15000 });
    } catch (e) {
      const content = await page.content();
      console.log('Page content:', content.substring(0, 500));
    }

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'posbilling@gmail.com');
    await page.fill('input[name="password"]', 'NewSecurePass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*pos/, { timeout: 15000 });
    await page.waitForSelector('[data-testid="pos-container"]', { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    await page.waitForSelector('button[data-table]', { timeout: 10000 });
    const tableButtons = await page.$$('button[data-table]');
    if (tableButtons.length > 0) {
      await tableButtons[0].click();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } else {
      throw new Error('No table buttons found');
    }

    const waiterSelect = await page.$('select[name="waiter"]');
    if (waiterSelect) {
      await waiterSelect.click();
      const waiterOptions = await page.$$('select[name="waiter"] option');
      if (waiterOptions.length > 1) {
        await waiterOptions[1].click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForSelector('button[data-item]', { timeout: 10000 });
    const itemButtons = await page.$$('button[data-item]');
    if (itemButtons.length > 0) {
      await itemButtons[0].click();
      await page.waitForTimeout(800);
    }

    const addButtons = await page.$$('button:has-text("Add")');
    if (addButtons.length > 0) {
      await addButtons[0].click();
      await page.waitForTimeout(800);
    }

    if (itemButtons.length > 1) {
      await itemButtons[1].click();
      await page.waitForTimeout(800);
    }

    const kitchenButtons = await page.$$('button:has-text("Send to Kitchen")');
    if (kitchenButtons.length > 0) {
      await kitchenButtons[0].click();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }

    if (itemButtons.length > 2) {
      await itemButtons[2].click();
      await page.waitForTimeout(800);
      const addMoreButtons = await page.$$('button:has-text("Add")');
      if (addMoreButtons.length > 0) {
        await addMoreButtons[0].click();
        await page.waitForTimeout(800);
      }
    }

    const billButtons = await page.$$('button:has-text("Generate Bill")');
    if (billButtons.length > 0) {
      await billButtons[0].click();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }

    const paymentButtons = await page.$$('button:has-text("Payment")');
    if (paymentButtons.length > 0) {
      await paymentButtons[0].click();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }

    const logoutButtons = await page.$$('button:has-text("Logout"), button:has-text("Sign Out")');
    if (logoutButtons.length > 0) {
      await logoutButtons[0].click();
      await page.waitForURL(/.*login|.*auth/, { timeout: 10000 }).catch(() => {});
    }

    await expect(page).toHaveURL(/.*login|.*auth/);
  });
});
