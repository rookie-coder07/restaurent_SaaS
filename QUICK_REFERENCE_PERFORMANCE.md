# QUICK REFERENCE - PERFORMANCE OPTIMIZATIONS

## For Developers

### Using Cache Manager
```javascript
import { cacheManager } from '../utils/cacheManager.js';

// Set cache
cacheManager.set('key', value, 300); // 300 second TTL

// Get cache
const cached = cacheManager.get('key');

// Delete cache
cacheManager.delete('key');

// Clear all
cacheManager.clear();

// Check stats
console.log(cacheManager.getStats());
```

### Using Performance Monitor
```javascript
import { performanceMonitor } from '../utils/performanceMonitor.js';

// Get stats
const stats = performanceMonitor.getStats();
console.table(stats);

// Record custom request
performanceMonitor.recordRequest('GET', '/api/orders', 250, 200);

// Log stats
performanceMonitor.logStats();
```

### Response Optimization
```javascript
import { optimizeOrderResponse, stripDatabaseFields } from '../utils/responseOptimizer.js';

// Optimize order
const optimized = optimizeOrderResponse(order);

// Strip unnecessary fields
const cleaned = stripDatabaseFields(data);
```

### Pagination Usage
```javascript
// Middleware automatically extracts pagination
// Access via req.pagination
const { limit, offset, page } = req.pagination;

// Default: limit=20, offset=0
// Can override: /api/v1/orders?limit=50&offset=50
```

---

## Service Changes

### OrderService
```javascript
// OLD - No pagination
const orders = await OrderService.getOrdersByRestaurant(restaurantId, filters);

// NEW - With pagination
const orders = await OrderService.getOrdersByRestaurant(restaurantId, {
  status: 'completed',
  limit: 20,
  offset: 0
});
```

### TableService
```javascript
// OLD - No pagination
const tables = await TableService.getTablesByRestaurant(restaurantId);

// NEW - With pagination
const tables = await TableService.getTablesByRestaurant(restaurantId, {
  status: 'available',
  location: 'main',
  limit: 50,
  offset: 0
});
```

### MenuService
```javascript
// OLD
const items = await MenuService.getMenuItems(restaurantId);

// NEW - With pagination
const items = await MenuService.getMenuItems(restaurantId, {
  categoryId: '123',
  limit: 100,
  offset: 0
});
```

### KitchenService
```javascript
// OLD - No pagination
const pending = await KitchenService.getPendingOrders(restaurantId);

// NEW - With pagination
const pending = await KitchenService.getPendingOrders(restaurantId, 50, 0);
```

### AnalyticsService
```javascript
// Result is automatically cached for 5 minutes
const summary = await AnalyticsService.getAnalyticsSummary(restaurantId, 7);
```

---

## API Endpoints

### Orders
```
GET    /api/v1/orders?limit=20&offset=0&status=pending
GET    /api/v1/orders/:orderId
POST   /api/v1/orders
PATCH  /api/v1/orders/:orderId/status
```

### Tables
```
GET    /api/v1/tables?limit=50&offset=0&status=available
GET    /api/v1/tables/:tableId
POST   /api/v1/tables
PATCH  /api/v1/tables/:tableId/status
```

### Kitchen
```
GET    /api/v1/kitchen/pending?limit=50&offset=0
GET    /api/v1/kitchen/in-progress?limit=50&offset=0
GET    /api/v1/kitchen/ready?limit=50&offset=0
GET    /api/v1/kitchen/stats
```

### Menu
```
GET    /api/v1/menu/categories
GET    /api/v1/menu/items?limit=100&offset=0&categoryId=123
GET    /api/v1/menu/items/:itemId
```

### Analytics
```
GET    /api/v1/analytics/summary?days=7
GET    /api/v1/analytics/metrics?startDate=2024-01-01&endDate=2024-01-31
```

---

## Cache Invalidation

When data changes, invalidate relevant caches:

```javascript
// In updateOrderStatus
cacheManager.delete(`order:${orderId}`);
cacheManager.delete(`orders:${restaurantId}:all:20:0`);

// In updateTableStatus
cacheManager.delete(`table:${tableId}`);
cacheManager.delete(`tables:${restaurantId}:${status}:50:0`);

// In updateMenuItem
cacheManager.delete(`menu_item:${itemId}`);
cacheManager.delete(`menu_items:${restaurantId}:${categoryId}:100:0`);
```

---

## Query Pattern - DO'S AND DON'Ts

### ✅ DO
```javascript
// Specific field selection
.select('id, name, price, status')

// Add pagination
.range(offset, offset + limit - 1)

// Order by indexed fields
.order('created_at', { ascending: false })

// Filter by indexed columns
.eq('restaurant_id', restaurantId)
.eq('status', 'pending')

// Use Promise.all for parallel queries
await Promise.all([query1, query2])
```

### ❌ DON'T
```javascript
// Wildcard selection
.select('*')

// Load all rows without limit
// No pagination

// Complex OR queries
.or('status.eq.pending,status.eq.in_progress')

// Sequential dependent queries
const a = await query1();
const b = await query2();

// Nested query overloading
.select('*, orders(*, order_items(*))')
```

---

## Performance Targets

### API Response Times
- Simple queries: 50-100ms
- Complex queries: 100-300ms
- With cache: 5-20ms
- Target avg: < 400ms
- Target P95: < 700ms

### Database
- Query time: < 100ms
- Index usage: > 95%
- Connection pool: < 50% utilization

### Cache
- Hit rate: > 60%
- TTL: 30s-10m depending on data freshness
- Size: < 100MB

---

## Debugging Performance

### Check Cache Hit Rate
```javascript
const stats = performanceMonitor.getStats();
console.log(`Cache Hit Rate: ${stats.cacheHitRate}`);
// Target: > 60%
```

### Check Slow Queries
```javascript
const slowQueries = performanceMonitor.getRecentSlowQueries(10);
console.table(slowQueries);
// Look for queries > 500ms
```

### Monitor Request Times
```javascript
const stats = performanceMonitor.getStats();
console.log(`Avg: ${stats.avgDuration}ms`);
console.log(`P95: ${stats.p95Duration}ms`);
console.log(`P99: ${stats.p99Duration}ms`);
```

---

## Common Patterns

### Fetch with Caching
```javascript
const cacheKey = `data:${id}:${filter}`;
const cached = cacheManager.get(cacheKey);
if (cached) return cached;

const data = await service.getData(id, filter);
cacheManager.set(cacheKey, data, 300);
return data;
```

### Paginated List
```javascript
const limit = Math.min(parseInt(req.query.limit) || 20, 100);
const offset = Math.max(parseInt(req.query.offset) || 0, 0);

const items = await service.getItems(restaurantId, { limit, offset });
const hasMore = items.length === limit;

return sendSuccess(res, 200, items, 'Success', {
  pagination: { limit, offset, hasMore }
});
```

### Batch Operations
```javascript
const [orders, tables, stats] = await Promise.all([
  OrderService.getPendingOrders(restaurantId),
  TableService.getAvailableTables(restaurantId),
  AnalyticsService.getOrderMetrics(restaurantId, startDate, endDate)
]);
```

---

## Integration Checklist

When adding new endpoints:

- [ ] Use specific field selection (not *)
- [ ] Add pagination support
- [ ] Add caching if applicable (GET requests)
- [ ] Invalidate cache on write operations
- [ ] Use .range() for pagination
- [ ] Filter by indexed columns
- [ ] Batch parallel queries with Promise.all()
- [ ] Remove unnecessary fields from response
- [ ] Add documentation with examples

---

## Files Reference

### Core Optimization Files
- `src/utils/cacheManager.js` - Cache management
- `src/utils/performanceMonitor.js` - Performance metrics
- `src/middleware/performanceMiddleware.js` - Middleware

### Service Files (All Optimized)
- `src/services/orderService_supabase.js`
- `src/services/tableService_supabase.js`
- `src/services/menuService_supabase.js`
- `src/services/kitchenService_supabase.js`
- `src/services/analyticsService_supabase.js`

### Documentation
- `PERFORMANCE_OPTIMIZATION_SUMMARY.md` - Full details
- `DEPLOYMENT_AND_TESTING.md` - Deployment guide
- `FRONTEND_OPTIMIZATIONS.md` - Frontend patterns

---

## Support & Questions

For questions about specific implementations:
1. Check `PERFORMANCE_OPTIMIZATION_SUMMARY.md` for overview
2. Check specific service file comments
3. Check `OPTIMIZATION_EXAMPLES.js` for patterns
4. Review migration file for index details

---

**Last Updated: April 10, 2026**
