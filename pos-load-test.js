import http from 'k6/http';
import { check, fail, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    pos_failed_requests: ['rate<0.01'],
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const AUTH_URL = `${BASE_URL}/v1/auth/login`;
const ORDERS_URL = `${BASE_URL}/v1/orders`;
const MENU_URL = `${BASE_URL}/v1/menu/items`;
const TABLES_URL = `${BASE_URL}/v1/tables`;

const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'manager@restaurant.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'Manager123@456';

const requestDuration = new Trend('pos_request_duration', true);
const failedRequests = new Rate('pos_failed_requests');
const totalRequests = new Counter('pos_total_requests');
const duplicateChecks = new Counter('pos_duplicate_checks');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex(length) {
  let value = '';
  while (value.length < length) {
    value += Math.floor(Math.random() * 16).toString(16);
  }
  return value.slice(0, length);
}

function makeRequestId() {
  return [
    randomHex(8),
    randomHex(4),
    `4${randomHex(3)}`,
    `${(8 + randomInt(0, 3)).toString(16)}${randomHex(3)}`,
    randomHex(12),
  ].join('-');
}

function parseJson(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function track(name, response, extraChecks = {}) {
  totalRequests.add(1);
  requestDuration.add(response.timings.duration, { endpoint: name });

  const ok = check(response, {
    [`${name}: status 200/201`]: (res) => res.status === 200 || res.status === 201,
    [`${name}: duration < 2000ms`]: (res) => res.timings.duration < 2000,
    ...extraChecks,
  });

  failedRequests.add(!ok, { endpoint: name });

  if (!ok) {
    console.error(
      JSON.stringify({
        endpoint: name,
        status: response.status,
        duration: response.timings.duration,
        body: response.body,
      })
    );
  }

  return ok;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function extractOrderId(body) {
  return body?.data?.id || body?.data?.order?.id || body?.order?.id || body?.id || null;
}

function extractPaymentStatus(body) {
  return (
    body?.data?.paymentStatus ||
    body?.data?.payment_status ||
    body?.paymentStatus ||
    body?.payment_status ||
    ''
  );
}

function extractSettleTotal(body) {
  const settlement = body?.data?.settlement || body?.settlement || {};
  const billing = body?.data?.billing || body?.billing || {};

  return (
    settlement.finalTotal ||
    settlement.total ||
    billing.grandTotal ||
    billing.total ||
    body?.data?.finalAmount ||
    body?.data?.final_amount ||
    body?.data?.totalAmount ||
    body?.data?.total ||
    0
  );
}

function loginAndLoadFixtures() {
  const loginResponse = http.post(
    AUTH_URL,
    JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!(loginResponse.status === 200 || loginResponse.status === 201)) {
    fail(`Login failed: ${loginResponse.status} ${loginResponse.body}`);
  }

  const loginBody = parseJson(loginResponse);
  const accessToken =
    loginBody?.data?.accessToken ||
    loginBody?.accessToken ||
    loginBody?.data?.token ||
    loginBody?.token;

  if (!accessToken) {
    fail('Login succeeded but no access token was returned.');
  }

  const commonHeaders = authHeaders(accessToken);

  const [menuResponse, tablesResponse] = http.batch([
    ['GET', MENU_URL, null, { headers: commonHeaders }],
    ['GET', TABLES_URL, null, { headers: commonHeaders }],
  ]);

  if (!(menuResponse.status === 200 || menuResponse.status === 201)) {
    fail(`Menu fetch failed: ${menuResponse.status} ${menuResponse.body}`);
  }

  if (!(tablesResponse.status === 200 || tablesResponse.status === 201)) {
    fail(`Tables fetch failed: ${tablesResponse.status} ${tablesResponse.body}`);
  }

  const menuBody = parseJson(menuResponse);
  const tablesBody = parseJson(tablesResponse);

  const menuItems = (menuBody?.data?.items || menuBody?.items || [])
    .filter((item) => item?.id && item?.isAvailable !== false && Number(item?.price || item?.unitPrice || 0) > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || item.unitPrice || 0),
    }));

  const tables = (tablesBody?.data?.tables || tablesBody?.tables || [])
    .filter((table) => table?.id && table?.tableNumber !== undefined && table?.tableNumber !== null)
    .map((table) => ({
      id: table.id,
      tableNumber: table.tableNumber,
    }));

  if (menuItems.length === 0) {
    fail('No usable menu items returned for load testing.');
  }

  if (tables.length === 0) {
    fail('No usable tables returned for load testing.');
  }

  return {
    accessToken,
    menuItems,
    tables,
  };
}

export function setup() {
  return loginAndLoadFixtures();
}

function pickRandomTable(tables) {
  return tables[randomInt(0, Math.min(tables.length, 10) - 1)];
}

function pickRandomMenuItem(menuItems) {
  return menuItems[randomInt(0, menuItems.length - 1)];
}

function buildOrderPayload(fixtures, requestIdOverride) {
  const table = pickRandomTable(fixtures.tables);
  const lineCount = randomInt(1, 3);
  const items = [];

  for (let index = 0; index < lineCount; index += 1) {
    const menuItem = pickRandomMenuItem(fixtures.menuItems);
    items.push({
      itemId: menuItem.id,
      quantity: randomInt(1, 3),
      price: menuItem.price,
      name: menuItem.name,
    });
  }

  return {
    request_id: requestIdOverride || makeRequestId(),
    tableId: table.id,
    tableNumber: String(table.tableNumber),
    orderType: 'dine-in',
    paymentMethod: 'cash',
    items,
    total: items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    notes: `k6-${__VU}-${__ITER}`,
  };
}

function createOrder(fixtures, payload) {
  const response = http.post(
    ORDERS_URL,
    JSON.stringify(payload),
    { headers: authHeaders(fixtures.accessToken) }
  );
  const body = parseJson(response);
  const ok = track('create_order', response);

  return {
    ok,
    body,
    orderId: extractOrderId(body),
    total: payload.total,
  };
}

function sendToKitchen(fixtures, orderId) {
  const response = http.post(
    `${ORDERS_URL}/${orderId}/send-to-kitchen`,
    null,
    { headers: authHeaders(fixtures.accessToken) }
  );
  const ok = track('send_to_kitchen', response, {
    'send_to_kitchen: no duplicate conflict': (res) =>
      res.status === 200 || res.status === 201 || res.status === 400 || res.status === 409,
  });

  return {
    ok: ok && (response.status === 200 || response.status === 201),
    body: parseJson(response),
    response,
  };
}

function settleBill(fixtures, orderId, amount) {
  const response = http.post(
    `${ORDERS_URL}/${orderId}/settle`,
    JSON.stringify({
      paymentMethod: 'cash',
      amountReceived: amount,
    }),
    { headers: authHeaders(fixtures.accessToken) }
  );
  const ok = track('settle_bill', response);

  return {
    ok,
    body: parseJson(response),
  };
}

function markPaid(fixtures, orderId, amount) {
  const response = http.post(
    `${ORDERS_URL}/${orderId}/mark-paid`,
    JSON.stringify({
      paymentMethod: 'cash',
      amountReceived: amount,
    }),
    { headers: authHeaders(fixtures.accessToken) }
  );

  const ok = track('mark_paid', response, {
    'mark_paid: paid status returned': (res) =>
      String(extractPaymentStatus(parseJson(res)) || '').toLowerCase() === 'paid',
  });

  return {
    ok,
    body: parseJson(response),
  };
}

function runDuplicateOrderCheck(fixtures) {
  duplicateChecks.add(1);

  const requestId = makeRequestId();
  const payload = buildOrderPayload(fixtures, requestId);
  const requestBody = JSON.stringify(payload);
  const params = { headers: authHeaders(fixtures.accessToken) };

  const responses = http.batch([
    ['POST', ORDERS_URL, requestBody, params],
    ['POST', ORDERS_URL, requestBody, params],
  ]);

  const firstBody = parseJson(responses[0]);
  const secondBody = parseJson(responses[1]);
  const firstOrderId = extractOrderId(firstBody);
  const secondOrderId = extractOrderId(secondBody);

  track('duplicate_create_order_first', responses[0]);
  track('duplicate_create_order_second', responses[1], {
    'duplicate_create_order_second: same order reused': () =>
      !firstOrderId || !secondOrderId || String(firstOrderId) === String(secondOrderId),
  });
}

function runDuplicateKitchenCheck(fixtures, orderId) {
  duplicateChecks.add(1);

  const params = { headers: authHeaders(fixtures.accessToken) };
  const targetUrl = `${ORDERS_URL}/${orderId}/send-to-kitchen`;

  const responses = http.batch([
    ['POST', targetUrl, null, params],
    ['POST', targetUrl, null, params],
  ]);

  track('duplicate_send_kitchen_first', responses[0], {
    'duplicate_send_kitchen_first: accepted': (res) =>
      res.status === 200 || res.status === 201 || res.status === 400 || res.status === 409,
  });
  track('duplicate_send_kitchen_second', responses[1], {
    'duplicate_send_kitchen_second: blocked or accepted safely': (res) =>
      res.status === 200 || res.status === 201 || res.status === 400 || res.status === 409,
  });
}

export default function (fixtures) {
  group('order_to_payment_flow', () => {
    const orderPayload = buildOrderPayload(fixtures);
    const orderResult = createOrder(fixtures, orderPayload);

    if (!orderResult.ok || !orderResult.orderId) {
      sleep(randomInt(1, 2));
      return;
    }

    sleep(Math.random() * 0.5);

    const kitchenResult = sendToKitchen(fixtures, orderResult.orderId);
    if (!kitchenResult.ok) {
      sleep(randomInt(1, 2));
      return;
    }

    sleep(Math.random() * 0.5);

    const settleResult = settleBill(fixtures, orderResult.orderId, orderResult.total);
    if (!settleResult.ok) {
      sleep(randomInt(1, 2));
      return;
    }

    sleep(Math.random() * 0.5);

    const amountToConfirm = Number(extractSettleTotal(settleResult.body) || orderResult.total || 0);
    markPaid(fixtures, orderResult.orderId, amountToConfirm);
  });

  if (__ITER % 5 === 0) {
    group('duplicate_prevention_checks', () => {
      runDuplicateOrderCheck(fixtures);

      const orderPayload = buildOrderPayload(fixtures);
      const orderResult = createOrder(fixtures, orderPayload);
      if (orderResult.ok && orderResult.orderId) {
        runDuplicateKitchenCheck(fixtures, orderResult.orderId);
      }
    });
  }

  sleep(randomInt(1, 2));
}
