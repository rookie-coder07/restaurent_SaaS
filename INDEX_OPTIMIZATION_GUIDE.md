# Performance Optimization: Add Database Indexes for is_deleted Filters

## Problem
- Order creation endpoint times out after 30 seconds
- GET /orders/open takes 4.1 seconds
- GET /tables takes 3.1 seconds
- Multiple filtered queries without proper indexes

## Root Causes
1. **No index on `is_deleted` column** - Full table scans when filtering deleted orders
2. **Composite filters without indexes** - Queries filtering on restaurant_id, table_id, is_deleted, is_archived, payment_status
3. **Nested selects** - Order queries include order_items and menu_items joins

## Solution: Create Database Indexes

### Indexes to Add

1. **Simple is_deleted index**
   ```sql
   CREATE INDEX idx_orders_is_deleted on orders(is_deleted);
   ```
   - Used by all queries that filter deleted orders

2. **Composite index for getActiveOrderByTable**
   ```sql
   CREATE INDEX idx_orders_active_by_table 
     on orders(restaurant_id, table_id, is_deleted, is_archived, payment_status) 
     WHERE is_deleted = false AND is_archived = false AND payment_status != 'paid';
   ```
   - Filters: restaurant_id, table_id, is_deleted, is_archived, payment_status
   - Query: Find active order for a specific table

3. **Composite index for getActiveTableStates**
   ```sql
   CREATE INDEX idx_orders_active_states 
     on orders(restaurant_id, is_deleted, is_archived, payment_status) 
     WHERE is_deleted = false AND is_archived = false AND payment_status != 'paid';
   ```
   - Filters: restaurant_id, is_deleted, is_archived, payment_status
   - Query: Get all active tables for a restaurant

4. **Timeline index with is_deleted**
   ```sql
   CREATE INDEX idx_orders_restaurant_created_deleted 
     on orders(restaurant_id, created_at DESC, is_deleted);
   ```
   - Used for timeline and history queries

## How to Apply

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Create new query
4. Copy and paste the content from: `backend/src/config/migrations/2026-04-14-optimize-is_deleted-filters.sql`
5. Click "Run"
6. Wait for success message

### Option 2: Via psql CLI
```bash
psql -U postgres -h db.xxx.supabase.co -d restaurant_saas < backend/src/config/migrations/2026-04-14-optimize-is_deleted-filters.sql
```

### Option 3: Via Node script
```bash
npm run migrate:optimize-indexes
```

## Expected Improvements

After applying these indexes:

| Query | Before | After | Improvement |
|-------|--------|-------|-------------|
| GET /orders/open | 4.1s | ~500ms | 8x faster |
| GET /tables | 3.1s | ~600ms | 5x faster |
| POST /v1/customer/orders | 30s timeout | ~3s | 10x faster |
| getActiveOrderByTable | 1.4s | ~300ms | 4x faster |

## Performance Monitoring

After deployment, monitor these endpoints:
1. `GET /api/v1/orders/open` - Should complete in < 1 second
2. `POST /api/v1/customer/orders` - Should complete in < 3 seconds
3. `GET /api/v1/tables` - Should complete in < 1 second

## Verification Steps

1. Test customer order creation - previously timed out at 30s
2. Check backend logs for query times - should show dramatic improvement
3. Monitor database metrics in Supabase dashboard - should show lower query times

## Notes

- Partial indexes (with WHERE clause) are more efficient than full indexes
- The WHERE clauses match the filter conditions in the queries
- ANALYZE command updates query planner statistics
- Indexes may take 1-2 minutes to be fully applied
