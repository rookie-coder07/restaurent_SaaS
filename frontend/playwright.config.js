import { defineConfig, devices } from '@playwright/test';

// Dynamically detect port - Vite tries 5173, then 5174, 5175...
// Tests will connect to wherever the server actually starts
const PORT = process.env.VITE_PORT || 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',
  timeout: 60000, // Increase global test timeout to 60s
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
  ],

  // Playwright manages the dev server lifecycle
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: process.env.CI !== 'true', // Reuse in local, fresh start in CI
    timeout: 120000, // Wait up to 2 minutes for server to start
  },
});
