# DEVELOPER RBAC FIX - DEPLOYMENT GUIDE

## PROBLEM
Frontend hitting production with correct `tokenRole: 'developer'` but still getting 403 on all developer endpoints:
- `/api/v1/developer/restaurants` → 403
- `/api/v1/developer/control-center/*` → 403
- `/api/v1/developer/settings` → 403

## ROOT CAUSE
Backend code changes have NOT been deployed to Render production server yet.

---

## FIXES MADE (LOCAL CODE)

### 1. src/middleware/securityEnforcement.js (Line 75)
```javascript
// BEFORE:
if (!['admin'].includes(userRole)) {

// AFTER:
if (!['admin', 'developer'].includes(userRole)) {
```

### 2. src/middleware/authorization.js (Line 76)
```javascript
// BEFORE:
if (!['admin', 'manager'].includes(normalizedRole)) {

// AFTER:
if (!['admin', 'manager', 'developer'].includes(normalizedRole)) {
```

### 3. src/middleware/tenantIsolation.js (Line 175)
```javascript
// BEFORE:
if (!['admin', 'manager'].includes(normalizedRole)) {

// AFTER:
if (!['admin', 'manager', 'developer'].includes(normalizedRole)) {
```

### 4. src/app.js (Lines 177-193)
✅ Already skips security enforcement stack for `/api/v1/developer` routes
```javascript
if (req.path.startsWith('/api/v1/developer')) {
  console.log('[APP_MIDDLEWARE] Skipping security stack for developer route:', req.path);
  return next();
}
```

---

## DEPLOYMENT STEPS

### Option A: Render (Current Setup)
```bash
# 1. Commit local changes
git add .
git commit -m "fix: Add developer role to RBAC middleware checks"

# 2. Push to main branch
git push origin main

# 3. Render auto-deploys on push
# Wait 2-5 minutes for new build to deploy

# 4. Verify in Render Dashboard:
#    - Settings > Git > Check deployment status
#    - logs > Build logs should show build success
```

### Option B: Manual Deploy (If Auto-Deploy Fails)
```bash
# 1. Check which branch deployed:
#    Render Dashboard > Environment > Git Branch

# 2. Verify all 3 files are committed:
git log --name-status HEAD~3..HEAD

# 3. Force re-deploy from Render Dashboard:
#    - Settings > Deploy
#    - Click "Deploy latest commit"
```

---

## VERIFICATION AFTER DEPLOY

### 1. Check Server Logs
Render Dashboard > Logs:
```
[SECURITY_ENFORCE] RBAC Check: {userRole: "developer", path: "/api/v1/developer/restaurants"}
[APP_MIDDLEWARE] Skipping security stack for developer route: /api/v1/developer/restaurants
[DEVELOPER_ROUTE] Incoming request: {path: "/restaurants", userRole: "developer", userId: "..."}
```

### 2. Test Endpoints
```bash
# Login as developer first to get token
curl -X POST https://restaurent-backend-448t.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "developer@system.com", "password": "...", "portal": "developer"}'

# Expected: 200 OK with token

# Test developer API
curl -H "Authorization: Bearer <token>" \
  https://restaurent-backend-448t.onrender.com/api/v1/developer/restaurants

# Expected: 200 OK with restaurant data
# NOT: 403 Forbidden
```

### 3. Frontend Should Work
After deploy, test in DeveloperConsole:
```
✔ GET /api/v1/developer/restaurants → 200 OK
✔ GET /api/v1/developer/control-center/overview → 200 OK
✔ GET /api/v1/developer/control-center/live → 200 OK
✔ GET /api/v1/developer/settings → 200 OK
```

---

## TROUBLESHOOTING

### Still Getting 403 After Deploy?

1. **Check if deploy actually completed:**
   - Render Dashboard > Deployments > Latest deployment status
   - Look for ✅ "Deploy successful" message

2. **Check server logs for blocking point:**
   - Render Dashboard > Logs
   - Search for "Access denied" or "403"
   - Should show which middleware is blocking

3. **Verify token has correct role:**
   - Frontend console: `JSON.parse(atob(token.split('.')[1]))`
   - Should show: `{role: "developer", restaurantId: null, ...}`

4. **Force hard refresh:**
   - Frontend: Clear browser cache + localStorage
   - Reload page and login again

5. **Check if /api/v1 vs /api path issue:**
   - Frontend API_BASE_URL: `https://restaurent-backend-448t.onrender.com/api/v1` ✓
   - Backend routes: `/${apiVersion}/developer` where `apiVersion='v1'` ✓
   - Should match correctly

---

## FILES MODIFIED

1. ✅ `backend/src/middleware/securityEnforcement.js` - Line 75
2. ✅ `backend/src/middleware/authorization.js` - Line 76
3. ✅ `backend/src/middleware/tenantIsolation.js` - Line 175
4. ✅ `backend/src/app.js` - Already correct, skips middleware for developer

---

## EXPECTED BEHAVIOR

**Before fix:**
```
Frontend: role='developer', restaurantId=null ✓
API: GET /api/v1/developer/restaurants → 403 ❌
```

**After deploy:**
```
Frontend: role='developer', restaurantId=null ✓
API: GET /api/v1/developer/restaurants → 200 OK ✓
API: GET /api/v1/developer/control-center/overview → 200 OK ✓
API: GET /api/v1/developer/settings → 200 OK ✓
Developer can access all restaurants ✓
```

---

## DEPLOYMENT SUMMARY

- **Status:** Code fixed locally ✓
- **Next Step:** Deploy to Render
- **Time to Deploy:** ~2-5 minutes
- **Rollback:** Easy - revert commit and push

Push the changes to main branch to trigger Render auto-deploy.
