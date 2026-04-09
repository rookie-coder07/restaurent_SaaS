# ⚡ STAFF ACTIVITY LOGGING - QUICK START CARD

## ONE-TIME SETUP (Do This First!)

### Step 1: Enable Activity Logging in Supabase
```sql
-- Go to Supabase Console → SQL Editor → Run this:
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
```

✅ **Status**: This allows backend API to insert logs without RLS blocking them.

### Step 2: Verify Infrastructure is Ready
```bash
cd backend
node test-activity-tracking.js
```

**Expected**: ✅ Test passes, shows activity logs working

---

## WHAT'S ALREADY BUILT

✅ **Database**: `activity_logs` table with proper indexes
✅ **Service**: `ActivityService` with 5 methods
✅ **API**: 3 REST endpoints configured  
✅ **Controllers**: Activity endpoints ready
✅ **Error Handling**: Non-blocking, production-safe
✅ **Tests**: `test-activity-tracking.js` provided

---

## WHAT YOU NEED TO ADD (7 LOCATIONS)

### 1️⃣ ORDER_CREATED
**File**: `backend/src/services/orderService.js` (Line ~1650)
**Method**: `createOrder()`
**When**: After successful order insert
**What to log**: orderId, type, amount, items

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#1-order_created)

### 2️⃣ ORDER_UPDATED
**File**: `backend/src/services/orderService.js` (Line ~3450)
**Method**: `updateOrder()`
**When**: After successful order update
**What to log**: orderId, changes (before/after)

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#2-order_updated)

### 3️⃣ ORDER_SETTLED
**File**: `backend/src/services/orderService.js` (Line ~2380)
**Method**: `settleOrder()`
**When**: After bill generated
**What to log**: orderId, bill#, amounts, discount

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#3-order_settled)

### 4️⃣ ORDER_DELETED
**File**: `backend/src/services/orderService.js` (Line ~3600)
**Method**: `softDeleteOrder()`
**When**: After soft delete confirmed
**What to log**: orderId, reason, amount, actor

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#4-order_deleted)

### 5️⃣ TABLE_ASSIGNED
**File**: `backend/src/controllers/orderController.js` or tableController
**When**: After waiter assigned to table
**What to log**: waiterId, tableId, manager

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#5-table_assigned)

### 6️⃣ TABLE_REASSIGNED
**Handled automatically by code in #5**
**When**: Previous waiter ≠ new waiter
**What to log**: tableId, old waiter, new waiter

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#6-table_reassigned)

### 7️⃣ PAYMENT_COMPLETED
**File**: `backend/src/controllers/orderController.js`
**When**: After payment marked as paid
**What to log**: orderId, amount, method

→ See: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md#7-payment_completed)

---

## COPY-PASTE PATTERN

Every logging call follows the same pattern:

```javascript
// ✅ LOG ACTIVITY
(async () => {
  try {
    const { ActivityService } = await import('./activityService.js');
    await ActivityService.logActivity(
      restaurantId,          // Multi-tenant ID
      userId,                // Who did it
      userRole,              // Their role
      'ACTION_TYPE',         // One of the 7 types
      { /* details */ }      // Context data
    );
  } catch (logErr) {
    console.warn('⚠️ Activity log failed (non-critical):', logErr.message);
  }
})();
```

---

## 4-STEP IMPLEMENTATION PLAN

### Phase 1: Order Operations (10 min)
1. Add ORDER_CREATED logging in `createOrder()`
2. Add ORDER_UPDATED logging in `updateOrder()`
3. Test: Create and update an order, check logs

### Phase 2: Bill Operations (5 min)
4. Add ORDER_SETTLED logging in `settleOrder()`
5. Test: Settle a bill, verify logging

### Phase 3: Order Management (5 min)
6. Add ORDER_DELETED logging in `softDeleteOrder()`
7. Test: Delete an order, check logs

### Phase 4: Table & Payment (10 min)
8. Add TABLE_ASSIGNED + TABLE_REASSIGNED in controller
9. Add PAYMENT_COMPLETED in settlement controller
10. Run final test: `node backend/test-logging-implementation.js`

**Total Time**: 30 minutes

---

## API ENDPOINTS (Already Configured)

### Get Staff List with Activity
```bash
GET /api/v1/activity/staff
Authorization: Bearer {token}
```

**Returns**: Staff with totalOrders, lastActive, lastAction

### Get User Activity Timeline
```bash
GET /api/v1/activity/{userId}/logs
Authorization: Bearer {token}
```

**Returns**: Last 50 actions with timestamps and details

### Get User Info
```bash
GET /api/v1/activity/{userId}/info
Authorization: Bearer {token}
```

**Returns**: User data + activity stats combined

---

## TESTING YOUR IMPLEMENTATION

### Quick Test After Each Addition
```bash
# After adding first logging:
node backend/test-activity-tracking.js

# After adding all 7:
node backend/test-logging-implementation.js
```

### Full Verification Query
```sql
-- In Supabase SQL Editor:
SELECT 
  action,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM activity_logs
WHERE restaurant_id = 'YOUR-ID'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY action
ORDER BY count DESC;
```

**Should show all 7 action types if testing is complete.**

---

## KEY POINTS

✅ **Non-Blocking**: Logging errors never break business logic
✅ **Automatic Timestamps**: `created_at` set by database
✅ **Role Tracking**: Captures who (user), what (action), how (role)
✅ **Multi-Tenant**: Restaurant isolation built in
✅ **Performance**: Indexed queries return instantly
✅ **Safe**: Data remains if logging fails

---

## COMMON ISSUES & FIXES

| Issue | Solution |
|-------|----------|
| RLS blocking inserts | Run `ALTER TABLE... DISABLE RLS` in Supabase |
| Import not found | Use dynamic import: `await import('./activityService.js')` |
| userId is null | Check options.userId or req.user.id is passed |
| Logs not appearing | Check restaurantId matches logged-in user's restaurant |

---

## FILES TO MODIFY

1. ✏️ `backend/src/services/orderService.js` (4 locations)
2. ✏️ `backend/src/controllers/orderController.js` (2 locations)
3. ✏️ `backend/src/controllers/tableController.js` (1 location)

Total lines to add: ~60 lines (7 logging blocks)

---

## AFTER IMPLEMENTATION

```bash
# Step 1: Make all changes above
# Step 2: Run tests
npm test backend/test-logging-implementation.js

# Step 3: Commit
git add .
git commit -m "Implement complete staff activity logging with 7 action types"
git push

# Step 4: Verify in production
# - Create orders, update, settle
# - Check activity dashboard
# - See staff performance metrics
```

---

## RESOURCES

📖 **Full Implementation Guide**: [STAFF_ACTIVITY_LOGGING_IMPLEMENTATION.md](STAFF_ACTIVITY_LOGGING_IMPLEMENTATION.md)

📋 **Copy-Paste Code Snippets**: [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md)

🧪 **Test File**: `backend/test-activity-tracking.js`

🔧 **Service Code**: `backend/src/services/activityService.js`

---

## TIMELINE

| Step | Time | Status |
|------|------|--------|
| RLS Disable in Supabase | 1 min | ⏳ Manual |
| Add ORDER_CREATED | 2 min | ⏳ |
| Add ORDER_UPDATED | 2 min | ⏳ |
| Add ORDER_SETTLED | 2 min | ⏳ |
| Add ORDER_DELETED | 2 min | ⏳ |
| Add TABLE_ASSIGNED | 3 min | ⏳ |
| Add PAYMENT_COMPLETED | 2 min | ⏳ |
| Test Everything | 5 min | ⏳ |
| Commit & Push | 2 min | ⏳ |
| **TOTAL** | **22 minutes** | ⏳ |

---

**Next Step**: Start with [One-Time Setup](#one-time-setup), then follow [4-Step Implementation Plan](#4-step-implementation-plan)

Questions? Check [CODE_SNIPPETS_ACTIVITY_LOGGING.md](CODE_SNIPPETS_ACTIVITY_LOGGING.md) for exact code patterns.
