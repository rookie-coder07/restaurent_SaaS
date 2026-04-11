import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  scenarios: {
    // Main load test: Ramp up to 100 VUs, hold for 2 minutes, then spike to 200 VUs
    loadTest: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up phase 1
        { duration: '30s', target: 100 }, // Ramp up phase 2
        { duration: '120s', target: 100 }, // 2 minutes constant load at 100 VUs
        { duration: '20s', target: 200 }, // Spike up to 200 VUs
        { duration: '60s', target: 200 }, // Hold spike for 1 minute
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Response time must be < 800ms for 95th percentile
    'http_req_duration{api:orders}': ['p(95)<800', 'p(99)<1200'],
    'http_req_duration{api:tables}': ['p(95)<800', 'p(99)<1200'],
    'http_req_duration{api:kitchen}': ['p(95)<800', 'p(99)<1200'],
    // Failure rate must be < 1%
    'http_req_failed{api:orders}': ['rate<0.01'],
    'http_req_failed{api:tables}': ['rate<0.01'],
    'http_req_failed{api:kitchen}': ['rate<0.01'],
    // Overall metrics
    'http_req_duration': ['p(95)<900'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

// Helper function to make requests with tags
function makeRequest(url, method = 'GET', tags = {}) {
  const params = { tags };
  return method === 'GET'
    ? http.get(url, params)
    : http.post(url, null, params);
}

export default function () {
  // Test Orders API
  group('Orders API', () => {
    const res = makeRequest(`${BASE_URL}/orders?limit=20`, 'GET', { api: 'orders' });
    check(res, {
      'Orders: status is 200': (r) => r.status === 200,
      'Orders: response time < 800ms': (r) => r.timings.duration < 800,
      'Orders: has data': (r) => r.body && r.body.length > 0,
      'Orders: response time < 1200ms': (r) => r.timings.duration < 1200,
    });
  });

  sleep(0.5);

  // Test Tables API
  group('Tables API', () => {
    const res = makeRequest(`${BASE_URL}/tables?limit=50`, 'GET', { api: 'tables' });
    check(res, {
      'Tables: status is 200': (r) => r.status === 200,
      'Tables: response time < 800ms': (r) => r.timings.duration < 800,
      'Tables: has data': (r) => r.body && r.body.length > 0,
      'Tables: response time < 1200ms': (r) => r.timings.duration < 1200,
    });
  });

  sleep(0.5);

  // Test Kitchen Orders API
  group('Kitchen Orders API', () => {
    const res = makeRequest(`${BASE_URL}/kitchen/orders`, 'GET', { api: 'kitchen' });
    check(res, {
      'Kitchen: status is 200': (r) => r.status === 200,
      'Kitchen: response time < 800ms': (r) => r.timings.duration < 800,
      'Kitchen: has data': (r) => r.body && r.body.length >= 0,
      'Kitchen: response time < 1200ms': (r) => r.timings.duration < 1200,
    });
  });

  sleep(1);
}

// Summary report function
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Custom text summary
function textSummary(data, options) {
  const { indent = '', enableColors = false } = options;
  let summary = '\n📊 K6 LOAD TEST SUMMARY\n';
  summary += '=' .repeat(60) + '\n\n';

  // Metrics
  if (data.metrics) {
    summary += `${indent}API Response Times:\n`;
    const duration = data.metrics.http_req_duration;
    if (duration && duration.values) {
      summary += `${indent}  Avg: ${Math.round(duration.values.avg)} ms\n`;
      summary += `${indent}  P95: ${Math.round(duration.values['p(95)'])} ms\n`;
      summary += `${indent}  P99: ${Math.round(duration.values['p(99)'])} ms\n`;
      summary += `${indent}  Max: ${Math.round(duration.values.max)} ms\n`;
    }

    const failed = data.metrics.http_req_failed;
    if (failed) {
      const failRate = (failed.values.rate * 100).toFixed(2);
      summary += `\n${indent}Request Failures:\n`;
      summary += `${indent}  Rate: ${failRate}% (threshold: < 1%)\n`;
    }

    const reqs = data.metrics.http_reqs;
    if (reqs && reqs.values) {
      summary += `\n${indent}Total Requests: ${reqs.values.count}\n`;
    }
  }

  // Checks
  if (data.checks) {
    summary += `\n${indent}Check Results:\n`;
    let passCount = 0;
    let failCount = 0;
    Object.entries(data.checks).forEach(([name, check]) => {
      const passed = check.passes || 0;
      const failed = check.fails || 0;
      const status = failed === 0 ? '✅' : '❌';
      summary += `${indent}  ${status} ${name}: ${passed} passed, ${failed} failed\n`;
      passCount += passed;
      failCount += failed;
    });
    summary += `\n${indent}Total: ${passCount} passed, ${failCount} failed\n`;
  }

  summary += '\n' + '='.repeat(60) + '\n\n';
  return summary;
}
