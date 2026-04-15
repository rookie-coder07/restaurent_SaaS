# Render Backend 502 Error Diagnosis

## Current Issue
✗ Backend returning `502 Bad Gateway` + CORS policy errors  
✗ Requests: `https://restaurent-backend-448t.onrender.com/api/v1/*` failing

## Root Cause Analysis

The backend is not responding to browser requests. This means either:
1. **Crash at startup** - Environment variables incorrect or service failed to initialize
2. **Process not running** - Service crashed after deployment
3. **Port not listening** - Service started but not on port 3000
4. **Database connection failed** - Cannot connect to Supabase, server hung

---

## 🔍 Step 1: Check Render Backend Status

**Go to:** https://render.com/dashboard → `restaurent_backend` service

Look at the status:
- **Status: "Live" + Green indicator** → Service is running, check logs
- **Status: "Deploying"** → Still deploying, wait 2-3 minutes
- **Status: "Failed" + Red** → Deployment crashed, check logs immediately
- **Status: "Updating"** → In progress, wait for completion

---

## 📋 Step 2: Check Render Logs for Errors

**In Render Dashboard:**
1. Click your `restaurent_backend` service
2. Scroll down to **Logs** section (or click "Logs" tab)
3. Search for these error patterns:

### ❌ Common Error #1: Missing Environment Variables
```
Error: Missing required environment variables: [VARIABLE_NAME]
```
**Fix:** Add the missing variable (e.g., `SUPABASE_URL`, `JWT_SECRET`)

### ❌ Common Error #2: Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Database connection failed
```
**Fix:** Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct

### ❌ Common Error #3: Timeout/Hang
```
(logs stop suddenly, no error message)
RequestError: request to https://... failed, reason: connect ECONNREFUSED
```
**Fix:** Check if Supabase instance is accessible from Render's network

### ✅ Healthy Startup (what you should see)
```
BACKEND INITIALIZATION STARTED
DATABASE CONNECTED SUCCESSFULLY
BACKEND HTTP SERVER STARTED
Environment: production
Server URL: https://restaurent-backend-448t.onrender.com
Health endpoint working: /health
```

---

## 🧪 Step 3: Test Backend Health Endpoint

**Test if backend is responding at all:**

In your browser, go to:
```
https://restaurent-backend-448t.onrender.com/health
```

### Expected Response
- **Status 200** with `{ "status": "ok" }` → Backend is alive!
- **502 Bad Gateway** → Backend not responding to ANY request
- **Timeout/Connection error** → Backend not listening on port 3000

---

## 🔧 Step 4: Verify Environment Variables Are Set

**In Render Dashboard:**
1. Click `restaurent_backend` service
2. Click **Environment** tab
3. Verify these variables exist:

| Variable | Example | Required |
|----------|---------|----------|
| NODE_ENV | production | ✅ |
| PORT | 3000 | ✅ |
| SUPABASE_URL | https://pzjj...co | ✅ |
| SUPABASE_ANON_KEY | sb_publishable_... | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | eyJhbGci... | ✅ |
| JWT_SECRET | (min 32 chars) | ✅ |
| REFRESH_TOKEN_SECRET | (min 32 chars) | ✅ |
| CLOUDINARY_CLOUD_NAME | dwmpqr7a5 | ✅ |
| CORS_ORIGIN | https://restaurentsaas-seven.vercel.app,... | ✅ |

**If any are missing:** Add them using the exact values from `.env.production` in the repo

---

## 🚀 Step 5: Trigger Manual Redeploy

**If status is "Live" but still getting 502:**

1. In Render Dashboard, find your service
2. Look for **Manual Deploy** button (should be near top right)
3. Click it to force a fresh deployment
4. Wait for "Live" status

---

## 💡 Step 6: Force Restart Backend

If redeploy doesn't help:

1. Click **Settings** tab on service
2. Scroll to bottom
3. Click **Restart Service**
4. Confirm restart
5. Wait for service to restart and show "Live"

---

## 🔗 Step 7: Verify CORS Configuration

**After backend is "Live":**

1. Verify Environment variable `CORS_ORIGIN` is set to:
   ```
   https://restaurentsaas-seven.vercel.app,https://restaurent-saas.vercel.app,https://restaurentsaas.vercel.app
   ```

2. In browser, test:
   - Go to: https://restaurentsaas-seven.vercel.app
   - Open DevConsole (F12)
   - Look at Network tab
   - Find any request to `restaurent-backend-448t.onrender.com`
   - Check Response Headers for:
     - ✅ `Access-Control-Allow-Origin: https://restaurentsaas-seven.vercel.app`
     - OR if browser sent preflight (OPTIONS request)
     - ✅ Status should be 200, not 502

---

## 📊 Final Checklist

- [ ] Render service status is "Live" (green)
- [ ] Logs show "BACKEND HTTP SERVER STARTED" (no errors)
- [ ] Health endpoint (`/health`) returns 200 with `{ "status": "ok" }`
- [ ] All required environment variables are set in Render dashboard
- [ ] `CORS_ORIGIN` includes all three Vercel frontend domains
- [ ] Browser hard refresh (Ctrl+Shift+R) shows no 502 errors
- [ ] Frontend dashboard loads tables/orders without CORS errors

---

## 💬 When to Contact Support

If after following these steps you still see errors:
1. Screenshot the Render logs showing the error
2. Note what the error message says
3. Share the exact 502 error details from Render logs
4. This will help identify if it's network, database, or configuration related

---

## 📝 Key Facts

- **Local development:** Works ✅ (port 3000 responding)
- **Code:** Fixed ✅ (CORS headers configured properly)
- **Deployment:** Pending ⏳ (needs Render env var update + redeploy)
- **Time to fix:** 5 minutes once you follow these steps
