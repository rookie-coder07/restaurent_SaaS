import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const STAFF_LOGIN_ENDPOINT = `${BASE_URL}/auth/staff/login`;
const ORDERS_ENDPOINT = `${BASE_URL}/orders`;
const TABLES_ENDPOINT = `${BASE_URL}/tables`;
const MENU_ITEMS_ENDPOINT = `${BASE_URL}/menu/items`;

const MANAGER_EMAIL = __ENV.MANAGER_EMAIL || 'manager@restaurant.com';
const MANAGER_PASSWORD = __ENV.MANAGER_PASSWORD || 'Manager123@456';
const ORDER_TYPE = (__ENV.ORDER_TYPE || 'takeaway').toLowerCase();
const PAYMENT_METHOD = (__ENV.PAYMENT_METHOD || 'cash').toLowerCase();

const requestDuration = new Trend('pos_request_duration', true);
const failedRequests = new Rate('pos_failed_requests');
const totalRequests = new Counter('pos_total_requests');
const duplicateFlowAttempts = new Counter('pos_duplicate_flow_attempts');

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
    pos_failed_requests: ['rate<0.05'],
    pos_request_duration: ['p(95)<500'],
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const normalized = char === 'x' ? value : (value & 0x3) | 0x8;
    return normalized.toString(16);
  });
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function trackResponse(name, response, extraChecks = {}) {
  totalRequests.add(1);
  requestDuration.add(response.timings.duration, { endpoint: name });

  const baseChecks = {
    [`${name} status is 200/201`]: (res) => res.status === 200 || res.status === 201,
    [`${name} duration < 500ms`]: (res) => res.timings.duration < 500,
    ...extraChecks,
  };
  const ok = check(response, baseChecks);
  const functionalSuccess = (response.status === 200 || response.status === 201)
    && Object.entries(extraChecks).every(([, predicate]) => {
      try {
        return predicate(response);
      } catch {
        return false;
      }
    });

  failedRequests.add(!functionalSuccess, { endpoint: name });

  if (!functionalSuccess) {
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

function buildAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function pickRandom(list) {
  return list[randomInt(0, list.length - 1)];
}

function normalizeMenuItems(payload) {
  const items = payload?.data?.items || payload?.items || [];

  return items
    .filter((item) => item && (item.isAvailable === undefined || item.isAvailable))
    .map((item) => ({
      id: item.id || item._id,
      name: item.name || 'Item',
      price: Number(item.price || item.unitPrice || item.unit_price || 0),
    }))
    .filter((item) => item.id && item.price > 0);
}

function normalizeTables(payload) {
  const tables = payload?.data?.tables || payload?.tables || [];

  return tables
    .filter((table) => table && table.id)
    .map((table) => ({
      id: table.id,
      tableNumber: String(table.tableNumber || table.number || ''),
      status: String(table.status || '').toLowerCase(),
    }))
    .filter((table) => table.id);
}

function buildItems(menuItems) {
  const itemCount = Math.min(randomInt(1, 3), menuItems.length);
  const items = [];
  const remainingItems = [...menuItems];

  for (let index = 0; index < itemCount; index += 1) {
    const randomIndex = randomInt(0, remainingItems.length - 1);
    const [item] = remainingItems.splice(randomIndex, 1);
    items.push({
      id: item.id,
      name: item.name,
      quantity: randomInt(1, 4),
      price: item.price,
    });
  }

  return items;
}

function calculateRawTotal(items) {
  return Number(
    items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0).toFixed(2)
  );
}

function extractOrderId(payload) {
  return payload?.data?.id || payload?.id || null;
}

function loginManager() {
  const response = http.post(
    STAFF_LOGIN_ENDPOINT,
    JSON.stringify({
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  trackResponse('staff_login', response, {
    'staff_login returns access token': (res) => !!parseJson(res)?.data?.accessToken,
  });
  const payload = parseJson(response);

  if (response.status !== 200 || !payload?.data?.accessToken) {
    throw new Error(`Failed to log in manager for load test: ${response.body}`);
  }

  return payload.data.accessToken;
}

export function setup() {
  const token = loginManager();
  const headers = buildAuthHeaders(token);

  const menuResponse = http.get(MENU_ITEMS_ENDPOINT, { headers });
  const tablesResponse = ORDER_TYPE === 'dine-in'
    ? http.get(TABLES_ENDPOINT, { headers })
    : null;

  trackResponse('setup_fetch_menu_items', menuResponse, {
    'setup_fetch_menu_items returns items': (res) => normalizeMenuItems(parseJson(res)).length > 0,
  });
  if (tablesResponse) {
    trackResponse('setup_fetch_tables', tablesResponse, {
      'setup_fetch_tables returns tables': (res) => normalizeTables(parseJson(res)).length > 0,
    });
  }

  const normalizedMenuItems = normalizeMenuItems(parseJson(menuResponse));
  const normalizedTables = tablesResponse ? normalizeTables(parseJson(tablesResponse)) : [];

  if (menuResponse.status !== 200 || normalizedMenuItems.length === 0) {
    throw new Error(`Unable to fetch menu items for load test: ${menuResponse.body}`);
  }

  if (tablesResponse && (tablesResponse.status !== 200 || normalizedTables.length === 0) && ORDER_TYPE === 'dine-in') {
    throw new Error(`Unable to fetch tables for dine-in load test: ${tablesResponse.body}`);
  }

  return {
    token,
    menuItems: normalizedMenuItems,
    tables: normalizedTables,
  };
}

function createOrderFlow(context) {
  const items = buildItems(context.menuItems);
  const table = context.tables.length > 0 ? pickRandom(context.tables) : null;
  const payload = {
    request_id: createRequestId(),
    items,
    total: calculateRawTotal(items),
    order_type: ORDER_TYPE === 'dine-in' ? 'dine-in' : 'takeaway',
    payment_method: PAYMENT_METHOD,
    customer_name: `Load Test ${__VU}`,
    customer_phone: `99999${String(randomInt(10000, 99999))}`,
  };

  if (ORDER_TYPE === 'dine-in' && table?.id) {
    payload.table_id = table.id;
    payload.tableNumber = table.tableNumber;
  }

  const response = http.post(ORDERS_ENDPOINT, JSON.stringify(payload), {
    headers: buildAuthHeaders(context.token),
  });

  const ok = trackResponse('create_order', response, {
    'create_order returns order id': (res) => !!extractOrderId(parseJson(res)),
  });
  const body = parseJson(response);

  return {
    ok,
    orderId: extractOrderId(body),
    amountSeed: payload.total,
  };
}

function sendToKitchenFlow(context, orderId) {
  const response = http.post(`${ORDERS_ENDPOINT}/${orderId}/send-to-kitchen`, null, {
    headers: buildAuthHeaders(context.token),
  });

  const ok = trackResponse('send_to_kitchen', response);
  return {
    ok,
    body: parseJson(response),
  };
}

function settleBillFlow(context, orderId, amountSeed) {
  const response = http.post(
    `${ORDERS_ENDPOINT}/${orderId}/settle`,
    JSON.stringify({
      paymentMethod: PAYMENT_METHOD,
      amountReceived: Number((amountSeed * 3 + 10).toFixed(2)),
    }),
    {
      headers: buildAuthHeaders(context.token),
    }
  );

  const ok = trackResponse('settle_bill', response, {
    'settle_bill returns invoice number': (res) => !!parseJson(res)?.data?.billing?.invoiceNumber,
    'settle_bill marks payment paid or pending': (res) => {
      const status = String(parseJson(res)?.data?.paymentStatus || '').toLowerCase();
      return status === 'paid' || status === 'pending';
    },
  });

  return {
    ok,
    body: parseJson(response),
  };
}

function duplicateCreateOrderCheck(context) {
  duplicateFlowAttempts.add(1);

  const items = buildItems(context.menuItems);
  const payload = JSON.stringify({
    request_id: createRequestId(),
    items,
    total: calculateRawTotal(items),
    order_type: 'takeaway',
    payment_method: PAYMENT_METHOD,
    customer_name: `Duplicate Test ${__VU}`,
    customer_phone: `88888${String(randomInt(10000, 99999))}`,
  });

  const firstResponse = http.post(ORDERS_ENDPOINT, payload, {
    headers: buildAuthHeaders(context.token),
  });
  const secondResponse = http.post(ORDERS_ENDPOINT, payload, {
    headers: buildAuthHeaders(context.token),
  });

  const firstOrderId = extractOrderId(parseJson(firstResponse));
  const secondOrderId = extractOrderId(parseJson(secondResponse));

  trackResponse('duplicate_create_order_first', firstResponse, {
    'duplicate_create_order_first returns id': () => !!firstOrderId,
  });

  trackResponse('duplicate_create_order_second', secondResponse, {
    'duplicate request reuses same order': () =>
      !!firstOrderId && !!secondOrderId && String(firstOrderId) === String(secondOrderId),
  });
}

export default function (context) {
  if (ORDER_TYPE === 'dine-in') {
    group('tables_overview', () => {
      const response = http.get(TABLES_ENDPOINT, {
        headers: buildAuthHeaders(context.token),
      });
      trackResponse('fetch_tables', response);
    });
  }

  sleep(Math.random());

  group('order_to_settlement_flow', () => {
    const orderResult = createOrderFlow(context);
    if (!orderResult.ok || !orderResult.orderId) {
      sleep(1);
      return;
    }

    sleep(Math.random() * 0.5);

    const kitchenResult = sendToKitchenFlow(context, orderResult.orderId);
    if (!kitchenResult.ok) {
      sleep(1);
      return;
    }

    sleep(Math.random() * 0.5);

    settleBillFlow(context, orderResult.orderId, orderResult.amountSeed);
  });

  if (__ITER % 5 === 0) {
    group('duplicate_protection_check', () => {
      duplicateCreateOrderCheck(context);
    });
  }

  sleep(randomInt(1, 3));
}
