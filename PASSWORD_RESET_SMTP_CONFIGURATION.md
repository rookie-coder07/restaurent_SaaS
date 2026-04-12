# Password Reset SMTP Configuration Guide

## Overview

This guide fixes password reset email delivery issues by configuring proper SMTP settings in Supabase. Common issues include:

- ❌ 500 errors during password reset
- ❌ Emails not being delivered
- ❌ "SMTP connection failed" errors
- ❌ Localhost redirects in production

## Critical Issues Fixed

### 1. Redirect URL Issue

**Problem:** Using `window.location.origin` in production can redirect to localhost URLs.

**Solution:** Use environment-based URL configuration.

**Implementation:**
```jsx
// ✅ CORRECT - Uses environment variable
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const redirectTo = `${APP_URL}/reset-password`;

await supabase.auth.resetPasswordForEmail(email, { redirectTo });
```

**Environment Setup (.env.production):**
```env
VITE_APP_URL=https://your-production-domain.com
```

### 2. SMTP Configuration Issue

**Problem:** Gmail SMTP with regular password fails because Google requires app-specific passwords or OAuth.

**Solution:** Switch to Resend SMTP (transactional email service).

## Step 1: Create Resend Account

1. Visit [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email
4. Get your API key from dashboard

## Step 2: Add Domain to Resend

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `notifications.yourdomain.com`)
4. Add DNS records as instructed
5. Wait for verification (usually 5-10 minutes)

## Step 3: Configure Supabase SMTP

1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **Email Templates**
2. Click **SMTP Settings**
3. Enable **Use custom SMTP**
4. Enter the following settings:

| Setting | Value |
|---------|-------|
| **Host** | `smtp.resend.com` |
| **Port** | `587` |
| **Username** | `resend` |
| **Password** | `<YOUR_RESEND_API_KEY>` |
| **Sender Email** | `onboarding@yourdomain.com` |
| **Sender Name** | `RestroMax` |

**Example:**
```
Host: smtp.resend.com
Port: 587
Username: resend
Password: re_abc123xyz789...
Sender Email: noreply@yourdomain.com
Sender Name: RestroMax Security
```

5. Click **Test Connection** to verify

## Step 4: Update Supabase Auth URLs

1. Go to **Supabase Settings** → **Auth** → **URL Configuration**
2. Set **Site URL** (production domain):
   ```
   https://your-production-domain.com
   ```

3. Add **Redirect URLs**:
   ```
   https://your-production-domain.com/reset-password
   https://your-production-domain.com/admin/login
   http://localhost:5173/reset-password
   http://localhost:5173/admin/login
   ```

4. Save changes

## Step 5: Verify Frontend Configuration

Check `.env.production`:
```env
# Production environment variables
VITE_API_URL=https://your-api-domain.com/api/v1
VITE_FRONTEND_URL=https://your-production-domain.com
VITE_APP_URL=https://your-production-domain.com

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

## Step 6: Test Password Reset Flow

### Local Testing (Development)

1. Ensure `.env.local` has:
   ```env
   VITE_APP_URL=http://localhost:5173
   ```

2. Start frontend: `npm run dev`

3. Go to Login → Forgot Password

4. Enter test email

5. Check browser console for redirect URL:
   ```
   [Forgot Password] Using redirect URL: http://localhost:5173/reset-password
   ```

6. Check email (Resend logs or your email inbox)

### Production Testing

1. Deploy to production with correct `.env.production`

2. Test password reset on live domain

3. Verify redirect URL in browser console is NOT localhost:
   ```
   [Forgot Password] Using redirect URL: https://your-domain.com/reset-password
   ```

4. Check email delivery in Resend dashboard

## Troubleshooting

### 500 Error on Password Reset Request

**Cause:** SMTP configuration is incorrect or service is down

**Fix:**
1. Go to Supabase → SMTP Settings
2. Click **Test Connection**
3. Check error message
4. Verify credentials are correct
5. Check Resend dashboard for API key validity

### Email Not Delivered

**Cause:** Domain not verified or authentication issue

**Fix:**
1. Check Resend dashboard → **Domains** → verify status
2. Check Supabase SMTP settings again
3. Monitor Resend logs for delivery failures
4. Check spam/promotions folder

### Localhost URL in Production Emails

**Cause:** VITE_APP_URL not set in production

**Fix:**
1. Set `VITE_APP_URL` in production environment
2. Redeploy on Vercel/hosting
3. Restart backend if needed

### Rate Limit (429) Error

**Cause:** Too many reset requests from same user

**Fix:**
- Frontend automatically enforces 60-second cooldown
- User sees: "Please wait 60 seconds before retrying"
- Supabase also enforces account-level limits

## Alternative SMTP Providers

### SendGrid

```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: <SENDGRID_API_KEY>
```

### AWS SES

```
Host: email-smtp.{region}.amazonaws.com
Port: 587
Username: SMTP_USERNAME
Password: SMTP_PASSWORD
```

### Mailgun

```
Host: smtp.mailgun.org
Port: 587
Username: postmaster@yourdomain.com
Password: <MAILGUN_PASSWORD>
```

## Frontend Code Reference

### Login Component (`src/pages/Login.jsx`)

**Password Reset Function:**
```jsx
const handleForgotPassword = async (event) => {
  event.preventDefault();
  
  // Prevent duplicate calls
  if (resetRequestInProgressRef.current) {
    return;
  }
  
  // Get environment-based URL
  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
  const redirectTo = `${APP_URL}/reset-password`;
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    
    if (error) {
      // Detect SMTP errors (500)
      if (error.status === 500) {
        setError('Email service temporarily unavailable. Please try again.');
      }
      // Detect rate limits (429)
      else if (error.status === 429) {
        setError('Too many requests. Please wait 60 seconds.');
        setForgotCooldown(60);
      }
      else {
        setError(error.message);
      }
      return;
    }
    
    setSuccess('Reset link sent! Check your email.');
    setForgotCooldown(60);
  } finally {
    resetRequestInProgressRef.current = false;
  }
};
```

### ResetPassword Component (`src/pages/ResetPassword.jsx`)

Handles token verification and password update. Token comes from email link.

## Production Deployment Checklist

- [ ] Resend account created and API key obtained
- [ ] Domain added to Resend and verified
- [ ] Supabase SMTP settings configured with Resend
- [ ] Supabase Site URL set to production domain
- [ ] Redirect URLs added to Supabase
- [ ] `.env.production` includes `VITE_APP_URL`
- [ ] Frontend deployed to production domain
- [ ] Test password reset flow on production
- [ ] Monitor Resend dashboard for delivery
- [ ] Check browser console for correct redirect URL
- [ ] Verify no localhost URLs in production emails

## Environment Variables Reference

```bash
# Development (.env.local)
VITE_APP_URL=http://localhost:5173
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Production (.env.production)
VITE_APP_URL=https://your-production-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Support Resources

- **Resend Docs:** https://resend.com/docs
- **Supabase Auth:** https://supabase.com/docs/guides/auth
- **Supabase SMTP:** https://supabase.com/docs/guides/auth/auth-smtp

## Summary

✅ **Fixed Issues:**
- Redirect URL now uses environment variable (no localhost in production)
- SMTP configured with Resend (reliable transactional email)
- Better error handling for 500 SMTP errors
- Rate limiting feedback (429 errors)
- Production-ready configuration

✅ **Result:**
- Password reset emails delivered successfully
- Proper redirect URLs
- Clear error messages
- Stable production flow
