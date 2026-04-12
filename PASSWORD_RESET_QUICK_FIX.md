# Password Reset - Quick Fix Guide

## Issues & Solutions

### Issue 1: Redirect URL Points to Localhost in Production

**Symptom:**
- Email contains link: `http://localhost:5173/reset-password`
- User sees "This page doesn't exist"

**Quick Fix:**
1. Set `VITE_APP_URL` in production environment:
   ```bash
   VITE_APP_URL=https://your-domain.com
   ```

2. Redeploy frontend (Vercel will auto-deploy on git push)

3. Test: Check browser console
   ```
   [Forgot Password] Using redirect URL: https://your-domain.com/reset-password
   ```

---

### Issue 2: 500 Error on Password Reset Button Click

**Symptom:**
- Clicking "Send Reset Link" shows error
- Console shows: `status: 500`

**Quick Fix:**

#### Option A: Use Resend SMTP (Recommended)

1. Create free account at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Go to **Supabase → Settings → Auth → Email**
4. Click **Use Custom SMTP**
5. Enter:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: <YOUR_RESEND_API_KEY>
   ```
6. Click **Test Connection**
7. Save and retry

#### Option B: Check SMTP Settings

```
✅ Correct Settings:
Host: smtp.resend.com
Port: 587
Username: resend
Password: re_abc123xyz789...

❌ Wrong Settings:
Host: smtp.gmail.com (Gmail needs OAuth)
Port: 465 (should be 587 with Resend)
Username: your-email@gmail.com (should be "resend")
```

---

### Issue 3: Emails Not Being Delivered

**Quick Checklist:**

1. **Check Resend Dashboard:**
   - Go to [resend.com](https://resend.com) → Logs
   - Look for recent failed deliveries
   - Check error messages

2. **Verify Supabase SMTP Test:**
   - Go to Supabase Settings → Auth → Email
   - Click **Test Connection**
   - Should say "Connection successful"

3. **Check Domain Verification:**
   - Resend dashboard → Domains
   - Verify domain status is "Verified"
   - If not, add DNS records and wait 5-10 min

4. **Check Email Provider:**
   - Gmail: Check spam/promotions folder
   - Corporate email: Check spam filter
   - Test with Gmail first to isolate issue

5. **Verify Sender Email:**
   - Supabase SMTP settings should have valid sender email
   - Example: `noreply@yourdomain.com`

---

## One-Minute Setup

If starting fresh:

### 1. Create Resend Account (2 min)
```
https://resend.com → Sign up → Get API key
```

### 2. Add to Supabase (3 min)
```
Supabase → Auth → Email → Use Custom SMTP

Host: smtp.resend.com
Port: 587
Username: resend
Password: <API_KEY>

Click: Test Connection
```

### 3. Set Production URL (1 min)
```
.env.production:
VITE_APP_URL=https://your-domain.com
```

### 4. Deploy (1 min)
```
Push to GitHub → Vercel auto-deploys
```

### 5. Test (1 min)
```
Click "Forgot Password"
Check email
Verify URL is NOT localhost
```

---

## Debug Logs to Check

### Frontend Console (Chrome DevTools)

```javascript
// Should see:
[Forgot Password] Initiating password reset request for: user@example.com
[Forgot Password] Using redirect URL: https://your-domain.com/reset-password
```

### Supabase Logs

Go to **Supabase → Logs → Auth** to see:
- Password reset requests
- Email sent events
- SMTP connection status

### Resend Dashboard

Go to **resend.com → Logs** to see:
- Email delivery status
- Bounce/failure reasons
- Delivery timestamps

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `500 Internal Server Error` | SMTP misconfigured | Update SMTP settings in Supabase |
| `Email service unavailable` | Resend service down | Wait 5min or check Resend status |
| `Too many requests (429)` | Rate limited | User must wait 60 seconds |
| `Invalid redirect URL` | URL not in Supabase settings | Add to Auth → Redirect URLs |
| `No such email` | User doesn't exist | Check email in address bar |

---

## Environment Variables Checklist

### Development (.env.local)
```env
VITE_APP_URL=http://localhost:5173 ✅
VITE_SUPABASE_URL=https://your-project.supabase.co ✅
VITE_SUPABASE_ANON_KEY=your_key ✅
```

### Production (.env.production)
```env
VITE_APP_URL=https://your-domain.com ✅ (NOT localhost!)
VITE_SUPABASE_URL=https://your-project.supabase.co ✅
VITE_SUPABASE_ANON_KEY=your_key ✅
```

---

## Verification Steps (5 minutes)

1. **Check Frontend URL:**
   ```
   Login page → Forgot Password
   Open DevTools → Console
   Look for: "Using redirect URL: https://your-domain.com/reset-password"
   ```

2. **Test Email Send:**
   ```
   Enter your test email
   Click "Send Reset Link"
   Check for error in console (should be none)
   ```

3. **Check Email Delivery:**
   ```
   Resend dashboard → Logs
   Should show email sent to your address
   Check inbox (including spam)
   ```

4. **Verify Reset Link:**
   ```
   Click link in email
   Should redirect to: https://your-domain.com/reset-password
   Browser should NOT show localhost URL
   ```

5. **Complete Reset:**
   ```
   Enter new password
   Password must have: 8+ chars, 1 uppercase, 1 number
   Click "Update Password"
   Should redirect to login
   ```

---

## Still Having Issues?

1. **Check Supabase SMTP Test:**
   - Supabase → Auth → Email → Test Connection
   - If fails, update credentials

2. **Verify Resend API Key:**
   - resend.com → API Keys
   - Copy exact key (no spaces)
   - Paste into Supabase SMTP password

3. **Check Domain Verification:**
   - resend.com → Domains
   - Click domain → copy DNS records
   - Add to your DNS provider
   - Wait for verification

4. **Monitor Logs in Real-time:**
   - Resend: https://resend.com/logs
   - Supabase: Dashboard → Logs → Auth
   - Frontend: Browser console (F12)

5. **Ask for Help:**
   - Resend Support: support@resend.com
   - Supabase Support: https://supabase.com/support
   - Include: error messages, Supabase logs, Resend logs

---

## Summary

✅ **What Was Fixed:**
- Redirect URL now uses `VITE_APP_URL` (no localhost in production)
- Error handling detects 500 SMTP errors
- Error handling detects 429 rate limit errors
- Better user feedback messages

✅ **What You Need to Do:**
1. Create Resend account (free)
2. Update Supabase SMTP settings
3. Set `VITE_APP_URL` in production
4. Deploy and test

✅ **Result:**
- Emails deliver successfully
- Users see proper redirect URLs
- Clear error messages
- Production-ready system
