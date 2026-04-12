# Password Reset Flow - Quick Testing Reference

## Quick Test (5 minutes)

### ✅ Test 1: Forgot Password Request

```
Step 1: Open http://localhost:5173/admin/login
Step 2: Click "Forgot Password?"
Step 3: Enter email: test@example.com
Step 4: Click "Send Reset Link"

Expected:
✓ Button shows "Sending..." with spinner
✓ Success message: "Reset link sent to your email"
✓ Button shows "Retry in 60s" (disabled)
✓ Countdown counts down: 59s, 58s, etc.
```

### ✅ Test 2: Reset Page Verification

```
Step 1: (Manually enter reset URL with token)
        http://localhost:5173/reset-password#access_token=xyz&type=recovery
Step 2: Wait for page to load

Expected:
✓ Page shows "Verifying your reset link..."
✓ After 1-2 seconds, page becomes ready
✓ No error message shown
✓ Password inputs visible
```

### ✅ Test 3: Password Update

```
Step 1: On reset page, enter:
        Password: NewPassword123
        Confirm: NewPassword123
Step 2: Click "Update Password"

Expected:
✓ Button shows "Updating Password..." with spinner
✓ Success message: "✓ Password updated successfully"
✓ After 2 seconds: redirects to /admin/login
```

### ✅ Test 4: Rate Limit Test

```
Step 1: Click "Forgot Password?" on login
Step 2: Send reset link
Step 3: IMMEDIATELY click "Send Reset Link" again
Step 4: Do this 3-4 times rapidly

Expected:
✓ First request succeeds
✓ Subsequent clicks show: "Retry in 60s [DISABLED]"
✓ Button stays disabled during cooldown
✓ Countdown shows accurate time
```

### ✅ Test 5: Password Validation

```
Test weak passwords:
1. Enter "test" (too short) → Should show error
2. Enter "password123" (no uppercase) → Should show error
3. Enter "Password" (no number) → Should show error
4. Enter "Pass123" vs "Pass124" (mismatch) → Should show error

Valid password: "TestPass123"
✓ No validation errors
✓ Submit button enabled
```

---

## Common Issues Quick Fix

| Issue | Check | Fix |
|-------|-------|-----|
| Email not received | Spam folder, SMTP config | Check Supabase Email Logs |
| Wrong domain in link | Check email body | Verify `window.location.origin` |
| Reset page shows error | Check URL hash | Manually add `#access_token=...` |
| Rate limit shown | Clicked too fast | Wait 60 seconds, try again |
| Password won't update | Check password strength | Use 8+ chars, 1 uppercase, 1 number |

---

## Verification URLs (Copy-Paste Ready)

### Dev Environment

```
Login Page: http://localhost:5173/admin/login
Reset Page: http://localhost:5173/reset-password
Reset Page (with token): http://localhost:5173/reset-password#access_token=TEST_TOKEN&type=recovery&expires_in=3600
```

### Production Environment

```
Login Page: https://restaurentsaas-seven.vercel.app/admin/login
Reset Page: https://restaurentsaas-seven.vercel.app/reset-password
```

---

## Console Debugging

### Check Logs (DevTools → Console)

```javascript
// Should see when resetting password:
[Forgot Password] Error: { status: 429, message: "Rate limit..." }
[ResetPassword] Verification: { hasSession: true, hasRecoveryTokens: true }
[ResetPassword] Auth state changed: { event: "PASSWORD_RECOVERY" }
[ResetPassword] Updating password...
```

### Check Session (DevTools → Application → Cookies)

```
Look for:
- auth-token (session active)
- auth-token (cleared after logout)
```

### Check Email Logs (Supabase Dashboard)

```
1. Go to Supabase Project
2. Click: Auth → Email Templates
3. Click: Email Logs tab
4. See all sent emails + status
```

---

## Key Test Cases

### ✅ Happy Path
```
User requests reset → Email sent → Clicks link → Sets password → Redirects to login
```

### ✅ Rate Limit Path
```
User clicks "Send" → Success → Immediately clicks "Send" again → Shows cooldown
```

### ✅ Expired Link Path
```
User waits 1+ hour → Clicks old reset link → See "expired" error → Clicks "Request new link"
```

### ✅ Validation Path
```
User enters weak password → See validation error → Enter strong password → Success
```

### ✅ Mobile Path
```
Open reset page on phone → Responsive layout → Inputs full width → Tap to submit → Works same as desktop
```

---

## Expected Response Times

| Action | Time |
|--------|------|
| Click "Send Reset Link" | < 2s |
| Page verification | 1-2s |
| Email delivery | 1-5 minutes |
| Password update | < 2s |
| Redirect to login | Immediate |

---

## Status Indicators

### Green (Good)
```
✓ Reset link sent
✓ Password updated successfully
✓ Ready to enter password
```

### Yellow (Waiting)
```
⏱️ Too many requests, please wait
... (countdown)
```

### Red (Error)
```
✗ Invalid email address
✗ This reset link has expired
✗ Passwords do not match
```

---

## Test Email Addresses

```
For Testing:
- test@example.com (any test email)
- dev@restaurant.local
- reset-test@example.com

Supabase will send real emails if SMTP configured,
or show in Supabase Dashboard email logs.
```

---

## Final Verification Checklist

Before declaring complete:

- [ ] Dev: Request reset → Email received → Link works
- [ ] Dev: Reset password → Success → Redirect works
- [ ] Dev: Rapid clicks → Rate limit shown → Cooldown works  
- [ ] Prod: Same flow works on Vercel
- [ ] Prod: Email contains `https://restaurentsaas-seven.vercel.app/...`
- [ ] Mobile: All inputs responsive
- [ ] Console: No JS errors
- [ ] Supabase: Email logs show delivery

---

## Contact Points

### For Issues:

1. **Check browser console** → See [Console Debugging] section
2. **Check Supabase Email Logs** → See [Console Debugging] section  
3. **Test with fresh incognito window** → Clear cache issues
4. **Check password strength** → Must be 8+ chars, 1 upper, 1 number
5. **Wait 60 seconds** → If getting rate limited

---

**Last Updated:** April 13, 2026  
**Status:** ✅ Production Ready

