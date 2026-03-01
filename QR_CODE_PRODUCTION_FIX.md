# QR CODE PRODUCTION FIX - RENDER DEPLOYMENT

## THE PROBLEM ❌
- QR codes were hardcoded to wrong Render URL
- When admin generated QR from localhost, it pointed to localhost
- Mobile scans would fail or point to dev environment
- NOT production-ready

## THE SOLUTION ✅
- QR generation now uses `VITE_FRONTEND_URL` environment variable
- Must be set in **Render deployment settings** to your actual Render URL
- Will point to correct production frontend regardless of where QR is generated

---

## HOW TO FIX (3 Steps)

### Step 1: Get Your Render Frontend URL

1. Go to: https://dashboard.render.com
2. Click on your **frontend service** (the web service for React app)
3. Copy the **URL** from the top (looks like: `https://your-app-xyz.onrender.com`)
4. Save this URL - you'll need it next

### Step 2: Update Environment Variables in Render

1. In Render dashboard, click your frontend service
2. Go to **Settings** tab
3. Scroll down to **Environment Variables**
4. Click **Add Environment Variable**
5. Set:
   - **Key**: `VITE_FRONTEND_URL`
   - **Value**: `https://your-app-xyz.onrender.com` (paste your URL)
6. Click **Save**

Render will automatically redeploy with this new variable.

### Step 3: Deploy Code Changes

```bash
git add frontend/src/components/QRCodeModal.jsx
git add frontend/src/utils/qrCodeGenerator.js
git add frontend/.env.production
git add frontend/.env.example
git commit -m "Fix: Use production URL for QR codes via VITE_FRONTEND_URL"
git push origin main
```

Render will automatically redeploy. Wait 1-2 minutes.

---

## VERIFY IT'S FIXED

After deploy:

1. **Open Render frontend URL** in browser (not localhost)
2. **Log in as admin**
3. **Go to: Tables**
4. **Click "View QR Code"** on any table
5. **Check browser console** (F12 → Console)
   - Should show: `📍 QR pointing to: https://your-app-xyz.onrender.com`
   - Should show: `📍 Using VITE_FRONTEND_URL: https://your-app-xyz.onrender.com`
6. **Scan with mobile**
   - Should open: `https://your-app-xyz.onrender.com/menu?table=X`
   - NOT localhost! ✅

---

## ENVIRONMENT VARIABLES REFERENCE

| Variable | What It's For | Example | Where to Set |
|----------|---------------|---------|--------------|
| `VITE_FRONTEND_URL` | **QR code links (IMPORTANT!)** | `https://app.onrender.com` | ✅ **Render Settings** |
| `VITE_API_BASE_URL` | API requests | `https://api.onrender.com/api` | Render Settings |
| `VITE_CLOUDINARY_CLOUD_NAME` | Image uploads | `dof234wuj` | Render Settings |

---

## EXACT RENDER SETUP SCREENSHOT STEPS

```
Render Dashboard
    ↓
Your Frontend Service (Web)
    ↓
Settings Tab
    ↓
Scroll down to "Environment"
    ↓
Add Variable:
  Key: VITE_FRONTEND_URL
  Value: https://YOUR-EXACT-RENDER-URL.onrender.com
    ↓
Save
    ↓
Wait for redeploy (1-2 min)
    ↓
Done!
```

---

## HOW IT WORKS

```
Development (localhost):
  Admin on http://localhost:5173
  Generate QR
  → QR points to: http://localhost:5173/menu?table=1
  → Works locally ✅

Production (Render):
  Admin on https://your-app.onrender.com
  OR admin on http://localhost:5173 (IMPORTANT: still works!)
  Generate QR
  → QR points to: https://your-app.onrender.com/menu?table=1
  → Works on mobile ✅
  → No localhost pollution ✅
```

The key difference: **VITE_FRONTEND_URL is set in Render**, so it's used regardless of where the code is running from!

---

## IF QR STILL POINTS TO LOCALHOST

This means the environment variable didn't apply. Check:

1. **Variable set in Render?**
   - Go to Settings → Environment
   - Verify `VITE_FRONTEND_URL` exists and has correct value

2. **Redeploy after setting variable?**
   - Check Render dashboard → "Recent Deploys"
   - Should show a recent deployment
   - If not, manual redeploy: Click "Manual Deploy" → "Deploy latest commit"

3. **Check browser console**
   - Reload page (Ctrl+Shift+R for hard refresh)
   - Open F12 → Console
   - Look for: `📍 Using VITE_FRONTEND_URL: ...`
   - If it says "Not set", variable didn't load

4. **Clear browser cache**
   - The built HTML might be cached
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

---

## PRODUCTION CHECKLIST

- [ ] Got Render frontend URL
- [ ] Set `VITE_FRONTEND_URL` in Render Settings
- [ ] Render redeploy shows green checkmark
- [ ] Code changes committed and pushed
- [ ] Admin page loads QR view
- [ ] Browser console shows correct VITE_FRONTEND_URL
- [ ] QR scanned on mobile opens correct URL (not localhost)
- [ ] Mobile loads menu correctly

---

## FINAL STATE (Production Ready)

✅ QR codes point to Render URL  
✅ Mobile scans work from anywhere  
✅ No localhost in QR codes  
✅ Admin can use localhost OR production for generating QR  
✅ All QR codes point to same production URL  
✅ Kitchen receives table orders correctly  

---

**Now it's truly production-ready!**
