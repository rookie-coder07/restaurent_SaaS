# OTP Password Reset - Quick Start Testing Guide

## Quick Setup (5 Minutes)

### Step 1: Start Backend
```powershell
cd backend
npm install  # Only if first time
npm start    # Should show "✅ Server running on port 3000"
```

### Step 2: Start Frontend
```powershell
# In another terminal
cd frontend
npm install  # Only if first time
npm run dev  # Should show "✅ Local: http://localhost:5173"
```

### Step 3: Test OTP Flow

**URL:** http://localhost:5173/pos/login

**Option A: From Login Page**
1. Click "Forgot Password"
2. Click "Reset via OTP"
3. Continue to Step 4 below

**Option B: Direct to Reset Page**
1. Go directly to: http://localhost:5173/pos/reset-password
2. Continue to Step 4 below

### Step 4: Enter Email
```
Email: staff@restaurant.com
Click: "Send OTP Code"
```

**Check Backend Console** - You should see:
```
🔐 OTP created for staff@restaurant.com: 123456 (Expires in 10 minutes)
```
**Copy this OTP code**

### Step 5: Enter OTP
```
Paste OTP: 123456
Click: "Verify OTP"
```

### Step 6: Set New Password
```
New Password: TestPass123@
Confirm Password: TestPass123@
Click: "Reset Password"
```

### Step 7: Verify Success
- See "Password Reset Successful!" ✅
- Click "Back to Login"
- Login with new credentials:
  ```
  Email: staff@restaurant.com
  Password: TestPass123@
  ```

---

## Testing Different Scenarios

### Scenario 1: Incorrect OTP
```
1. Request OTP → Backend shows: 123456
2. Enter: 654321 (wrong)
3. Expected: ❌ "Invalid OTP. 4 attempt(s) remaining."
4. Correct: 123456
5. Expected: ✅ "OTP verified successfully"
```

### Scenario 2: Expired OTP
```
1. Request OTP → Backend shows: 123456
2. Wait 10+ minutes (or skip OTP verification for testing)
3. Try to verify
4. Expected: ❌ "OTP has expired. Please request a new password reset."
```

### Scenario 3: Too Many Attempts
```
1. Request OTP → Backend shows: 123456
2. Enter wrong code 5 times
3. Expected: ❌ "Too many attempts. Please try again after 15 minutes."
```

### Scenario 4: Invalid Email
```
1. Email: invalid-email (no @)
2. Click: "Send OTP Code"
3. Expected: ❌ "Enter a valid email address"
```

### Scenario 5: Password Too Short
```
1. After OTP verified
2. New Password: pass (only 4 chars)
3. Click: "Reset Password"
4. Expected: ❌ "Password must be at least 8 characters long"
```

---

## Testing with API (cURL / Postman)

### API Endpoint Tests

**1. Request OTP**
```bash
curl -X POST http://localhost:3000/api/v1/auth/request-password-reset-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@restaurant.com",
    "role": "staff"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "data": {
    "message": "OTP for staff@restaurant.com: 123456"
  }
}
```

**2. Verify OTP**
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@restaurant.com",
    "otp": "123456"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {}
}
```

**3. Set Password**
```bash
curl -X POST http://localhost:3000/api/v1/auth/set-password-with-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@restaurant.com",
    "newPassword": "TestPass123@"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {}
}
```

---

## Console Debugging

### Backend Logs to Watch

```
📧 Sending OTP email to staff@restaurant.com
🔐 OTP created for staff@restaurant.com: 123456 (Expires in 10 minutes)
✅ Email sent successfully to staff@restaurant.com
✅ OTP verified successfully for staff@restaurant.com
✅ Password reset completed for staff@restaurant.com via OTP
🗑️ OTP invalidated for staff@restaurant.com
```

### Frontend Console Logs

Open Developer Tools (F12) in browser:

```javascript
// API requests will show up in Network tab
POST /v1/auth/request-password-reset-otp
POST /v1/auth/verify-otp
POST /v1/auth/set-password-with-otp
```

---

## Quick Fixes

### Issue: OTP shows as undefined
**Fix:** Make sure you're running in development mode
```env
NODE_ENV=development
```

### Issue: "Email service failed"
**Fix:** Check RESEND_API_KEY is not set to real key yet
```env
RESEND_API_KEY=test-key  # For development
```

### Issue: Port already in use
**Backend (port 3000):**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

**Frontend (port 5173):**
```bash
# Kill all node processes
taskkill /F /IM node.exe

# Restart
npm run dev
```

### Issue: CORS error
**Solution:** Already configured in backend
- Backend accepts requests from `http://localhost:5173`
- If different port, update CORS in `backend/src/app.js`

---

## Test Users

### For Testing Existing Staff
```
Email: posbilling@gmail.com
Old Password: (from database)
New Password: (set via OTP)
```

### Using Non-Existent Email
```
Email: newstaff@test.com
Expected: ❌ "User not found with this email"
```

---

## Data to Check

### Database After Reset

**Before:**
```sql
SELECT email, password_hash, updated_at FROM users 
WHERE email = 'staff@restaurant.com';
```

**After OTP Reset:**
- `password_hash`: Will change (bcrypt hash)
- `updated_at`: Will update to current time

### Verify in Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Table: `users`
4. Find: `staff@restaurant.com`
5. Check: `password_hash` changed ✓
6. Check: `updated_at` updated ✓

---

## Performance Testing

### Load Test: 10 Password Resets

```bash
# Run in a loop
for i in {1..10}; do
  echo "Reset #$i"
  curl -X POST http://localhost:3000/api/v1/auth/request-password-reset-otp \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@restaurant.com\",\"role\":\"staff\"}"
  sleep 1
done
```

**Expected:** All requests complete in < 500ms

---

## Success Metrics

After implementation, verify:

✅ OTP generated correctly (6 digits)
✅ Email sending works (or logged in dev mode)
✅ OTP verification validates correctly
✅ Password hash updates in database
✅ User can login with new password
✅ Old password no longer works
✅ OTP expires after 10 minutes
✅ Max 5 verification attempts enforced
✅ Error messages are user-friendly
✅ UI shows all 4 steps correctly

---

## Troubleshooting Checklist

- [ ] Backend running on port 3000 (check `npm start` output)
- [ ] Frontend running on port 5173 (check `npm run dev` output)
- [ ] Can see OTP in backend console
- [ ] API endpoints responding (check Network tab in DevTools)
- [ ] Database connection working (check logs)
- [ ] CORS errors resolved
- [ ] Ports not blocked by firewall
- [ ] NODE_ENV set to development

---

## Next Steps

After successful testing:

1. **Set up real email service:**
   - Get Resend API key from https://resend.com
   - Set `RESEND_API_KEY` in production environment

2. **Deploy:**
   - Push to production branch
   - Deploy backend and frontend
   - Monitor email delivery in Resend dashboard

3. **Communicate to staff:**
   - Update login help text
   - Train staff on OTP process
   - Have backup contact for support

4. **Monitor:**
   - Track password reset requests
   - Monitor email delivery rates
   - Collect user feedback

---

**Version:** 1.0
**Last Updated:** 2024
