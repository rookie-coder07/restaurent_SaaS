import { test, expect } from '@playwright/test';

test.describe('POS Workflow Test', () => {
  test('complete basic login and navigation', async ({ page }) => {
    test.setTimeout(120000);
    
    // Navigate to login
    // POS login removed
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshot-1-login-page.png' });
    
    // Try simple selector for email input
    const emailInput = await page.locator('input[type="email"]')
      .or(page.locator('input[name="username"]'))
      .or(page.locator('form input').first())
      .first();
    
    const passwordInput = page.locator('input[type="password"]').first();
    
    console.log('Attempting to fill email...');
    await emailInput.fill('posbilling@gmail.com', { timeout: 5000 });
    await page.waitForTimeout(300);
    
    console.log('Attempting to fill password...');
    await passwordInput.fill('password123', { timeout: 5000 });
    await page.waitForTimeout(300);
    
    // Try different button selectors
    const loginButton = page
      .getByRole('button', { name: /(Sign In|Login|Submit)/i })
      .or(page.locator('button:visible').last())
      .first();
    
    console.log('Attempting to click login button...');
    await loginButton.click({ timeout: 5000 });
    
    // Wait for navigation
    await page.waitForURL(/\/pos/, { timeout: 15000 });
    await page.screenshot({ path: 'screenshot-2-after-login.png' });
    
    console.log('Login successful!');
  });
});
