# Staff Activity 403 Error - Complete Debug Guide

## Status
The 403 error on `/api/v1/activity/{userId}/logs` is being blocked by one of the middleware layers. I've added detailed logging to pinpoint exactly where.

## Root Cause Candidates

### 1. systemAccessGuard Middleware
Blocks requests based on restaurant access settings in the `restaurants` table.

**What was blocking:**
- Restaurant access_enabled = false
- Global maintenance = true
- Restaurant maintenance = true

**What I changed:**
- Removed activity routes from systemAccessGuard check path
- Added logging to show which route is being checked

### 2. tenantIsolation Middleware
Validates that `req.user.restaurantId` matches the request restaurantId.

**What can block:**
- User doesn't have restaurantId in token
- restaurantId mismatch

**What I changed:**
- Added detailed logging to show restaurantId validation
- Shows exact values being compared

### 3. Activity Controller
Checks for userId and restaurantId parameters.

**What can block:**
- Missing userId parameter
- Missing restaurantId from user context

**What I changed:**
- Added detailed logging showing all received parameters

## Deploy to Production

### Deploy Backend Changes
```bash
cd d:\Projects\restaurent_SaaS

# Check what changed
git status

# Stage and commit
git add backend/src/

git commit -m "Add detailed logging to activity routes for debugging 403 error

- Enhanced systemAccessGuard with better path checking and logging
- Added tenantIsolation logging to show restaurantId validation
- Added activityController logging to show all parameters
- Improved error messages"

# Deploy to Render
git push
```

Takes 2-5 minutes to deploy on Render.

## Debug in Production

### Step 1: Check Render Logs
After deploying, check Render dashboard logs for entries like:

```
[SYSTEM_ACCESS] Path check: { path: '/v1/activity/...', includes: ... }
[TENANT_ISOLATION] Checking: { path: '/v1/activity/...', userRestaurantId: '...' }
[ACTIVITY_CONTROLLER] getActivityLogs called: { userId: '...', restaurantId: '...' }
```

### Step 2: Test in Browser
1. Open https://restaurent-saas-production.vercel.app (your frontend)
2. Login as owner
3. Go to **Staff Activity** page
4. Press **F12** for Developer Tools
5. Go to **Console** tab
6. Watch the logs:

**Good logs:**
```
[StaffActivity] Fetching logs for userId: 515cfff9-6b46-49c1-b369-1d5650c95816
[StaffActivity] Response: {...with data...}
[StaffActivity] Logs data: [...]
```

**Bad logs:**
```
[StaffActivity] Fetching logs for userId: 515cfff9-6b46-49c1-b369-1d5650c95816
GET .../api/v1/activity/.../logs 403 (Forbidden)
[StaffActivity] Error fetching logs: {...}
```

### Step 3: Check Network Response
In DevTools, go to **Network** tab:
1. Look for request to `/api/v1/activity/.../logs`
2. Click on it
3. Go to **Response** tab
4. Look for error message, example:
   ```json
   {
     "success": false,
     "message": "Restaurant access has been disabled"
   }
   ```

## Possible 403 Reasons & Solutions

### Reason 1: "Restaurant access has been disabled"
**Cause:** Restaurant's `access_enabled` column is false
**Fix:** 
1. Go to Supabase dashboard
2. Find `restaurants` table
3. Check your restaurant record
4. Set `access_enabled` = true

### Reason 2: "Cannot access other restaurants data"
**Cause:** Restaurant ID mismatch
**Fix:**
1. Check token has correct restaurantId
2. Check user's restaurantId in token matches request

### Reason 3: "Global maintenance enabled"
**Cause:** System is in maintenance mode
**Fix:**
1. Check `system_settings` table
2. Find row with `setting_key` = 'global_maintenance'
3. Check if enabled = true
4. Disable it if needed

### Reason 4: "Restaurant maintenance enabled"
**Cause:** Specific restaurant is in maintenance mode
**Fix:**
1. Check `system_settings` table
2. Find row for your restaurantId with `setting_key` = 'restaurant_maintenance'
3. Check if enabled = true
4. Disable it if needed

## Quick Test Script

After deploying, run this PowerShell command to test:

```powershell
# Set your values
$BACKEND = "restaurent-backend-448t.onrender.com"
$EMAIL = "owner@restaurant.com"
$PASSWORD = "Owner123@456"

# Login
$login = Invoke-RestMethod -Uri "https://$BACKEND/api/v1/auth/login" `
  -Method POST -Headers @{"Content-Type"="application/json"} `
  -Body "{`"email`":`"$EMAIL`",`"password`":`"$PASSWORD`",`"portal`":`"admin`"}"

$token = $login.data.accessToken
$userId = $login.data.user.id

Write-Host "Token: $($token.Substring(0,50))..."
Write-Host "UserId: $userId"

# Test activity endpoint
try {
  $activity = Invoke-RestMethod -Uri "https://$BACKEND/api/v1/activity/$userId/logs" `
    -Method GET -Headers @{"Authorization"="Bearer $token"}
  
  Write-Host "✅ SUCCESS! Got $(($activity.data | Measure-Object).Count) logs"
} catch {
  Write-Host "❌ FAILED with status: $($_.Exception.Response.StatusCode)"
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = [System.IO.StreamReader]::new($stream)
  Write-Host "Error: $($reader.ReadToEnd())"
}
```

## Files Modified
1. `backend/src/middleware/systemAccess.js` - Better logging and path checks
2. `backend/src/middleware/tenantIsolation.js` - Detailed logging
3. `backend/src/controllers/activityController.js` - Parameter logging
4. `backend/src/routes/activity.js` - Added tenantIsolation middleware
5. `backend/src/routes/index.js` - Fixed route registration order

## What Happens After Deploy

1. **Render rebuilds backend** (2-5 min)
2. **New code with logging is live**
3. **Next request to activity endpoint shows detailed logs**
4. **Render logs show what's blocking it**
5. **You can fix the root cause** (usually restaurant access setting)

## Contact Info

If you still get 403 after all this:
1. Share output from the test script above
2. Share relevant Render logs matching `[SYSTEM_ACCESS]` or `[TENANT_ISOLATION]`
3. I can identify and fix the exact issue

The detailed logging will tell us EXACTLY where the 403 is coming from!
