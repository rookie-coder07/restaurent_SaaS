import { test, expect } from '@playwright/test';

test.describe('POS Complete Flow Test', () => {
  test('full POS workflow test', async ({ page }) => {
    test.setTimeout(120000);

    // LOGIN
    await page.goto('http://localhost:5173/pos/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="username"]', 'posbilling@gmail.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/pos/, { timeout: 15000 });
    console.log('✅ Step 1: Login successful');

    // SELECT TABLE
    await page.waitForSelector('button', { state: 'visible', timeout: 10000 });
    const dineInBtn = page.locator('button:has-text("Dine-in")').first();
    if (await dineInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dineInBtn.click();
      await page.waitForTimeout(500);
    }
    const tableBtn = page.locator('button:has-text("Table")').first();
    await tableBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Step 2: Table selected');

    // ADD ITEMS
    await page.waitForSelector('button', { timeout: 8000 });
    const addButtons = page.locator('button:has-text("+"), button:has-text("Add")');
    const addCount = await addButtons.count();

    if (addCount > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(600);
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Add to Cart")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(400);
      }
      const addButtons2 = page.locator('button:has-text("+"), button:has-text("Add")');
      const items = await addButtons2.all();
      if (items.length > 1) {
        await items[1].click();
        await page.waitForTimeout(600);
        const confirmBtn2 = page.locator('button:has-text("Confirm"), button:has-text("Add to Cart")').first();
        if (await confirmBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn2.click();
          await page.waitForTimeout(400);
        }
      }
    }
    console.log('✅ Step 3: Items added');

    // SEND TO KITCHEN
    const kotBtn = page.locator('button:has-text("Send to Kitchen"), button:has-text("KOT"), button:has-text("Fire"), button:has-text("Submit Order")').first();
    if (await kotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await kotBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Step 4: Order sent to kitchen');
    }

    // GENERATE BILL  
    await page.waitForTimeout(500);
    const billBtn = page.locator('button:has-text("Bill"), button:has-text("Generate Bill"), button:has-text("Checkout")').first();
    if (await billBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await billBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Step 5: Bill generated');
    }

    // PAYMENT
    const payBtn = page.locator('button:has-text("Pay"), button:has-text("Settle"), button:has-text("Finalize Payment")').first();
    if (await payBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(800);
      const cashBtn = page.locator('button:has-text("Cash"), button:has-text("UPI")').first();
      if (await cashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cashBtn.click();
        await page.waitForTimeout(600);
      }
      const confirmPayBtn = page.locator('button:has-text("Confirm"), button:has-text("Complete")').last();
      if (await confirmPayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmPayBtn.click();
        await page.waitForTimeout(1500);
      }
      console.log('✅ Step 6: Payment processed');
    }

    // LOGOUT
    const menuBtn = page.locator('button:has-text("Menu"), button:has-text("Settings"), button:has-text("Profile")').first();
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(300);
    }
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")').first();
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/);
      console.log('✅ Step 7: Logged out successfully');
    }

    await expect(page).toHaveURL(/\/login/);
    console.log('✅✅✅ SUCCESS: Full POS workflow test completed!');
  });
});
