# API Integration Troubleshooting - Quick Reference

## Symptom: Login Fails with "timeout of 10000ms exceeded"

### 5-Minute Diagnostic

```javascript
// 1. Open browser console (F12)
// 2. Look for this line:
🌐 Frontend API Configuration
Actual API Base URL: https://resturant-saas.onrender.com/api  ← Should show this

// 3. If you see:
Actual API Base URL: http://localhost:3000/api  ← WRONG! Shows localhost

// 4. Run this in console:
fetch('https://resturant-saas.onrender.com/api/health')
  .then(r => r.json())
  .then(d => console.log('✅', d))
  .catch(e => console.error('❌', e.message))
```

---

## Quick Fixes (in order of likelihood)

### 1. **Browser Cache** (Most Common)
```
Hard Refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
Then try login again
```

### 2. **Vercel Rebuild Not Complete**
```
Go to: vercel.com → Project → Deployments
Wait for green checkmark ✅
Should see "VITE_API_BASE_URL=..." in build logs
```

### 3. **Backend Not Running** (Render free tier sleeps)
```
Check: https://resturant-saas.onrender.com/api/health
If error: Wait 30-60 seconds, try again
```

### 4. **CORS Blocked**
```
Network Tab → Failed request header:
Look for error about: "Access-Control-Allow-Origin"
If present: Backend needs CORS update (already configured)
```

### 5. **Route Doesn't Exist**
```
Network Tab → Response Status: 404 (for /v1/auth/login)
Fix: Verify backend/src/routes/auth.js has router.post('/login', ...)
```

---

## Console Log Reference

### ✅ GOOD (Login Should Work)
```
🌐 Frontend API Configuration
Environment: production
VITE_API_BASE_URL: https://resturant-saas.onrender.com/api
Actual API Base URL: https://resturant-saas.onrender.com/api
Running in: PRODUCTION (Vercel)
Current domain: restaurentsaas.vercel.app

🔗 API Request: POST https://resturant-saas.onrender.com/api/v1/auth/login
✅ API Response: 200 https://resturant-saas.onrender.com/api/v1/auth/login
```

### ❌ BAD (Will Not Work)
```
🌐 Frontend API Configuration
Environment: production
VITE_API_BASE_URL: (not set - using default)
Actual API Base URL: http://localhost:3000/api
❌ CRITICAL: Using localhost API URL in production!

🔗 API Request: POST http://localhost:3000/api/v1/auth/login
// ... freezes for 10 seconds ...
❌ API Error Response: {timeout: "10000ms exceeded"}
```

---

## Network Tab Response Codes

| Code | Meaning | What To Do |
|------|---------|-----------|
| 200 | ✅ Success | Login should work |
| 400 | Bad request | Check console → password format |
| 401 | Unauthorized | Right password? Try registering |
| 404 | Not found | Backend route missing (unlikely) |
| 0 / timeout | Connection failed | Check API URL in console |
| CORS error | Cross-origin blocked | Backend not allowing Vercel (already fixed) |

---

## Three-Tier Diagnostic

### Tier 1: Is Frontend Right?
```
Step 1: Open console
       Does it show https://resturant-saas... or http://localhost?
       
Step 2: Run healthcheck
       fetch('https://resturant-saas.onrender.com/api/health')
       Does it return 200 OK?
       
Result: ✅ If BOTH yes → Frontend is correct
        ❌ If either no → Rebuild Vercel or wait for Render to wake
```

### Tier 2: Is Backend Responding?
```
Step 1: Backend health check passed (from Tier 1)?
       
Step 2: Check Render status
       Go to: https://dashboard.render.com
       Is the service running (green)?
       
Result: ✅ If both yes → Backend is responding
        ❌ If no → Render might be asleep or crashed
              Try visiting the health URL directly in new tab
```

### Tier 3: Is CORS Allowed?
```
Step 1: Network tab → Failed request
        Look for "Access-Control-Allow-Origin" in response headers
        
Step 2: Should show: restaurentsaas.vercel.app
       
Result: ✅ If present → CORS is working
        ❌ If missing → Backend needs CORS update (already done)
              Push empty commit to rebuild: git commit --allow-empty
```

---

## Files That Matter

| File | What It Does | If Breaking |
|------|--------------|-----------|
| frontend/src/services/api.js | Configures axios | No API calls work |
| vercel.json | Tells Vercel how to build | All API calls fail |
| backend/src/app.js | Sets up CORS | CORS error appears |
| backend/src/routes/auth.js | Defines /login route | 404 on login |

---

## After You See "Login Failed"

**DON'T:**
- ❌ Change environment variables without rebuilding
- ❌ Clear database thinking that's the issue
- ❌ Assume localhost is wrong without checking console

**DO:**
- ✅ Check console first (shows what URL is being used)
- ✅ Hard refresh browser before trying again  
- ✅ Check Network tab to see what URL was actually called
- ✅ Wait 1 minute for Vercel/Render caches to clear
- ✅ Check Vercel deployment logs

---

## One-Liner Debugging Command

**In browser console:**
```javascript
console.log('API:', import.meta.env.VITE_API_BASE_URL, '| Domain:', window.location.hostname, '| Prod?', !window.location.hostname.includes('localhost'))
```

**Shows you:**
- What API URL will be used
- What domain you're on
- Whether it's prod or dev

---

## When to Ask for Help

Share these three things:
1. **Console screenshot** showing the API URL logs
2. **Network tab screenshot** showing failed request
3. **Render logs screenshot** showing if request reached backend

With these three items, any issue is fixable in <5 minutes.

