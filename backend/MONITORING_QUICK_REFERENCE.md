# QUICK REFERENCE - MONITORING & HARDENING

## Endpoints

```
GET    /health                    Simple health check
GET    /api/v1/health/health      Detailed health check
GET    /api/v1/health/metrics     Performance metrics
GET    /api/v1/health/alerts      Active alerts
DELETE /api/v1/health/alerts      Clear old alerts
```

## Error Handling in Endpoints

```javascript
import { asyncHandler } from '../middleware/errorHandler.js';

export const myController = asyncHandler(async (req, res) => {
  // Fail-safe guard
  if (!req.body?.orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID required'
    });
  }

  // Operation
  const result = await db.orders.find(req.body.orderId);

  // Response
  res.json({
    success: true,
    data: result
  });
});
```

## Logging

```javascript
import {
  logError,
  logWarn,
  logInfo,
  logCriticalError,
  logDatabaseError,
  logSlowAPI
} from '../utils/logger.js';

// Error
logError('Operation failed', error, { userId: '123' });

// Critical (triggers alert)
logCriticalError('Payment failed', error, userId);

// Database error
logDatabaseError('Query failed', error);

// Slow API
logSlowAPI('/api/orders', 'POST', 1500, 1000);
```

## Rate Limiting

```javascript
import { authLimiter, paymentLimiter } from '../middleware/rateLimiter.js';

router.post('/login', authLimiter, loginController);
router.post('/settle', paymentLimiter, settleController);
```

## Timeout Protection

```javascript
import { withTimeout } from '../middleware/timeout.js';

// Database with timeout
const data = await withTimeout(
  () => supabase.from('orders').select('*'),
  5000,
  'Fetch orders'
);

// External API with timeout
const response = await withTimeout(
  () => fetch('https://api.example.com/data'),
  5000,
  'External API'
);
```

## Monitoring Service

```javascript
import { monitoringService } from '../services/monitoringService.js';

// Start/stop monitoring
monitoringService.start();
monitoringService.stop();

// Check status
const status = monitoringService.getStatus();
```

## Alerts

```javascript
import { alertService } from '../services/alertService.js';

// Subscribe to alerts
alertService.subscribe((alert) => {
  if (alert.severity === 'critical') {
    // Send to Slack, PagerDuty, etc
  }
});

// Check thresholds
alertService.setThreshold('errorRate', 10); // 10%
```

## Health monitoring status

### Status Codes
- 200 - Healthy
- 503 - Degraded
- 408 - Timeout
- 429 - Rate limited
- 400 - Validation error
- 500 - Server error

### Response Format
```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Alert Types Tracked

| Type | Severity | Threshold |
|------|----------|-----------|
| ERROR_RATE_HIGH | Critical | >5% |
| HIGH_LATENCY | Warning | >1000ms |
| P95_LATENCY_HIGH | Critical | >2000ms |
| DB_CONNECTION_FAILED | Critical | N/A |
| HIGH_MEMORY_USAGE | Warning | >85% |
| BILLING_ERROR_DETECTED | Critical | Any error |
| SLOW_APIS | Warning | >10 calls |

## Middleware Order
1. requestId - Unique tracking
2. compression - Gzip
3. parsing - JSON/form
4. timeout - Request timeout
5. CORS - Cross-origin
6. rateLimit - Rate limiting
7. monitoring - Metrics
8. sanitization - Security
9. routes - API endpoints
10. errorHandler - Error handling

## Common Patterns

### Safe Property Access
```javascript
const value = obj?.property ?? 'default';
const item = items?.[0];
const result = data?.map?.(d => d.value) || [];
```

### Fail-Safe Checks
```javascript
if (!data) return;
if (!Array.isArray(arr) || arr.length === 0) return;
if (typeof value !== 'number' || value < 0) return;
```

### Error Response
```javascript
res.status(statusCode).json({
  success: false,
  message: 'error message'
});
```

### Success Response
```javascript
res.json({
  success: true,
  data: result
});
```

## Key Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Error Rate | <1% | >5% |
| Avg Latency | <400ms | >1s |
| P95 Latency | <800ms | >2s |
| Memory | <60% | >85% |
| Uptime | 100% | Any down |

## Testing

```bash
# Health check
curl http://localhost:5000/health

# Detailed health
curl http://localhost:5000/api/v1/health/health

# Metrics
curl http://localhost:5000/api/v1/health/metrics

# Alerts
curl http://localhost:5000/api/v1/health/alerts

# Rate limit (send 110 requests)
for i in {1..110}; do curl http://localhost:5000/api/health; done
```

## Status: ✅ PRODUCTION READY
