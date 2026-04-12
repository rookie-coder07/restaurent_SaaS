# Staff Activity Dashboard - Diagnostic Guide

## Current Status
- ✅ Backend API endpoints working (returning 200)
- ✅ Role normalization fixed (owner → admin)
- ✅ Authorization checks passing (no 403 errors)
- ❌ Frontend showing 0 staff despite backend returning data

## Enhanced Logging Added

### 1. Frontend Enhanced Logging (StaffActivity.jsx)

Both `fetchStaffList()` and `fetchActivityLogs()` now output detailed diagnostics:

```
📊 FULL RESPONSE OBJECT: {
  status: 200,
  statusText: "OK",
  responseKeys: ["data", "status", "statusText", ...],
  dataKeys: ["statusCode", "data", "message", "success"],
  fullData: { actual response object }
}
```

Then for each extraction path, it logs:
```
[Debug] response?.data?.data?.staff: [whatever is there]
[Debug] response?.data?.data: [whatever is there]
[Debug] response?.data?.staff: [whatever is there]
[Debug] response?.data: [whatever is there]
```

And finally reports which path succeeded:
```
✅ PATH 1: Extracted from response.data.data.staff - X items
❌ VALIDATION FAILED: staffList is not array
```

### 2. Backend Enhanced Logging (activityController.js)

Both `getStaffList()` and `getUserActivity()` now output what they're sending:

```
📤 SENDING STAFF LIST RESPONSE: {
  resultType: "object",
  resultKeys: ["staff"],
  staffCount: 5,
  staffArray: true,
  resultData: "{\"staff\":[...]}"
}
```

## Response Structure

### Staff List Endpoint: `/api/v1/activity/staff`

**Backend Service Returns:**
```javascript
{ staff: [ { id, name, email, role, totalOrders, lastActive }, ... ] }
```

**Controller Wraps It:**
```javascript
sendSuccess(res, 200, result, 'Staff list fetched successfully');
```

**What Axios Receives:**
```javascript
{
  statusCode: 200,
  data: {
    staff: [ { id, name, email, role, totalOrders, lastActive }, ... ]
  },
  message: "Staff list fetched successfully",
  success: true
}
```

**Frontend Must Extract From:**
```javascript
response.data.data.staff  // This is the staff array
```

### Activity Logs Endpoint: `/api/v1/activity/{userId}/logs`

**Backend Service Returns:**
```javascript
[ { id, user_id, action, details, created_at }, ... ]  // DIRECT ARRAY
```

**Controller Wraps It:**
```javascript
sendSuccess(res, 200, { logs: result }, 'Activity logs fetched successfully');
```

**What Axios Receives:**
```javascript
{
  statusCode: 200,
  data: {
    logs: [ { id, user_id, action, details, created_at }, ... ]
  },
  message: "Activity logs fetched successfully",
  success: true
}
```

**Frontend Must Extract From:**
```javascript
response.data.data.logs  // This is the logs array
```

## Debugging Steps

### Step 1: Check Frontend Console
Open: DevTools → Console tab
Look for output starting with `📊 FULL RESPONSE OBJECT:`

**Expected to see:**
```
📊 FULL RESPONSE OBJECT: {
  status: 200,
  statusText: "OK",
  responseKeys: [...],
  dataKeys: ["statusCode", "data", "message", "success"],
  fullData: {
    statusCode: 200,
    data: { staff: [...] },
    message: "Staff list fetched successfully",
    success: true
  }
}
[Debug] response?.data?.data?.staff: [Array containing user objects]
[Debug] response?.data?.data: [Same array]
✅ PATH 1: Extracted from response.data.data.staff - 5 items
✅ VALIDATION PASSED: logs is array with 5 members
```

**If you see:**
```
❌ NO PATH MATCHED. Available data: {
  type: "object",
  value: {...},
  isArray: false
}
```

Then the response structure is NOT what we expect. Check the `value` field to see actual structure.

### Step 2: Check Backend Console/Logs
Look for output starting with `📤 SENDING STAFF LIST RESPONSE:`

**Expected to see:**
```
📤 SENDING STAFF LIST RESPONSE: {
  resultType: "object",
  resultKeys: ["staff"],
  staffCount: 5,
  staffArray: true,
  resultData: "{\"staff\":[{\"id\":\"...\",\"name\":\"...\"},...]}"
}
```

This confirms backend is returning `{ staff: [...] }` correctly.

### Step 3: Cross-Reference
1. Frontend logs show what Axios received
2. Backend logs show what Express sent
3. They should match (Axios wraps response in .data)

## Common Issues & Solutions

### Issue 1: Frontend Shows 0 Staff but Backend Returns Data

**Symptoms:**
- Backend logs: `✅ Staff list retrieved: 5 staff members`
- Frontend logs: `❌ NO PATH MATCHED` or `✅ VALIDATION PASSED: logs is array with 0 members`

**Cause:** Response structure mismatch
- Backend is returning different data than expected
- OR Axios is receiving something unexpected

**Solution:**
1. Check frontend console output - what is in the `value` field?
2. If `{ staff: [5] }` - then PATH 1 should have worked
3. Report the actual structure so we can fix extraction logic

### Issue 2: Authorization Errors (403)

**Symptoms:**
- Status code: 403
- Message: "Access denied"

**Cause:** Role not recognized
- Owner role not normalized to admin?
- Manager can't access staff?

**Solution:**
1. Check backend: `role ${currentUserRole}` log
2. If shows "owner", normalization failed
3. If shows "admin", role okay
4. If auth failed with admin/manager, authorization logic has bug

### Issue 3: Empty Staff List (Backend returns 0)

**Symptoms:**
- Backend: `✅ Staff list retrieved: 0 staff members`
- No query errors
- Logs show "No users found for restaurant..."

**Cause:** Database has no staff in restaurant
- All users have owner/admin role
- No staff/manager/waiter users created

**Solution:**
1. Check staff_member table - do records exist?
2. Create test staff users:
   ```sql
   INSERT INTO users (restaurant_id, name, email, role)
   VALUES ('restaurant-id', 'Test Staff', 'test@example.com', 'staff');
   ```
3. Try staff list again

### Issue 4: Database Query Errors

**Symptoms:**
- Backend logs show error message
- Supabase query fails

**Solution:**
1. Check Supabase connection
2. Verify `activity_logs` table exists
3. Run: `SELECT COUNT(*) FROM activity_logs;`
4. If 0 rows, that's okay (empty is valid)

## Log Output Checklist

### When Everything Works:

**Frontend **
```
[Activity] Fetching staff list...
📊 FULL RESPONSE OBJECT: { status: 200, ... }
[Debug] response?.data?.data?.staff: [Array(5)]
✅ PATH 1: Extracted from response.data.data.staff - 5 items
✅ VALIDATION PASSED: staffList is array with 5 members
📋 First staff member: {id: "...", name: "...", role: "staff"}
```

**Backend**
```
📊 Activity: Fetching staff list for restaurant ..., role: admin
📊 getStaffList: restaurantId=..., currentUserRole='admin'
✅ Admin/Developer role detected
📋 Query returned 5 users matching role filter
✅ Staff members found: [{id, name, role}, ...]
📤 SENDING STAFF LIST RESPONSE: { resultType: "object", staffCount: 5, ... }
✅ Staff list retrieved: 5 staff members
```

## Next Steps

1. **Trigger API call** - Open Staff Activity page
2. **Check Frontend Console** - Look for `📊 FULL RESPONSE OBJECT:`
3. **Report actual response structure** - If not matching expected format
4. **Check Backend Logs** - Verify it's sending correct data
5. **Cross-verify paths** - Both frontend and backend should align

## Quick Reference: Expected Paths

| Endpoint | Returns | Axios Receives | Frontend Path |
|----------|---------|-----------------|----------------|
| /activity/staff | `{ staff: [...] }` | `{ statusCode, data: { staff: [...] }, ... }` | `response.data.data.staff` |
| /activity/{userId}/logs | `[ {...}, ... ]` | `{ statusCode, data: { logs: [...] }, ... }` | `response.data.data.logs` |

If actual response differs, we'll adjust the extraction logic accordingly.
