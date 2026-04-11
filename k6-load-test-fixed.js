import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  scenarios: {
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
    'http_req_duration': ['avg<1000', 'p(95)<2000', 'p(99)<3000'],
    'http_req_failed': ['rate<0.10'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Test Orders API
  group('Orders API', () => {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-Load-Test': 'true',
      },
      tags: { api: 'orders' }
    };
    const res = http.get(`${BASE_URL}/orders?limit=20`, params);
    check(res, {
      'Orders: response time < 800ms': (r) => r.timings.duration < 800,
      'Orders: response time < 1200ms': (r) => r.timings.duration < 1200,
      'Orders: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // Test Tables API
  group('Tables API', () => {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-Load-Test': 'true',
      },
      tags: { api: 'tables' }
    };
    const res = http.get(`${BASE_URL}/tables?limit=50`, params);
    check(res, {
      'Tables: response time < 800ms': (r) => r.timings.duration < 800,
      'Tables: response time < 1200ms': (r) => r.timings.duration < 1200,
      'Tables: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // Test Kitchen Orders API
  group('Kitchen Orders API', () => {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'X-Load-Test': 'true',
      },
      tags: { api: 'kitchen' }
    };
    const res = http.get(`${BASE_URL}/kitchen/orders`, params);
    check(res, {
      'Kitchen: response time < 800ms': (r) => r.timings.duration < 800,
      'Kitchen: response time < 1200ms': (r) => r.timings.duration < 1200,
      'Kitchen: status 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

// Summary report
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
  };
}

function textSummary(data) {
  let summary = '\n📊 K6 LOAD TEST COMPLETE\n';
  summary += '='.repeat(60) + '\n\n';

  if (data.metrics) {
    const duration = data.metrics.http_req_duration;
    if (duration && duration.values) {
      summary += `Response Times:\n`;
      summary += `  Avg: ${Math.round(duration.values.avg)} ms\n`;
      summary += `  P95: ${Math.round(duration.values['p(95)'])} ms\n`;
      summary += `  Max: ${Math.round(duration.values.max)} ms\n\n`;
    }

    const reqs = data.metrics.http_reqs;
    if (reqs && reqs.values) {
      summary += `Total Requests: ${reqs.values.count}\n`;
    }
  }

  summary += '\n' + '='.repeat(60) + '\n';
  return summary;
}
