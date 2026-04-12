# Staff Activity Debug Report

## Issues Identified

### Issue 1: Admin Portal Shows 0 Staff ❌
- **Response Structure**: ✅ Correctly formatted - `{staffCount: 0}`
- **Extraction**: ✅ Working - `response?.data?.data?.staff: []`
- **Root Cause**: Backend returning empty staff array
- **Likely Reason**: No staff/waiter/kitchen_staff users in admin's restaurant

### Issue 2: Manager Portal Shows 10 Staff (After Refresh) ✅
- **Response Structure**: ✅ Correctly formatted - `{staffCount: 10}`
- **Extraction**: ✅ Working - `response?.data?.data?.staff: [Array(10)]`
- **Root Cause**: Staff members exist in manager's restaurant
- **First fetch returned 0**: Likely a race condition or initial state issue

### Issue 3: Activity Logs Endpoint Returns 500 ❌
- **Endpoint**: `/api/v1/activity/{userId}/logs`
- **Error**: `Failed to load resource: the server responded with a status of 500`
- **Status**: Manager trying to access staff logs
- **Root Cause**: Exception during activity logs query OR empty results

## Data Requirements

For staff to appear in the list, the `users` table must have:

1. **Records with correct restaurant_id** - Must match user's restaurant
2. **Records with staff roles** - One of:
   - `staff`
   - `waiter`  ← Used in your test data (POS Billing Waiter)
   - `kitchen_staff`
   - `manager` (show for admin, not for other managers)
   - `pos_staff`
   - `cashier`
   - `kitchen`
   - `kitchen_operator`
   - `delivery_partner`

3. **NOT have admin/owner/developer roles** - These filter out

## SQL Query to Check Data

Run this in Supabase SQL Editor to see what's actually in your database:

```sql
-- Show all users grouped by restaurant and role
SELECT 
  restaurant_id,
  role,
  COUNT(*) as count,
  json_agg(json_build_object('id', id, 'name', name, 'email', email)) as users
FROM users
GROUP BY restaurant_id, role
ORDER BY restaurant_id, role;

-- Show count of staff-like users per restaurant
SELECT 
  restaurant_id,
  COUNT(*) as staff_count
FROM users
WHERE role IN ('staff', 'waiter', 'kitchen_staff', 'manager', 'pos_staff', 'cashier')
  AND restaurant_id IS NOT NULL
GROUP BY restaurant_id;

-- Show the admin user's restaurant  
SELECT id, restaurant_id, name, email, role FROM users WHERE email = 'admin@restaurant.com';

-- Show the manager user's restaurant
SELECT id, restaurant_id, name, email, role FROM users WHERE email = 'manager@restaurant.com';
```

## Activity Logs Issue Resolution

### Step 1: Get Backend Logs
When you trigger the logs endpoint, check server console for:
```
🔍 Fetching activity logs: restaurant=XXX, user=YYY
❌ Activity logs query error: [error details]
```

### Step 2: Verify activity_logs Table Exists
```sql
SELECT COUNT(*) FROM activity_logs;
SELECT table_name FROM information_schema.tables WHERE table_name = 'activity_logs';
```

### Step 3: Check If Any Logs Exist
```sql
SELECT COUNT(*) FROM activity_logs;
SELECT id, user_id, action, created_at FROM activity_logs LIMIT 1;
```

## Enhanced Logging Now In Place

### Backend (`activityController.js` and `activityService.js`)
- `getStaffList()` now logs restaurantId sources and construction details
- Better error handling - returns empty array instead of throwing
- Detailed role distribution logging

### Frontend (`StaffActivity.jsx`)
- Already extracting correctly from response 
- Logging shows path selection working

## Next Steps - Choose One

### Option A: Check Admin's Restaurant Has Staff Users
1. In Supabase, find your admin user's restaurant_id
2. Check if that restaurant has any users with role='waiter', 'staff', etc.
3. If not, create test staff users for that restaurant

**SQL to create test staff:**
```sql
INSERT INTO users (restaurant_id, name, email, role, password_hash)
VALUES (
  '515cffff9-6b46-49c1-b369-1d5650c95816',  -- Change to admin's restaurant_id
  'Test Staff',
  'staff@test.com',
  'staff',
  'temp'
);
```

### Option B: Check Activity Logs Are Being Created
1. List recent activity logs:
```sql
SELECT * FROM activity_logs LIMIT 10;
```

2. If empty, test creating one:
```sql
INSERT INTO activity_logs (restaurant_id, user_id, role, action, details)
VALUES (
  '515cffff9-6b46-49c1-b369-1d5650c95816',
  'c59d85a4-0ae6-4186-a9f2-b270481a917e',
  'waiter',
  'order_viewed',
  '{}'
);
```

### Option C: Test Activity Logs Endpoint Directly

Run in terminal (Windows PowerShell):
```powershell
$token = "YOUR_MANAGER_TOKEN"  # From browser DevTools > Network > Authorization header
$userId = "c59d85a4-0ae6-4186-a9f2-b270481a917e"  # Staff user ID

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/activity/$userId/logs" `
  -Headers @{'Authorization' = "Bearer $token"} `
  -Method Get | ConvertTo-Json
```

Check server console output for detailed logs.

## Recommended Immediate Actions

1. **Verify data exists**: Run SQL queries above to see actual database state
2. **Check admin's restaurant**: Confirm it has staff users
3. **Check logs table**: Verify activity_logs has records
4. **Test direct API call**: Use PowerShell command to see actual error message
5. **Review server logs**: Look for `❌ Activity logs query error:` messages

## Role System Reference

**Current Role Normalization:**
- `owner` → `admin` (at authentication layer)
- All other roles stay as-is: `manager`, `staff`, `waiter`, etc.

**Staff List Access:**
- Admin: Can see staff, waiter, kitchen_staff, manager, cashier, etc.
- Manager: Can see staff, waiter, kitchen_staff, cashier, etc. (not admin)
- Other roles: No access, returns empty list

**Activity Logs Access:**
- Users: Can see own logs
- Managers: Can see staff/waiter logs only
- Admins/Developers: Can see any user's logs

## Expected Behavior After Fix

```
Admin Portal: Shows 10 staff members ✅
Manager Portal: Shows 10 staff members ✅  
Click staff → Activity Logs: Shows list of logs ✅
No 500 errors ✅
```

## Files Modified This Session

1. **frontend/src/pages/StaffActivity.jsx**
   - Enhanced logging for response extraction
   - Now shows exactly which path succeeded
   - Shows first staff member details

2. **backend/src/services/activityService.js**
   - Better error handling in getActivityLogs()
   - More detailed logging in getStaffList()
   - Returns empty array instead of throwing exceptions

3. **backend/src/controllers/activityController.js**
   - Enhanced restaurantId source logging
   - Better error messages with stack traces

## Questions to Answer

1. **SQL: What users exist in each restaurant?**
   - Admin portal restaurant: [count] admin, [count] staff, [count] manager
   - Manager portal restaurant: [count] admin, [count] staff, [count] manager

2. **SQL: How many activity logs exist?**
   - Total rows: [number]
   - For manager's restaurant: [number]

3. **Error: What is the exact activity logs 500 error message?**
   - Check server logs for: `❌ Activity logs query error:`
   - Report the error code and message

Once you provide these answers, the fix will be straightforward.
