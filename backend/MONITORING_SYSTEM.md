# MONITORING & ALERTING SYSTEM

## Overview

Production-grade monitoring and alerting system with:
- Real-time API response metrics
- Error tracking and alerting
- Database monitoring
- Memory/CPU usage tracking
- Slow API detection (>1s)
- Request rate limiting
- Health checks
- Graceful error handling

---

## Monitoring Endpoints

### Health Check
```
GET /health
GET /api/v1/health/health
```

Returns:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "checks": {
      "api": { "status": "ok", "latency": 5 },
      "database": { "status": "ok", "latency": 12 },
      "memory": { "status": "ok", "usage": 45 }
    },
    "metrics": {
      "totalRequests": 1250,
      "errorRate": "0.8%",
      "avgResponseTime": "34ms",
      "uptime": "45 minutes"
    }
  }
}
```

### Metrics
```
GET /api/v1/health/metrics
```

Returns detailed metrics including:
- Total requests
- Error count
- Success count
- Average response time
- Slow API count
- Endpoint-specific metrics

### Alerts
```
GET /api/v1/health/alerts
GET /api/v1/health/alerts?type=ERROR_RATE_HIGH
GET /api/v1/health/alerts?limit=50
DELETE /api/v1/health/alerts?hoursOld=24
```

---

## Error Handling

### Global Error Handler
All errors are caught and handled with:
- Automatic logging with context
- Safe error responses (no internal details in production)
- Structured error format
- Status code mapping

### Fail-Safe Guards
- Null/undefined checks
- Safe property access (optional chaining)
- Early returns on invalid data
- Default fallbacks

### Error Response Format
```json
{
  "success": false,
  "message": "descriptive error message",
  "code": "ERROR_CODE"
}
```

---

## Rate Limiting

### Default Limits
- **Default**: 100 requests/minute per IP
- **Auth**: 5 requests/5min per user
- **API**: 1000 requests/minute per user
- **Payment**: 10 requests/minute per user

### Rate Limit Headers
```
X-RateLimit-Remaining: 45
```

---

## Request Timeout Protection

### Timeout Settings
- Default: 30 seconds per request
- Database queries: 5 seconds
- External API calls: 5 seconds

### Timeout Error
```
408 Request Timeout
```

---

## Logging System

### Log Files
- `logs/error.log` - Error logs only
- `logs/app.log` - All application logs
- `logs/slow-queries.log` - Queries >1s
- `logs/api-errors.log` - API errors

### Log Format
```
2024-04-10 14:23:45 [error]: Database connection failed
  {
    "error": "Connection timeout",
    "userId": "user123",
    "timestamp": "2024-04-10T14:23:45.123Z"
  }
```

### Structured Logging Functions
```javascript
import { logError, logWarn, logInfo, logDebug } from '../utils/logger.js';
import { logSlowAPI, logSlowQuery } from '../utils/logger.js';
import { logCriticalError, logDatabaseError } from '../utils/logger.js';

// Error logging
logError('Order creation failed', error, { orderId: '123', userId: 'user1' });

// Critical errors (triggers alert)
logCriticalError('Payment processing failed', error, userId);

// Database errors
logDatabaseError('User query failed', error, { query: 'SELECT * FROM users' });

// API errors
logAPIError('/api/orders', 'POST', 500, error);

// Slow queries/APIs (>1s)
logSlowAPI('/api/orders', 'GET', 1200, 1000);
logSlowQuery('SELECT * FROM large_table', 2500, 1000);
```

---

## Alert System

### Alert Types
- `ERROR_RATE_HIGH` - Error rate >5%
- `HIGH_LATENCY` - Avg latency >1s
- `P95_LATENCY_HIGH` - P95 latency >2s
- `DB_CONNECTION_FAILED` - Database down
- `SERVER_UNHEALTHY` - Health check failed
- `HIGH_MEMORY_USAGE` - Memory >85%
- `HIGH_CPU_USAGE` - CPU >80%
- `BILLING_ERROR_DETECTED` - Billing failures
- `SLOW_APIS` - >10 slow API calls

### Alert Severity
- `critical` - Requires immediate action
- `warning` - Should be investigated
- `info` - Informational

### Alert Thresholds
```javascript
{
  errorRate: 5,              // 5%
  latencyP95: 2000,          // 2000ms
  latencyAvg: 1000,          // 1000ms
  cpuUsage: 80,              // 80%
  memoryUsage: 85,           // 85%
  dbConnectionErrors: 3,     // 3 errors
}
```

### Custom Alert Subscribers
```javascript
import { alertService } from '../services/alertService.js';

alertService.subscribe((alert) => {
  if (alert.severity === 'critical') {
    sendToSlack(alert);  // Send to Slack
    sendSMS(alert);      // Send SMS
    createJiraTicket(alert); // Create Jira ticket
  }
});
```

---

## Monitoring Service

### Automatic Health Checks (Every 30 seconds)
- API response times
- Database connectivity
- Memory usage
- Slow API calls
- Error rates

### Start/Stop Monitoring
```javascript
import { monitoringService } from '../services/monitoringService.js';

// Start monitoring
monitoringService.start();

// Check status
const status = monitoringService.getStatus();

// Stop monitoring
monitoringService.stop();
```

---

## Response Standards

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "error description"
}
```

### All endpoints must return standardized responses

---

## Middleware Stack

1. **requestIdMiddleware** - Unique request tracking
2. **compression** - Gzip compression
3. **timeoutMiddleware** - Request timeout protection
4. **cors** - Cross-origin policy
5. **rateLimiterMiddleware** - Rate limiting
6. **monitoringMiddleware** - Response time tracking
7. **performanceMiddleware** - Performance optimization
8. **paginationMiddleware** - Pagination handling
9. **inputSanitization** - XSS/injection prevention
10. **globalErrorHandler** - Centralized error handling

---

## Implementation Examples

### Wrapping API Endpoints
```javascript
import { asyncHandler } from '../middleware/errorHandler.js';
import { withTimeout } from '../middleware/timeout.js';

export const createOrder = asyncHandler(async (req, res) => {
  const { orderId, items } = req.body;

  // Fail-safe guards
  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID required'
    });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one item required'
    });
  }

  // With timeout protection
  const result = await withTimeout(
    () => db.orders.create({ orderId, items }),
    5000,
    'Order creation'
  );

  res.json({
    success: true,
    data: result
  });
});
```

### Database Operations with Timeout
```javascript
import { withTimeout } from '../middleware/timeout.js';

const order = await withTimeout(
  () => supabase.from('orders').select('*').eq('id', orderId),
  5000,
  'Fetch order'
);
```

### Rate Limiting by Endpoint
```javascript
import { paymentLimiter, authLimiter } from '../middleware/rateLimiter.js';
import { Router } from 'express';

const router = Router();

// 5 requests per 5 minutes for auth
router.post('/login', authLimiter, loginController);

// 10 requests per minute for payments
router.post('/settle', paymentLimiter, settleOrderController);

export default router;
```

---

## Testing Monitoring

### Test Health Check
```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/health/health
```

### Test Metrics
```bash
curl http://localhost:5000/api/v1/health/metrics
```

### Test Alerts
```bash
curl http://localhost:5000/api/v1/health/alerts
```

### Test Rate Limiting
```bash
# Send 110 requests in 1 minute (should fail on 101st)
for i in {1..110}; do curl http://localhost:5000/api/health; done
```

### Test Timeout
```bash
# Make slow request (will timeout after 30s)
curl --max-time 35 http://localhost:5000/api/slow-endpoint
```

---

## Production Monitoring Best Practices

### 1. Monitor Key Endpoints
- POST /api/v1/orders (order creation)
- POST /api/v1/orders/:id/settle (payment settlement)
- GET /api/v1/menu (menu retrieval)
- POST /api/v1/auth/login (authentication)

### 2. Alert on Critical Operations
- Billing failures
- Database disconnections
- Authentication errors
- High error rates

### 3. Set Appropriate Thresholds
- Error rate: <2% (warning), >5% (critical)
- Response time: <400ms (good), >1s (warning), >2s (critical)
- Memory: <60% (good), >85% (warning), >95% (critical)

### 4. Collect Metrics for Analysis
- Track historical error rates
- Monitor latency trends
- Log slow API calls for optimization
- Review error patterns

### 5. Automated Responses
- Auto-scale on high CPU/memory
- Auto-failover on database errors
- Circuit breaker for failing endpoints
- Automatic log rotation

---

## Integration with External Services

### Sentry (Error Tracking)
```javascript
import Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

Sentry.captureException(error);
```

### LogRocket (Session Replay)
```javascript
// Note: LogRocket is primarily for frontend
// For backend, use structured logging
```

### Datadog (APM)
```javascript
const statsd = require('node-dogstatsd').StatsD;
const dog = new statsd();

dog.timing('api.response_time', duration);
dog.increment('api.errors');
```

---

## Status: ✅ PRODUCTION READY

All monitoring, alerting, and error handling systems are:
- ✅ Implemented and tested
- ✅ Production-hardened
- ✅ Fail-safe and resilient
- ✅ Observable and debuggable
- ✅ Scalable and performant
