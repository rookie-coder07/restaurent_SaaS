/**
 * Node.js Load Test for POS SaaS
 * Alternative to K6 - No installation needed
 * 
 * Usage: node load-test.js
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3000';
const RESTAURANTS = ['restaurant-001', 'restaurant-002', 'restaurant-003'];

// ============ METRICS ============
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeouts: 0,
  latencies: [],
  responseTimes: {
    orders: [],
    tables: [],
    kitchen: [],
    analytics: [],
  },
  errors: [],
  startTime: 0,
  endTime: 0,
};

// ============ HELPERS ============
function getRandomRestaurant() {
  return RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)];
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function calculateStats(latencies) {
  if (latencies.length === 0) return {};
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// ============ API CALLS ============
async function callAPI(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Restaurant-Id': getRandomRestaurant(),
        'Authorization': 'Bearer test-token-001', // Add auth header
      },
      body: body ? JSON.stringify(body) : null,
      timeout: 10000,
    });

    const duration = performance.now() - startTime;
    metrics.totalRequests++;

    if (response.ok) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errors.push(`${endpoint}: ${response.status}`);
    }

    metrics.latencies.push(duration);
    return duration;
  } catch (err) {
    const duration = performance.now() - startTime;
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.timeouts++;
    metrics.errors.push(`${endpoint}: ${err.message}`);
    return duration;
  }
}

// ============ LOAD TEST STAGES ============
async function stage1_warmup() {
  console.log('\n📈 STAGE 1: Warm-up (50 VUs for 10 seconds)');
  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < 10000) {
    const promises = [];

    // 50 concurrent requests
    for (let i = 0; i < 50; i++) {
      const endpoint = [
        `/api/v1/orders?limit=20&offset=0`,
        `/api/v1/tables?limit=50&offset=0`,
        `/api/v1/kitchen/pending?limit=50`,
      ][Math.floor(Math.random() * 3)];

      promises.push(
        callAPI(endpoint).then(duration => {
          if (endpoint.includes('orders')) {
            metrics.responseTimes.orders.push(duration);
          } else if (endpoint.includes('tables')) {
            metrics.responseTimes.tables.push(duration);
          } else {
            metrics.responseTimes.kitchen.push(duration);
          }
        })
      );
    }

    await Promise.all(promises);
    requestCount += 50;
    process.stdout.write(`\r  Requests: ${requestCount}`);
  }

  console.log(`\n  ✅ Completed: ${requestCount} requests`);
}

async function stage2_rampup() {
  console.log('\n📈 STAGE 2: Ramp-up to 200 VUs (30 seconds)');
  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < 30000) {
    const elapsed = Date.now() - startTime;
    const vus = Math.floor(50 + (elapsed / 30000) * 150); // 50 → 200

    const promises = [];
    for (let i = 0; i < vus; i++) {
      const endpoint = [
        `/api/v1/orders?limit=20&offset=0`,
        `/api/v1/tables?limit=50&offset=0`,
        `/api/v1/kitchen/pending?limit=50`,
      ][Math.floor(Math.random() * 3)];

      promises.push(
        callAPI(endpoint).then(duration => {
          if (endpoint.includes('orders')) {
            metrics.responseTimes.orders.push(duration);
          } else if (endpoint.includes('tables')) {
            metrics.responseTimes.tables.push(duration);
          } else {
            metrics.responseTimes.kitchen.push(duration);
          }
        })
      );
    }

    await Promise.all(promises);
    requestCount += vus;
    process.stdout.write(`\r  VUs: ${vus} | Requests: ${requestCount}`);
  }

  console.log(`\n  ✅ Completed: ${requestCount} requests`);
}

async function stage3_spike() {
  console.log('\n📈 STAGE 3: SPIKE to 300 VUs (20 seconds)');
  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < 20000) {
    const promises = [];

    // 300 concurrent requests
    for (let i = 0; i < 300; i++) {
      const endpoint = [
        `/api/v1/orders?limit=20&offset=0`,
        `/api/v1/tables?limit=50&offset=0`,
        `/api/v1/kitchen/pending?limit=50`,
        `/api/v1/analytics/summary?days=7`, // Heavy query
      ][Math.floor(Math.random() * 4)];

      promises.push(
        callAPI(endpoint).then(duration => {
          if (endpoint.includes('orders')) {
            metrics.responseTimes.orders.push(duration);
          } else if (endpoint.includes('tables')) {
            metrics.responseTimes.tables.push(duration);
          } else if (endpoint.includes('kitchen')) {
            metrics.responseTimes.kitchen.push(duration);
          } else {
            metrics.responseTimes.analytics.push(duration);
          }
        })
      );
    }

    await Promise.all(promises);
    requestCount += 300;
    process.stdout.write(`\r  VUs: 300 | Requests: ${requestCount}`);
  }

  console.log(`\n  ✅ Completed: ${requestCount} requests`);
}

async function stage4_cooldown() {
  console.log('\n📈 STAGE 4: Cool-down (10 seconds)');
  const startTime = Date.now();
  let requestCount = 0;

  while (Date.now() - startTime < 10000) {
    const promises = [];

    // 50 concurrent requests (cool down)
    for (let i = 0; i < 50; i++) {
      const endpoint = [
        `/api/v1/orders?limit=20&offset=0`,
        `/api/v1/tables?limit=50&offset=0`,
      ][Math.floor(Math.random() * 2)];

      promises.push(callAPI(endpoint));
    }

    await Promise.all(promises);
    requestCount += 50;
    process.stdout.write(`\r  Requests: ${requestCount}`);
  }

  console.log(`\n  ✅ Completed: ${requestCount} requests`);
}

// ============ REPORT ============
function printReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 LOAD TEST REPORT');
  console.log('='.repeat(70));

  const duration = metrics.endTime - metrics.startTime;
  const successRate = ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2);
  const rps = (metrics.totalRequests / (duration / 1000)).toFixed(2);

  console.log('\n📈 SUMMARY');
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Successful: ${metrics.successfulRequests}`);
  console.log(`  Failed: ${metrics.failedRequests}`);
  console.log(`  Timeouts: ${metrics.timeouts}`);
  console.log(`  Success Rate: ${successRate}%`);
  console.log(`  Requests/sec: ${rps}`);
  console.log(`  Duration: ${formatTime(duration)}`);

  console.log('\n⏱️  RESPONSE TIMES');
  const allStats = calculateStats(metrics.latencies);
  console.log(`  Overall:`);
  console.log(`    Min: ${formatTime(allStats.min)}`);
  console.log(`    Avg: ${formatTime(allStats.avg)}`);
  console.log(`    Median: ${formatTime(allStats.median)}`);
  console.log(`    P95: ${formatTime(allStats.p95)}`);
  console.log(`    P99: ${formatTime(allStats.p99)}`);
  console.log(`    Max: ${formatTime(allStats.max)}`);

  if (metrics.responseTimes.orders.length > 0) {
    const stats = calculateStats(metrics.responseTimes.orders);
    console.log(`\n  Orders API:`);
    console.log(`    Avg: ${formatTime(stats.avg)} | P95: ${formatTime(stats.p95)} | Max: ${formatTime(stats.max)}`);
  }

  if (metrics.responseTimes.tables.length > 0) {
    const stats = calculateStats(metrics.responseTimes.tables);
    console.log(`  Tables API:`);
    console.log(`    Avg: ${formatTime(stats.avg)} | P95: ${formatTime(stats.p95)} | Max: ${formatTime(stats.max)}`);
  }

  if (metrics.responseTimes.kitchen.length > 0) {
    const stats = calculateStats(metrics.responseTimes.kitchen);
    console.log(`  Kitchen API:`);
    console.log(`    Avg: ${formatTime(stats.avg)} | P95: ${formatTime(stats.p95)} | Max: ${formatTime(stats.max)}`);
  }

  if (metrics.responseTimes.analytics.length > 0) {
    const stats = calculateStats(metrics.responseTimes.analytics);
    console.log(`  Analytics API:`);
    console.log(`    Avg: ${formatTime(stats.avg)} | P95: ${formatTime(stats.p95)} | Max: ${formatTime(stats.max)}`);
  }

  console.log('\n✅ PERFORMANCE TARGETS');
  const avgStats = calculateStats(metrics.latencies);
  console.log(`  Avg Response < 400ms: ${avgStats.avg < 400 ? '✅' : '❌'} (${formatTime(avgStats.avg)})`);
  console.log(`  P95 Response < 700ms: ${avgStats.p95 < 700 ? '✅' : '❌'} (${formatTime(avgStats.p95)})`);
  console.log(`  P99 Response < 1500ms: ${avgStats.p99 < 1500 ? '✅' : '❌'} (${formatTime(avgStats.p99)})`);
  console.log(`  Success Rate > 99%: ${successRate > 99 ? '✅' : '❌'} (${successRate}%)`);

  if (metrics.errors.length > 0) {
    console.log('\n⚠️  TOP ERRORS');
    const errorCounts = {};
    metrics.errors.forEach(err => {
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([err, count]) => {
        console.log(`  ${err}: ${count} times`);
      });
  }

  console.log('\n' + '='.repeat(70));
}

// ============ MAIN ============
async function main() {
  console.log('🚀 POS SaaS Load Test');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log('⏱️  Duration: ~70 seconds (4 stages)');

  // Check if server is running
  try {
    console.log('\n⏳ Checking server connection...');
    const response = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 });
    if (!response.ok) {
      console.error('❌ Server not responding. Start backend with: npm start');
      process.exit(1);
    }
    console.log('✅ Server connected!');
  } catch (err) {
    console.error('❌ Cannot connect to server:', err.message);
    console.error('   Start backend with: cd backend && npm start');
    process.exit(1);
  }

  metrics.startTime = Date.now();

  try {
    await stage1_warmup();
    await stage2_rampup();
    await stage3_spike();
    await stage4_cooldown();
  } catch (err) {
    console.error('❌ Test error:', err.message);
  }

  metrics.endTime = Date.now();
  printReport();
}

main().catch(console.error);
