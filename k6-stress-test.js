import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ============ CUSTOM METRICS ============
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const responseTime = new Trend('response_time');
const orderResponseTime = new Trend('order_response_time');
const tableResponseTime = new Trend('table_response_time');
const kitchenResponseTime = new Trend('kitchen_response_time');
const httpErrors = new Counter('http_errors');
const timeoutErrors = new Counter('timeout_errors');
const slowResponses = new Counter('slow_responses'); // > 2 seconds

// ============ CONFIG ============
export const options = {
  stages: [
    // Ramp up to 100 users over 1 minute
    { duration: '1m', target: 100, name: 'Ramp up to 100' },
    
    // Gradually increase to 300 users over 1 minute
    { duration: '1m', target: 300, name: 'Ramp up to 300' },
    
    // SPIKE: Sudden jump to 500 users
    { duration: '30s', target: 500, name: 'SPIKE to 500' },
    
    // Hold spike for 30 seconds
    { duration: '30s', target: 500, name: 'Hold spike' },
    
    // Ramp down to 0
    { duration: '30s', target: 0, name: 'Ramp down' },
  ],

  // Thresholds for test pass/fail
  thresholds: {
    'errors': ['rate<0.1'],                    // Error rate < 10%
    'response_time': ['p95<2000', 'p99<3000'], // P95 < 2s, P99 < 3s
    'http_errors': ['count<100'],              // Less than 100 HTTP errors
    'timeout_errors': ['count<5'],             // Less than 5 timeouts
  },

  // VU configuration
  vus: 1,
  duration: '3m40s', // Total duration
  
  // Graceful shutdown
  gracefulStop: '10s',
  
  // Batch requests
  batch: 25,
  batchPerHost: 6,

  // Connection settings
  noConnectionReuse: false,
  insecureSkipTLSVerify: false,
};

// ============ SETUP ============
export function setup() {
  console.log('⚙️  K6 Stress Test Starting...');
  console.log('📊 Test Configuration:');
  console.log('  - Duration: 3m40s');
  console.log('  - Max VUs: 500');
  console.log('  - Stages: Ramp(100) → Ramp(300) → Spike(500) → Ramp down');
  console.log('  - APIs: Orders, Tables, Kitchen');
  
  return {
    baseUrl: 'http://localhost:3001',
    token: 'test-token', // Replace with real token
  };
}

// ============ MAIN TEST ============
export default function (data) {
  const baseUrl = data.baseUrl;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
    'X-Restaurant-Id': 'test-restaurant-001',
  };

  // ============ GROUP 1: ORDERS API ============
  group('Orders API - GET /api/v1/orders', () => {
    const params = {
      timeout: '10s',
      tags: { name: 'GetOrders' },
    };

    // Get orders with pagination
    const orderRes = http.get(
      `${baseUrl}/api/v1/orders?limit=20&offset=0&status=pending`,
      { headers, ...params }
    );

    const orderSuccess = check(orderRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has data': (r) => r.json('data') !== undefined,
      'response time < 1s': (r) => r.timings.duration < 1000,
    });

    orderResponseTime.add(orderRes.timings.duration);
    responseTime.add(orderRes.timings.duration);
    errorRate.add(!orderSuccess);
    successRate.add(orderSuccess);

    if (orderRes.timings.duration > 2000) {
      slowResponses.add(1);
    }

    if (orderRes.status >= 400) {
      httpErrors.add(1);
    }

    if (orderRes.status === 0) {
      timeoutErrors.add(1);
    }

    sleep(1);
  });

  // ============ GROUP 2: TABLES API ============
  group('Tables API - GET /api/v1/tables', () => {
    const params = {
      timeout: '10s',
      tags: { name: 'GetTables' },
    };

    // Get available tables
    const tableRes = http.get(
      `${baseUrl}/api/v1/tables?limit=50&offset=0&status=available`,
      { headers, ...params }
    );

    const tableSuccess = check(tableRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has data': (r) => r.json('data') !== undefined,
      'response time < 1s': (r) => r.timings.duration < 1000,
    });

    tableResponseTime.add(tableRes.timings.duration);
    responseTime.add(tableRes.timings.duration);
    errorRate.add(!tableSuccess);
    successRate.add(tableSuccess);

    if (tableRes.timings.duration > 2000) {
      slowResponses.add(1);
    }

    if (tableRes.status >= 400) {
      httpErrors.add(1);
    }

    if (tableRes.status === 0) {
      timeoutErrors.add(1);
    }

    sleep(1);
  });

  // ============ GROUP 3: KITCHEN API ============
  group('Kitchen API - GET /api/v1/kitchen/pending', () => {
    const params = {
      timeout: '10s',
      tags: { name: 'GetKitchenOrders' },
    };

    // Get pending orders for kitchen
    const kitchenRes = http.get(
      `${baseUrl}/api/v1/kitchen/pending?limit=50&offset=0`,
      { headers, ...params }
    );

    const kitchenSuccess = check(kitchenRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has data': (r) => r.json('data') !== undefined,
      'response time < 1s': (r) => r.timings.duration < 1000,
    });

    kitchenResponseTime.add(kitchenRes.timings.duration);
    responseTime.add(kitchenRes.timings.duration);
    errorRate.add(!kitchenSuccess);
    successRate.add(kitchenSuccess);

    if (kitchenRes.timings.duration > 2000) {
      slowResponses.add(1);
    }

    if (kitchenRes.status >= 400) {
      httpErrors.add(1);
    }

    if (kitchenRes.status === 0) {
      timeoutErrors.add(1);
    }

    sleep(1);
  });

  // ============ GROUP 4: UPDATE ORDER (Spike Load) ============
  group('Orders API - PATCH /api/v1/orders/:id/status', () => {
    const params = {
      timeout: '10s',
      tags: { name: 'UpdateOrderStatus' },
    };

    // Update order status (heavier operation)
    const updateRes = http.patch(
      `${baseUrl}/api/v1/orders/test-order-${Math.floor(Math.random() * 1000)}/status`,
      JSON.stringify({ status: 'in_progress' }),
      { headers, ...params }
    );

    const updateSuccess = check(updateRes, {
      'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    responseTime.add(updateRes.timings.duration);
    errorRate.add(!updateSuccess);
    successRate.add(updateSuccess);

    if (updateRes.timings.duration > 2000) {
      slowResponses.add(1);
    }

    if (updateRes.status >= 500) {
      httpErrors.add(1);
    }

    sleep(0.5);
  });

  // ============ GROUP 5: ANALYTICS (Heavy) ============
  group('Analytics API - GET /api/v1/analytics/summary', () => {
    const params = {
      timeout: '15s',
      tags: { name: 'GetAnalytics' },
    };

    // Get analytics (heavier query)
    const analyticsRes = http.get(
      `${baseUrl}/api/v1/analytics/summary?days=7`,
      { headers, ...params }
    );

    const analyticsSuccess = check(analyticsRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
      'has data': (r) => r.json('data') !== undefined,
    });

    responseTime.add(analyticsRes.timings.duration);
    errorRate.add(!analyticsSuccess);
    successRate.add(analyticsSuccess);

    if (analyticsRes.timings.duration > 2000) {
      slowResponses.add(1);
    }

    if (analyticsRes.status >= 400) {
      httpErrors.add(1);
    }

    sleep(2);
  });

  // Random sleep between 0.5-2 seconds between iterations
  sleep(Math.random() * 1.5 + 0.5);
}

// ============ TEARDOWN ============
export function teardown(data) {
  console.log('\n✅ K6 Stress Test Complete!');
  console.log('\n📊 Test Summary:');
  console.log('  Stage 1: Ramp 0→100 users (1 min)');
  console.log('  Stage 2: Ramp 100→300 users (1 min)');
  console.log('  Stage 3: SPIKE to 500 users (30 sec)');
  console.log('  Stage 4: Hold spike (30 sec)');
  console.log('  Stage 5: Ramp down (30 sec)');
  console.log('  Total: 3m40s');
}

// ============ SUMMARY METRICS ============
// Run with: k6 run --out json=results.json stress-test.js
// View results: Check console output or JSON file
// 
// Expected metrics after optimization:
// - Avg Response: 280-350ms (was 600ms)
// - P95: 600-650ms (was 860ms)
// - P99: 1100-1200ms (was 2500ms)
// - Error Rate: < 0.1%
// - Success Rate: > 99%
// - No timeouts at 500 VUs
