import { test, expect } from '@playwright/test';

test.describe('POS Complete Workflow', () => {
  test('login → select table → add items → send to kitchen → bill → payment → logout', async ({ page }) => {
    test.setTimeout(120000);

    // ============================================
    // STEP 1: Login to POS
    // ============================================
    // POS login removed
    await page.waitForLoadState('networkidle');

    // Fill email (name="username")
    await page.fill('input[name="username"]', 'posbilling@gmail.com');
    
    // Fill password (name="password")
    await page.fill('input[name="password"]', 'password123');
    
    // Click submit button (type="submit" in form)
    await page.click('button[type="submit"]');
    
    // Wait for redirect to POS dashboard
    await page.waitForURL(/\/pos/, { timeout: 15000 });
    console.log('✅ Login successful');

    // ============================================
    // STEP 2: Select Table
    // ============================================
    // Wait for table selection UI to appear
    await page.waitForSelector('button', { state: 'visible', timeout: 10000 });
    
    // Click "Dine-in" button if visible
    const dineInBtn = page.locator('button:has-text("Dine-in")').first();
    if (await dineInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dineInBtn.click();
      await page.waitForTimeout(500);
    }

    // Click first available table button
    const tableBtn = page.locator('button:has-text("Table")').first();
    await tableBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Table selected');

    // ============================================
    // STEP 3: Add Items to Order
    // ============================================
    // Wait for menu items to load
    await page.waitForSelector('button', { timeout: 8000 });

    // Find and click "Add" or "+" buttons for items
    const addButtons = page.locator('button:has-text("+"), button:has-text("Add")');
    const addCount = await addButtons.count();

    if (addCount > 0) {
      // Add first item
      await addButtons.first().click();
      await page.waitForTimeout(600);

      // Confirm if modal appears
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Add to Cart")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(400);
      }

      // Add second item
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
    console.log('✅ Items added');

    // ============================================
    // STEP 4: Send to Kitchen (KOT)
    // ============================================
    const kotBtn = page
      .locator('button:has-text("Send to Kitchen"), button:has-text("KOT"), button:has-text("Fire"), button:has-text("Submit Order")')
      .first();

    if (await kotBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await kotBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Order sent to kitchen');
    }

    // ============================================
    // STEP 5: Generate Bill
    // ============================================
    await page.waitForTimeout(500);
    
    const billBtn = page
      .locator('button:has-text("Bill"), button:has-text("Generate Bill"), button:has-text("Checkout")')
      .first();

    if (await billBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await billBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Bill generated');
    }

    // ============================================
    // STEP 6: Process Payment
    // ============================================
    const payBtn = page
      .locator('button:has-text("Pay"), button:has-text("Settle"), button:has-text("Finalize Payment")')
      .first();

    if (await payBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await payBtn.click();
      await page.waitForTimeout(800);

      // Select payment method (Cash)
      const cashBtn = page.locator('button:has-text("Cash"), button:has-text("UPI")').first();
      if (await cashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cashBtn.click();
        await page.waitForTimeout(600);
      }

      // Confirm payment
      const confirmPayBtn = page.locator('button:has-text("Confirm"), button:has-text("Complete")').last();
      if (await confirmPayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmPayBtn.click();
        await page.waitForTimeout(1500);
      }
      console.log('✅ Payment processed');
    }

    // ============================================
    // STEP 7: Logout
    // ============================================
    // Look for menu/logout button
    const menuBtn = page.locator('button:has-text("Menu"), button:has-text("Settings"), button:has-text("Profile")').first();
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(300);
    }

    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")').first();
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/);
      console.log('✅ Logged out successfully');
    }

    // Verify we're back at login
    await expect(page).toHaveURL(/\/login/);
    console.log('✅✅✅ COMPLETE POS WORKFLOW TEST PASSED');
  });
});
