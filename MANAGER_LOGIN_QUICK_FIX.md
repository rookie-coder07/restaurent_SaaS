# Manager Login Fix - Quick Deployment Guide

## ⚡ Quick Start (5 minutes)

### 1. Verify Render Environment Variables

**🔴 CRITICAL:** Check your Render backend has these variables set:

Go to: Render Dashboard → Your Backend Service → Settings → Environment

Required variables:
- `SUPABASE_URL` ✅ (should have a value)
- `SUPABASE_ANON_KEY` ✅ (should have a value)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ ⚠️ **THIS ONE IS CRITICAL FOR MANAGER LOGIN**
- `SUPABASE_JWT_SECRET` ✅
- `JWT_SECRET` ✅

**If `SUPABASE_SERVICE_ROLE_KEY` is missing:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API → Service Role Key**
4. Copy the key (⚠️ Keep this secret!)
5. Go back to Render → Environment → Add new variable
6. Name: `SUPABASE_SERVICE_ROLE_KEY`
7. Value: (paste the key you copied)
8. Save

### 2. Deploy Latest Code

```bash
git pull origin main  # Get latest changes
git push # Trigger Render auto-deploy
```

Wait 2 minutes for deployment to complete.

### 3. Verify Deployment

Check Render logs for this message:
```
✅ Supabase connected (admin client will be initialized on first admin operation)
```

### 4. Test Manager Login

```bash
curl -X POST https://restaurent-backend-448t.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager_email@example.com",
    "password": "manager_password",
    "portal": "manager"
  }'
```

**Expected Success Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "role": "manager",
    "redirectTo": "restaurant-dashboard"
  }
}
```

**If you get 503 error:** `SUPABASE_SERVICE_ROLE_KEY` is still missing from Render environment

---

## What Was Fixed

| Component | Change |
|-----------|--------|
| **Supabase Config** | Removed eager admin client initialization (was causing startup crash) |
| **Admin Client** | Now lazy-loaded only when needed (graceful degradation) |
| **Error Handling** | Returns 503 instead of generic 500 for configuration errors |
| **Logging** | Better debugging info in server logs |
| **Services** | All admin operations now have proper error handling |

---

## Affected Operations (Now Fixed)

✅ Manager login  
✅ Staff registration  
✅ Manager registration  
✅ Password reset  
✅ Developer account creation  

---

## Rollback (if needed)

```bash
git log --oneline | grep -i "manager\|login\|supabase"
git revert <commit_hash>
git push
```

---

## Support

**Manager login still failing?**

1. ✅ Reload/clear browser cache
2. ✅ Wait 1 minute after deployment (cold start)
3. ✅ Verify SUPABASE_SERVICE_ROLE_KEY in Render environment
4. ✅ Check Render logs for error messages starting with `🔴`
5. ✅ Test curl command above to isolate frontend vs backend issue

**Error: "Backend configuration error"**
→ SUPABASE_SERVICE_ROLE_KEY is missing from Render environment

**Error: "Invalid email or password"**
→ Manager account email/password incorrect (separate issue)

---

## Files Changed

📝 `backend/src/config/supabase.js`  
📝 `backend/src/services/authService.js`  
📝 `backend/src/services/developerService.js`  
📝 `backend/src/services/passwordResetService.js`  
📝 `backend/src/middleware/errorHandler.js`  

All backward compatible. No database migrations needed.

---

**Deployment Status:** Ready to Deploy ✅  
**Risk Level:** Low (backward compatible)  
**Rollback:** Available (1 git revert command)
