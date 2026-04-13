# Manager Login 500 Error Fix - SUPABASE_SERVICE_ROLE_KEY Configuration

## Problem

**Error:** `POST https://restaurent-backend-448t.onrender.com/api/v1/auth/login 500 (Internal Server Error)`

**Status:**
- ✅ Admin login: **WORKING**
- ❌ Manager login: **FAILING with 500**
- ❌ Staff registration: **FAILING with 500**

**Root Cause:**
1. The `connectSupabase()` function was **eagerly calling `getSupabaseAdmin()`** at app startup
2. `getSupabaseAdmin()` throws an error if `SUPABASE_SERVICE_ROLE_KEY` environment variable is missing or not loaded yet
3. This error was not properly caught, resulting in a generic 500 response
4. Admin login works because the normal login flow only uses the regular Supabase client (with anon key)

## Solution

### Changes Made

#### 1. **Fixed Supabase Configuration** (`backend/src/config/supabase.js`)

**Change:** Remove eager initialization of admin client at startup

**Before:**
```javascript
// This was throwing an error if service role key was missing
const client = getSupabase();
const adminClient = getSupabaseAdmin();  // ❌ Throws immediately at startup
logger.info('✅ Supabase connected with admin client');
```

**After:**
```javascript
const client = getSupabase();

// ⚠️ IMPORTANT: Do NOT eagerly call getSupabaseAdmin() here
// The admin client is lazily initialized when actually needed
// This prevents startup failures if SUPABASE_SERVICE_ROLE_KEY is missing
// Admin operations will gracefully fail at request time with clear error messages

logger.info('✅ Supabase connected (admin client will be initialized on first admin operation)');
```

**Benefit:** App starts successfully even if `SUPABASE_SERVICE_ROLE_KEY` is not configured yet.

#### 2. **Enhanced Admin Client Initialization** (`backend/src/config/supabase.js`)

**Change:** Better error messages when `getSupabaseAdmin()` is called

```javascript
export function getSupabaseAdmin() {
  // ... validation code ...
  
  if (!supabaseUrl || !serviceRoleKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('SUPABASE_URL');
    if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    
    const errorMsg = `Supabase admin client initialization failed. Missing environment variables: ${missingVars.join(', ')}. ` +
                     `This is required for admin operations (user creation, staff registration, etc.). ` +
                     `Please ensure these variables are set in your Render backend environment.`;
    
    logger.error('❌ Admin Client Initialization Error');
    logger.error(`   Missing: ${missingVars.join(', ')}`);
    throw new Error(errorMsg);
  }
}
```

#### 3. **Added Error Handling in Service Layer**

#### File: `backend/src/services/authService.js`

**Changes:**
- `registerRestaurant()` - Wrapped `getSupabaseAdmin()` call in try-catch
- `registerStaff()` - Wrapped `getSupabaseAdmin()` call in try-catch

**Example:**
```javascript
// Wrapped with error handling
try {
  const adminClient = getSupabaseAdmin();
  ({ data: authData, error: authError } = await adminClient.auth.admin.createUser({...}));
} catch (adminInitError) {
  logger.error('❌ Failed to initialize Supabase admin client');
  logger.error(`   Error: ${adminInitError.message}`);
  throw new Error(
    `Admin client initialization failed: ${adminInitError.message}. ` +
    `Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Render backend environment.`
  );
}
```

#### Files Updated:
- `backend/src/services/developerService.js` - Added admin client error handling
- `backend/src/services/passwordResetService.js` - Added admin client error handling

#### 4. **Smart Error Response Handling** (`backend/src/middleware/errorHandler.js`)

**Changes:**
- Detect admin client initialization errors and return `503 Service Unavailable` instead of `500`
- Show user-friendly error message for configuration issues
- Add detailed logging for developers

```javascript
const normalizeStatusCode = (err) => {
  // Check for admin client initialization errors (missing service role key)
  const message = String(err?.message || err?.publicMessage || '').toLowerCase();
  if (message.includes('admin client') || message.includes('service role key')) {
    // Return 503 Service Unavailable - backend infrastructure issue, not user error
    return 503;
  }
  // ... existing logic ...
};

const buildSafeMessage = (err, statusCode) => {
  // Service role key errors should be shown to all users (informative)
  if (candidate.includes('SUPABASE_SERVICE_ROLE_KEY') || candidate.includes('admin client')) {
    return 'Backend configuration error. Please contact support. The server is unable to process admin operations.';
  }
  // ... existing logic ...
};
```

## Deployment Checklist

### Step 1: Verify Environment Variables in Render

1. Go to your Render backend dashboard
2. Click on **Environment** tab
3. **Verify** these variables are set:
   - ✅ `SUPABASE_URL` - Should be your Supabase project URL
   - ✅ `SUPABASE_ANON_KEY` - Anonymous key for public operations
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` - **CRITICAL** - Service role key for admin operations
   - ✅ `SUPABASE_JWT_SECRET` - JWT secret from Supabase
   - ✅ `JWT_SECRET` - Your app's JWT secret

**To get Service Role Key:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy **Service Role Key** (⚠️ Keep this secret!)
3. Add to Render environment as `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Deploy the Code

1. Pull the latest changes
2. Deploy to Render (auto-deploy or manual trigger)
3. Monitor logs for startup messages

### Step 3: Test Manager Login

**Test Case 1: Manager Login**
```bash
curl -X POST https://restaurent-backend-448t.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@testdomain.com",
    "password": "testpassword123",
    "portal": "manager"
  }'
```

**Expected Response (if service role key is set):**
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "role": "manager",
    "restaurantId": "...",
    "redirectTo": "restaurant-dashboard"
  }
}
```

**Expected Response (if service role key is MISSING):**
```json
{
  "success": false,
  "statusCode": 503,
  "message": "Backend configuration error. Please contact support. The server is unable to process admin operations."
}
```

⚠️ **If you get 503**, the service role key is missing from Render environment variables.

**Test Case 2: Staff Registration**
```bash
curl -X POST https://restaurent-backend-448t.onrender.com/api/v1/auth/register-staff \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Waiter",
    "email": "john@testdomain.com",
    "password": "newpassword123",
    "phone": "9876543210",
    "role": "staff",
    "restaurantId": "restaurant-uuid"
  }'
```

### Step 4: Verify Logs

Check Render logs for these messages:

**✅ SUCCESS (App started correctly):**
```
✅ Supabase connected (admin client will be initialized on first admin operation)
```

**✅ SUCCESS (Manager login worked):**
```
[AUTH_CONTROLLER] Login result: {
  userId: "user-uuid",
  email: "manager@testdomain.com",
  role: "manager",
  portal: "manager",
  redirectTo: "restaurant-dashboard"
}
```

**❌ ERROR (Service role key missing):**
```
🔴 ADMIN CLIENT INITIALIZATION FAILED
   This typically means SUPABASE_SERVICE_ROLE_KEY is not configured
   Please check your Render backend environment variables
   Error: Supabase admin client initialization failed. Missing environment variables: SUPABASE_SERVICE_ROLE_KEY...
```

## Troubleshooting

### Issue: Still getting 500 error

**Solution 1: Verify Service Role Key is Set**
```bash
# In Render terminal or local bash with Render env
echo $SUPABASE_SERVICE_ROLE_KEY
```

If empty or "undefined", add it to Render environment variables.

**Solution 2: Check for Cold Start**
Render has cold starts that can delay environment variable loading. Wait 30 seconds after deployment before testing.

**Solution 3: Force Restart**
1. Go to Render Dashboard
2. Click three dots on your backend service
3. Click "Manual Deploy" to restart with fresh environment

### Issue: Manager login still failing but with different error

Check server logs for specific error message:
- **"Email not found"** - Create manager account first
- **"Invalid password"** - Check password is correct
- **"Invalid email or password"** - Email doesn't exist in users table

### Reverting Changes (if needed)

All changes are backward compatible. No database migrations needed.

```bash
git revert <commit-hash>  # Replace with actual commit
git push
# Render auto-deploys
```

## Key Improvements

| Issue | Before | After |
|-------|--------|-------|
| **Startup Failure** | ❌ App wouldn't start if service role key missing | ✅ App starts, fails gracefully on admin operations |
| **Error Response** | 500 Internal Server Error (generic) | 503 Service Unavailable (specific) |
| **Error Message** | Generic "Internal Server Error" | "Backend configuration error. Please contact support..." |
| **Debugging** | Unclear what went wrong | Clear logs: "SUPABASE_SERVICE_ROLE_KEY not configured" |
| **User Experience** | Cryptic error, no actionable info | Clear message to contact support |
| **Developer Support** | Hard to diagnose | Detailed logging in console for debugging |

## Technical Details

### Why Lazy Loading?

**Before:** Eager initialization at startup
- ❌ App crashes if env var not loaded yet
- ❌ Can't start app for any other operations

**After:** Lazy loading when needed
- ✅ App starts successfully
- ✅ Admin operations fail with clear error
- ✅ Non-admin operations work fine (regular login)
- ✅ Service gracefully degrades for admin features

### Admin Operations That Need Service Role Key

These operations now have proper error handling:
1. ✅ Manager registration
2. ✅ Staff registration  
3. ✅ Password reset (updating auth user)
4. ✅ Developer account creation
5. ✅ User metadata updates

### Non-Admin Operations (No service role key needed)

These always work:
1. ✅ Regular login
2. ✅ Admin owner login
3. ✅ View restaurant data
4. ✅ View user tables
5. ✅ Any read operations

## Files Modified

```
✅ backend/src/config/supabase.js
   - Removed eager getSupabaseAdmin() call
   - Enhanced error messages
   - Better logging

✅ backend/src/services/authService.js
   - Added try-catch for registerRestaurant()
   - Added try-catch for registerStaff()

✅ backend/src/services/developerService.js
   - Added try-catch for developer registration

✅ backend/src/services/passwordResetService.js
   - Added try-catch for password update

✅ backend/src/middleware/errorHandler.js
   - Added detection for admin client errors
   - Return 503 instead of 500
   - Better error messages for configuration issues
   - Enhanced logging
```

## Verification Commands

```bash
# 1. Check app starts correctly
curl https://restaurent-backend-448t.onrender.com/health

# 2. Check service role key is available (for developers only)
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  https://restaurent-backend-448t.onrender.com/api/v1/admin/debug/config

# 3. Test manager login
curl -X POST https://restaurent-backend-448t.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"pwd123","portal":"manager"}'
```

## Next Steps

After deployment:
1. ✅ Verify logs show app starting correctly
2. ✅ Test manager login  
3. ✅ Test staff registration
4. ✅ Test password reset
5. ✅ Monitor error logs for any other 503 errors
6. ⚠️ If still seeing 503 after 1 hour, check Render environment variables

## Support

If manager login still fails after these fixes:
1. Check Render logs for specific error message
2. Verify SUPABASE_SERVICE_ROLE_KEY is in Render environment
3. Check Supabase project is accessible and credentials are correct
4. Contact Supabase support if credentials are valid but still failing

---
**Last Updated:** Phase 6 - Manager Login Debug
**Status:** Fix Implementation Complete ✅
