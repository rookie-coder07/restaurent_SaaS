import { chromium } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://restaurentsaas.vercel.app';
const BACKEND_URL = 'https://restaurent-backend-448t.onrender.com';
const LOGIN_URL = `${BACKEND_URL}/api/v1/auth/login`;

const summary = {
  frontendUrl: FRONTEND_URL,
  backendHealthUrl: `${BACKEND_URL}/health`,
  backendHealthStatus: null,
  backendHealthBody: null,
  consoleChecks: [],
  localhostRequests: [],
  requestFailures: [],
  loginRequestCount: 0,
  loginResponseStatuses: [],
  loginSucceeded: false,
  finalUrl: null,
};

async function verifyBackendHealth() {
  const response = await fetch(summary.backendHealthUrl);
  summary.backendHealthStatus = response.status;
  summary.backendHealthBody = await response.text();
}

async function verifyFrontendLogin() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', (message) => {
      const text = message.text();
      if (
        text.includes('✔ Environment:') ||
        text.includes('✔ API base:') ||
        text.includes('✔ No localhost usage:')
      ) {
        summary.consoleChecks.push(text);
      }
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('localhost')) {
        summary.localhostRequests.push(url);
      }
      if (url === LOGIN_URL && request.method() === 'POST') {
        summary.loginRequestCount += 1;
      }
    });

    page.on('requestfailed', (request) => {
      summary.requestFailures.push({
        url: request.url(),
        failure: request.failure()?.errorText || 'unknown',
      });
    });

    page.on('response', (response) => {
      if (response.url() === LOGIN_URL && response.request().method() === 'POST') {
        summary.loginResponseStatuses.push(response.status());
      }
    });

    await page.goto(`${FRONTEND_URL}/admin/login`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByLabel(/Email/i).fill('test@example.com');
    await page.getByLabel(/Password/i).fill('Test123@456');
    await page.getByRole('button', { name: /Open Admin Portal/i }).click();
    await page.waitForURL(/\/admin$/, { timeout: 60000 });

    summary.loginSucceeded = true;
    summary.finalUrl = page.url();

    await context.close();
  } finally {
    await browser.close();
  }
}

try {
  await verifyBackendHealth();
  await verifyFrontendLogin();

  console.log(JSON.stringify(summary, null, 2));

  if (
    summary.backendHealthStatus !== 200 ||
    summary.loginSucceeded !== true ||
    summary.loginRequestCount !== 1 ||
    summary.localhostRequests.length > 0 ||
    summary.requestFailures.length > 0
  ) {
    process.exit(1);
  }
} catch (error) {
  console.error(JSON.stringify({
    ...summary,
    error: error.message,
  }, null, 2));
  process.exit(1);
}
