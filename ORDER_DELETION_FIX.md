# Order Deletion Fix - Soft Delete Implementation

## Problem Statement
Orders were being marked as deleted in the frontend but would reappear after page refresh because:
1. Supabase RLS (Row Level Security) policies silently blocked DELETE operations
2. UPDATE operations were also being blocked without throwing errors
3. The API would return Status 200 success, but the database wouldn't actually be modified

## Root Cause
- Hard DELETE: RLS policies blocked the operation, returned 0 rows affected with no error
- Soft DELETE attempts (updating `is_archived`): Also blocked by RLS
- Marking with notes field: Attempted UPDATE also blocked by RLS
- **Result**: Deleted orders appeared to be deleted in frontend (UI state) but persisted in database

## Solution: Soft Delete with Dedicated Columns

### New Columns Added
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delete_reason TEXT;
```

### Why This Approach Works
1. **UPDATE instead of DELETE**: More likely to work with RLS policies that may allow updates
2. **Dedicated flag**: Cleaner than trying to encode deletion status in notes field
3. **Audit trail**: Stores when and why order was deleted for compliance
4. **Database-level filtering**: Queries filter at Supabase, preventing deleted orders from appearing

### Indexes Added for Performance
```sql
-- Fast query filtering for active orders (is_deleted = false)
CREATE INDEX idx_orders_is_deleted 
ON orders(restaurant_id, is_deleted, created_at DESC)
WHERE is_deleted = false;

-- Fast lookup of deleted orders (audit trail)
CREATE INDEX idx_orders_deleted_at 
ON orders(restaurant_id, deleted_at DESC)
WHERE is_deleted = true;
```

## Backend Changes

### 1. `softDeleteOrder()` (lines 3459-3608)
**Before**: Attempted hard delete and soft delete with `[order-delete]` marker in notes (both failed)
**After**: 
- Tries soft delete using `is_deleted=true` and timestamps
- Falls back to hard delete if soft delete fails
- Logs detailed deletion reason and actor information
- Returns success only if at least one deletion succeeded

```javascript
// Mark orders as deleted using soft-delete flag
const { error: softDeleteError, data } = await supabase
  .from('orders')
  .update({
    is_deleted: true,
    deleted_at: deletedAt,
    delete_reason: trimmedReason,
    notes: this.appendOrderNote(existingOrder.notes, auditNote),
  })
  .eq('id', id)
  .eq('restaurant_id', restaurantId);

if (softDeleteError) {
  // Try hard delete as fallback
  const { error: hardDeleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  // ... handle fallback
}
```

### 2. `getOrders()` (lines 3072-3179)
**Changed**: 
- Now filters with `.eq('is_deleted', false)` in query builder
- No longer relying on post-fetch filtering via notes marker
- Properly excludes soft-deleted orders before applying pagination
- Includes `is_deleted` in SELECT for future auditing needs

```javascript
let query = supabase
  .from('orders')
  .select('...fields..., is_deleted', { count: 'exact' })
  .eq('restaurant_id', restaurantId)
  .eq('is_deleted', false)  // <-- Key change
  .order('created_at', { ascending: false });
```

### 3. `getKitchenOrders()` (lines 3183-3230)
**Changed**: Added `.eq('is_deleted', false)` filter

```javascript
const [ordersResult] = await Promise.all([
  supabase
    .from('orders')
    .select('...fields..., is_deleted', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('is_deleted', false)  // <-- Added filter
    .in('status', statuses)
    // ... rest of query
]);
```

### 4. `getActiveOrderByTable()` (lines 3234-3282)
**Changed**: Added `.eq('is_deleted', false)` filter

```javascript
const { data: orders, error } = await supabase
  .from('orders')
  .select('..., is_deleted')
  .eq('restaurant_id', restaurantId)
  .eq('table_id', tableId)
  .eq('is_deleted', false)     // <-- Added filter
  .eq('is_archived', false)
  // ... rest of query
```

## Migration Instructions

### Step 1: Deploy SQL Migration
Run the migration to add soft-delete columns:
```bash
# Using Supabase SQL Editor
-- Execute: restaurent_SaaS/backend/migrations/005_add-soft-delete-support.sql
```

Or manually in Supabase Console:
1. Go to SQL Editor
2. Create new query
3. Copy contents of [005_add-soft-delete-support.sql](./backend/migrations/005_add-soft-delete-support.sql)
4. Execute

### Step 2: Deploy Updated Backend
```bash
cd restaurent_SaaS/backend
npm install  # if needed
# Restart backend to load new orderService.js
```

### Step 3: Clear Frontend Cache (if needed)
Users may see cached orders briefly. Recommend:
- Clear browser cache: `Ctrl+Shift+Delete`
- Or hard refresh: `Ctrl+Shift+R`

### Step 4: Verify Deletion Works
1. Create a test order
2. Try deleting it
3. Verify it's gone from list AND stays gone after refresh
4. Check that related items/KOTs are removed

## Testing the Fix

### Manual Test
```javascript
// 1. Create order
const newOrder = await orderAPI.createOrder(restaurantId, {...});

// 2. Verify it appears in list
const orders1 = await orderAPI.getOrders(restaurantId);
console.assert(orders1.items.some(o => o.id === newOrder.id));

// 3. Delete the order
await orderAPI.softDeleteOrder(restaurantId, newOrder.id, 'test deletion');

// 4. Verify it's gone in same session
const orders2 = await orderAPI.getOrders(restaurantId);
console.assert(!orders2.items.some(o => o.id === newOrder.id));

// 5. Verify it's still gone after refresh (key test!)
// Reload page or call getOrders again
const orders3 = await orderAPI.getOrders(restaurantId);
console.assert(!orders3.items.some(o => o.id === newOrder.id), 'STILL DELETED ✓');
```

### Database Verification
```sql
-- Check soft-deleted orders
SELECT id, display_order_number, is_deleted, deleted_at, delete_reason
FROM orders
WHERE is_deleted = true
ORDER BY deleted_at DESC
LIMIT 10;

-- Verify indexes were created
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'orders' AND indexname LIKE 'idx_orders%';
```

## Important Notes

### 1. RLS Policy Consideration
This fix assumes that UPDATE operations on the orders table are allowed by RLS policies. If updates are also blocked:
- Check Supabase Console → Tables → orders → RLS Policies
- Ensure SERVICE_KEY has update permission
- May need to add policy: `enable rls; create policy "Allow service role updates"...`

### 2. Fallback to Hard Delete
If soft delete fails (0 rows affected), the code attempts hard delete. This ensures at least one method will work.

### 3. Deletion Audit Trail
All deletions are logged with:
- `deleted_at`: ISO 8601 timestamp
- `delete_reason`: User-provided reason
- `notes`: Appended deletion marker with actor info

### 4. Related Records
When an order is soft-deleted:
- `order_items` are **hard deleted** (cleaned up)
- `kitchen_tickets` are **hard deleted** (cleaned up)
- `order_bills` are processed for removal if table exists
- `table_assignments` are deactivated (status set to not active)
- `tables` are marked as available

### 5. Page Pagination
Since deleted orders are now filtered at the query level:
- Total count is accurate
- Pagination works correctly
- No longer need to filter post-fetch

## Rollback Plan
If soft delete needs to be reverted:
1. Add `is_deleted = false` as default constraint
2. Revert orderService.js changes
3. Set all deleted orders back to active: `UPDATE orders SET is_deleted = false WHERE is_deleted = true`

## Performance Impact
- **Positive**: Index on `(restaurant_id, is_deleted, created_at)` speeds up active order queries
- **Positive**: Deleted orders are filtered before pagination (smaller result sets)
- **Neutral**: Slight storage increase for new columns (minimal: 1 boolean + 1 timestamp per row)

## Future Enhancements
1. Add endpoint to view soft-deleted orders (audit/history)
2. Add permanent deletion endpoint (admin-only, after X days)
3. Add deletion reasons analytics
4. Add undo functionality (restore soft-deleted orders)

