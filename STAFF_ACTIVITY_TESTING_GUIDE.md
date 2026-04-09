# Staff Activity Feature - End-to-End Testing Guide

## Pre-Deployment Verification

### 1. Database Schema Validation

**Step 1**: Log into Supabase Dashboard
- Go to SQL Editor
- Copy and paste entire content from `ACTIVITY_SCHEMA.sql`
- Execute script
- Verify: No errors in console

**Step 2**: Verify table structure
```sql
-- Run these queries in Supabase SQL Editor

-- Check table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'activity_logs';

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activity_logs';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'activity_logs';

-- Check RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'activity_logs';
```

**Expected Results**:
- ✅ Table exists with 7 columns
- ✅ 4 indexes created
- ✅ RLS enabled (relrowsecurity = true)

---

### 2. Backend Code Validation

**Step 1**: Check all files exist
```bash
# From workspace root
ls backend/src/services/activityService.js
ls backend/src/controllers/activityController.js
ls backend/src/routes/activity.js
```

**Expected**: All 3 files exist

**Step 2**: Verify imports in orderService.js
```bash
# Check if ActivityService is imported
grep "import.*ActivityService" backend/src/services/orderService.js
```

**Expected**: 
```
import { ActivityService } from './activityService.js';
```

**Step 3**: Verify activity routes are registered
```bash
# Check if activity routes are imported and registered
grep -A 1 "import.*activity" backend/src/routes/index.js
grep "activity.*routes" backend/src/routes/index.js
```

**Expected**:
```
import activityRoutes from './activity.js';
router.use(`/${apiVersion}/activity`, activityRoutes);
```

---

### 3. Frontend Code Validation

**Step 1**: Check StaffActivity page exists
```bash
ls frontend/src/pages/StaffActivity.jsx
```

**Expected**: File exists

**Step 2**: Check imports in App.jsx
```bash
grep "StaffActivity" frontend/src/App.jsx
```

**Expected**: 2 matches (import and route)

**Step 3**: Check routes registered
```bash
grep -E "staff-activity|StaffActivity" frontend/src/App.jsx
```

**Expected**: 4 matches (2 for import, 2 for routes)

**Step 4**: Check sidebar menu items added
```bash
grep "Staff Activity" frontend/src/components/layout/Sidebar.jsx
```

**Expected**: 2 matches (admin and manager)

---

## Runtime Testing

### Test 1: Start Backend Server

```bash
cd backend

# Install dependencies if needed
npm install

# Start server
npm start
# OR nodemon (for development)
```

**Expected Output**:
```
✅ Server running on port 3000
✅ Connected to Supabase
```

**Verification**:
- No red errors in console
- Server responds to requests
- Supabase connection successful

---

### Test 2: Start Frontend Server

```bash
cd frontend

# Install dependencies if needed
npm install

# Install packages
npm install

# Start development server
npm run dev
```

**Expected Output**:
```
✅ Frontend running on port 5173 (or similar)
✅ All imports resolved
```

**Verification**:
- No build errors
- No console errors
- Frontend loads without 404s

---

### Test 3: Activity Logging - Order Creation

**Scenario**: Create a new order and verify it's logged

**Steps**:
1. Log in as Owner or Manager
2. Go to POS/Order creation
3. Create new order with at least 2 items
4. Complete the order

**Expected Behavior**:
- Order created successfully
- No errors in console
- Page responds normally
- No performance degradation

**Database Verification**:
```sql
SELECT * FROM activity_logs 
WHERE action = 'order_created' 
ORDER BY created_at DESC LIMIT 1;
```

Expected columns:
- ✅ action = 'order_created'
- ✅ details.orderId populated
- ✅ details.itemCount >= 1
- ✅ details.totalAmount > 0

---

### Test 4: Activity Logging - Item Addition

**Scenario**: Add items to existing order

**Steps**:
1. Open an order
2. Add 3+ items to it
3. Verify order updates

**Database Verification**:
```sql
SELECT * FROM activity_logs 
WHERE action = 'item_added' 
ORDER BY created_at DESC LIMIT 1;
```

Expected:
- ✅ action = 'item_added'
- ✅ details.itemCount = 3
- ✅ details.items is array with 3 objects

---

### Test 5: Activity Logging - Bill Generation

**Scenario**: Generate bill for order

**Steps**:
1. Open completed order
2. Go to settlement
3. Generate bill
4. Don't pay yet

**Database Verification**:
```sql
SELECT * FROM activity_logs 
WHERE action = 'bill_generated' 
ORDER BY created_at DESC LIMIT 1;
```

Expected:
- ✅ action = 'bill_generated'
- ✅ details.invoiceNumber exists
- ✅ details.subtotal > 0
- ✅ details.totalAmount > 0

---

### Test 6: Activity Logging - Payment Complete

**Scenario**: Mark order as paid

**Steps**:
1. Open settled order (with bill)
2. Mark as paid
3. Select payment method
4. Enter amount
5. Confirm payment

**Database Verification**:
```sql
SELECT * FROM activity_logs 
WHERE action = 'payment_completed' 
ORDER BY created_at DESC LIMIT 1;
```

Expected:
- ✅ action = 'payment_completed'
- ✅ details.paymentMethod filled
- ✅ details.finalAmount populated
- ✅ details.changeDue calculated

---

### Test 7: Staff Activity Page - Owner Access

**Scenario**: Owner views staff activity

**Steps**:
1. Log in as Owner
2. Navigate to Admin portal: `/admin`
3. Click "📊 Staff Activity" in sidebar
4. Page should load

**Expected Result**:
- ✅ Page loads without errors
- ✅ Staff list displays (showing managers, staff, waiters)
- ✅ No other owners visible
- ✅ Search box works
- ✅ Can select staff member

**UI Checks**:
- [ ] Staff list populated
- [ ] Each staff shows: name, email, role badge, order count
- [ ] Selected staff highlights in blue
- [ ] Search real-time filters results

---

### Test 8: Staff Activity Page - Manager Access

**Scenario**: Manager views staff activity

**Steps**:
1. Log in as Manager
2. Navigate to Manager portal: `/manager`
3. Click "📊 Staff Activity" in sidebar
4. Page should load

**Expected Result**:
- ✅ Page loads without errors
- ✅ Staff list displays (showing staff, waiters, kitchen_staff only)
- ✅ Manager cannot see other managers
- ✅ Cannot see owner

**Filtered Roles Check**:
- [ ] Waiter visible
- [ ] Kitchen staff visible
- [ ] Other manager NOT visible
- [ ] Owner NOT visible

---

### Test 9: Activity Timeline Display

**Scenario**: View detailed timeline for staff member

**Steps**:
1. In Staff Activity page (owner or manager)
2. Click on any staff member
3. Timeline should load on right panel

**Expected Result**:
- ✅ Staff info displays: name, email, role
- ✅ Stats show: total orders, last active
- ✅ Timeline displays recent activities
- ✅ Each activity shows:
  - Action label with emoji
  - Formatted timestamp
  - JSON details

**Timeline Content Check**:
- [ ] "📋 Order Created" with details
- [ ] "➕ Item Added" with item list
- [ ] "📜 Bill Generated" with amounts
- [ ] "💳 Payment Completed" with payment info

---

### Test 10: Search Functionality

**Scenario**: Search for specific staff member

**Steps**:
1. In Staff Activity page
2. Type in search box
3. Try searching by:
   - Name: "John"
   - Email: "john@example.com"
   - Role: "waiter"
   - Non-existent: "XYZ"

**Expected Results**:
- ✅ Search by name filters correctly
- ✅ Search by email filters correctly
- ✅ Search by role filters correctly
- ✅ Non-existent search shows "No staff found"
- ✅ Clear search shows all staff again

---

### Test 11: Error Handling

**Scenario**: Test error scenarios

**Test 11A - Unauthorized Access**:
```javascript
// In browser console
fetch('/api/v1/activity/staff')  // Without auth
// Expected: 401 Unauthorized
```

**Test 11B - Invalid User ID**:
```javascript
fetch('/api/v1/activity/invalid-id/logs', {
  headers: {'Authorization': 'Bearer token'}
})
// Expected: 400 or 404 error
```

**Test 11C - Manager accessing other manager's activity**:
1. Manager A logs in
2. Tries to view Manager B's activity
3. Expected: 403 Forbidden

---

### Test 12: Permission Model Verification

**Owner Capabilities**:
- [ ] Can see all staff members
- [ ] Can view any staff's activity
- [ ] Cannot see other owners
- [ ] Can create/edit orders that log to activity

**Manager Capabilities**:
- [ ] Can see staff, kitchen_staff, waiter only
- [ ] Cannot see other managers
- [ ] Cannot see owners
- [ ] Can only view subordinates' activity
- [ ] Attempting to access other manager's activity → 403

**Staff/Waiter Capabilities**:
- [ ] Cannot access /admin/staff-activity
- [ ] Cannot access /manager/staff-activity
- [ ] Activity is logged when they perform actions

---

### Test 13: Performance Testing

**Scenario**: Test page responsiveness with multiple staff

**Test 13A - List Loading**:
```javascript
// In browser console - time the API call
console.time('staff-list');
fetch('/api/v1/activity/staff').then(() => console.timeEnd('staff-list'));
// Expected: < 2 seconds
```

**Test 13B - Timeline Loading**:
```javascript
// After clicking staff member
// Check browser Network tab
// Expected: < 1 second for logs request
```

**Test 13C - Search Performance**:
1. Type quickly in search box
2. Observe responsiveness
3. Expected: No lag, real-time filtering

---

### Test 14: Data Integrity

**Scenario**: Verify data accuracy across operations

**Check 1**: Order creation vs activity log
```sql
SELECT o.id, al.details->>'orderId' 
FROM orders o 
LEFT JOIN activity_logs al ON o.id = al.details->>'orderId'
WHERE al.action = 'order_created' 
LIMIT 5;
```
Expected: Orders match activity logs

**Check 2**: User consistency
```sql
SELECT DISTINCT al.user_id, al.role 
FROM activity_logs al;
```
Expected: All logged users exist in auth.users

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass locally
- [ ] No console errors in browser DevTools
- [ ] No errors in backend logs
- [ ] Database schema applied to Supabase
- [ ] Environment variables configured

### Deployment
- [ ] Deploy backend code to production
- [ ] Deploy frontend code to production
- [ ] Wait for builds to complete
- [ ] Clear frontend caches

### Post-Deployment
- [ ] Test production endpoints
- [ ] Verify staff activity page loads
- [ ] Create test order and verify logging
- [ ] Check activity logs in Supabase
- [ ] Monitor error logs for first 2 hours

---

## Rollback Plan

If issues occur:

**Backend Rollback**:
```bash
git revert <commit-hash>
npm start
# Server will restart without activity logging
```

**Frontend Rollback**:
```bash
git revert <commit-hash>
npm run build
npm run deploy
# Frontend will restart without staff activity page
```

**Database Rollback**:
```sql
-- Disable activity logging if needed
DROP TABLE activity_logs CASCADE;
-- Or just stop inserting:
-- Don't call ActivityService.logActivity
```

---

## Troubleshooting

### Issue: Staff Activity page shows "No staff available"
- Check users exist in auth.users
- Verify users have restaurant_staff records
- Check current user's restaurant_id is correct
- Verify role filtering logic in activityService.js

### Issue: Timeline not loading for selected staff
- Check browser Network tab for 404/500 errors
- Verify `/api/v1/activity/{userId}/logs` endpoint working
- Check Supabase activity_logs table has records
- Verify RLS policies not blocking read

### Issue: Activities not being logged
- Check ActivityService.logActivity calls exist in orderService
- Verify .catch() doesn't hide errors (temporarily remove)
- Check Supabase connection string correct
- Verify INSERT permissions on activity_logs table

### Issue: Permission denied when accessing staff activity
- Check user's role assignment
- For managers: verify they're trying to view staff/waiter/kitchen_staff
- Managers cannot view other manager activities
- Check browser log for 403 status codes

---

## Monitoring

### Key Metrics to Track
1. Activity log insert time (should be < 10ms)
2. Staff list API response time (should be < 1 second)
3. Timeline API response time (should be < 1 second)
4. Percentage of orders with activity logs (should be ~100%)

### Alerts to Set Up
1. Activity logging errors (logActivity() exceptions)
2. High database query times (> 2 seconds)
3. 403 permission errors spike
4. activity_logs table growth rate

### Regular Maintenance
- [ ] Weekly: Check activity logs table size
- [ ] Monthly: Archive logs older than 6 months
- [ ] Monthly: Review error logs
- [ ] Quarterly: Analyze activity patterns

---

## Success Criteria

✅ **Feature is ready when:**
1. All 4 activity types logged (order, item, bill, payment)
2. Staff activity page loads without errors
3. Owner sees all staff, manager sees only subordinates
4. Timeline displays accurate activity history
5. Search filters work correctly
6. No 500 errors in backend logs
7. No console errors in frontend
8. Performance acceptable (< 2 second API calls)
9. Database schema validated as present
10. RLS policies preventing unauthorized access

---

## Support Contact

For issues during testing:
1. Check this guide first
2. Review backend logs: `backend/logs/`
3. Check Supabase SQL editor for data verification
4. Review browser DevTools Network tab
5. Check Git logs for recent changes

---

**Test Date**: _______________
**Tested By**: _______________
**Status**: _______________

✅ = Pass
❌ = Fail
⚠️ = Needs Investigation
