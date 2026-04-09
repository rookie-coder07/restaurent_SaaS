# Staff OTP-Based Password Reset System

## Overview

This document explains the new **Email OTP-based password reset system** for staff members. This replaces the previous manual-approval system where managers/admins had to manually reset passwords. Now, staff can independently reset their passwords using One-Time Passwords (OTP) sent to their email.

## Architecture

### System Flow

```
Staff Member
    ↓
1. Clicks "Forgot Password" on POS Login
    ↓
2. Enters email → System generates OTP & sends via email
    ↓
3. Receives OTP in email
    ↓
4. Enters 6-digit OTP code
    ↓
5. Sets new password (min 8 characters)
    ↓
6. Password updated in database
    ↓
7. Can now login with new password
```

## Components

### Backend

#### 1. **OTP Service** (`backend/src/utils/otpService.js`)
- **Generates** random 6-digit OTPs
- **Stores** OTPs in memory (use Redis for production)
- **Verifies** OTPs with timeout and attempt limits
- **Invalidates** OTPs after successful verification

**Key Features:**
- OTP validity: 10 minutes
- Max verification attempts: 5
- Attempt reset window: 15 minutes
- In-memory storage (Map-based)

**Methods:**
```javascript
generateOTP()                    // Returns 6-digit OTP string
createOTP(email)                 // Generates & stores OTP
verifyOTP(email, providedOtp)    // Verifies OTP validity
invalidateOTP(email)             // Clears OTP after use
getOTPStatus(email)              // Returns OTP status (for debugging)
clearAllOTPs()                   // Clears all OTPs
```

#### 2. **Email Service** (`backend/src/utils/emailService.js`)
- **Sends** OTP emails via Resend API
- **Sends** password reset confirmation emails
- **Development mode** support (logs OTP to console)

**Environment Variables Required:**
```
RESEND_API_KEY=your_resend_api_key
NODE_ENV=development  # For development/testing
```

**Methods:**
```javascript
sendOTPEmail(email, otp, userName)              // Sends OTP email
sendPasswordResetSuccessEmail(email, userName)  // Sends confirmation
```

#### 3. **Password Reset Service Updates** (`backend/src/services/passwordResetService.js`)

**New Methods for OTP-based Reset:**
```javascript
// Step 1: Request OTP
requestPasswordResetOTP(email, role)

// Step 2: Verify OTP
verifyPasswordResetOTP(email, otp)

// Step 3: Set new password after OTP verification
setPasswordWithOTP(email, newPassword)

// Debugging: Get OTP status
getOTPStatus(email)
```

### API Endpoints

#### **New OTP Password Reset Endpoints**

**1. Request OTP**
```
POST /api/v1/auth/request-password-reset-otp
```
- **Body:**
  ```json
  {
    "email": "staff@restaurant.com",
    "role": "staff"
  }
  ```
- **Response (Success):**
  ```json
  {
    "success": true,
    "message": "OTP sent to your email",
    "data": {
      "messageId": "email_provider_id",
      "email": "staff@restaurant.com"
    }
  }
  ```

**2. Verify OTP**
```
POST /api/v1/auth/verify-otp
```
- **Body:**
  ```json
  {
    "email": "staff@restaurant.com",
    "otp": "123456"
  }
  ```
- **Response (Success):**
  ```json
  {
    "success": true,
    "message": "OTP verified successfully",
    "data": {}
  }
  ```

**3. Set Password with OTP**
```
POST /api/v1/auth/set-password-with-otp
```
- **Body:**
  ```json
  {
    "email": "staff@restaurant.com",
    "newPassword": "SecurePass123!"
  }
  ```
- **Response (Success):**
  ```json
  {
    "success": true,
    "message": "Password reset successfully",
    "data": {}
  }
  ```

### Frontend

#### 1. **StaffPasswordResetOTP Page** (`frontend/src/pages/StaffPasswordResetOTP.jsx`)

**Four-Step UI Flow:**

1. **Email Entry Step**
   - User enters work email
   - Validation: Valid email format required
   - Action: Sends OTP to email

2. **OTP Verification Step**
   - User enters 6-digit code
   - Validation: Must be exactly 6 digits
   - Shows helpful message with email
   - Action: Verifies OTP

3. **New Password Step**
   - User sets new password (min 8 chars)
   - User confirms password
   - Shows password requirements
   - Action: Updates password in database

4. **Success Step**
   - Confirmation message
   - Link to login page

#### 2. **Login Page Updates** (`frontend/src/pages/Login.jsx`)

**Changes:**
- For POS (staff) portal: "Forgot Password" link now shows options
- Staff can choose between:
  - **OTP Reset** (recommended): Instant email OTP
  - Manual request (fallback)

#### 3. **API Integration** (`frontend/src/services/api.js`)

Uses Axios API instance with:
- Automatic token handling
- Error interception
- Rate limiting compliance

### Database

**No new tables required** - Uses existing schema:
- `users.password_hash` - Stores password
- `users.updated_at` - Tracks last update

**OTP Storage:**
- Temporary in-memory store during session
- Auto-clears after verification or timeout

## Workflow Example

### Step-by-Step: Staff Password Reset

1. **Staff Navigate to Login**
   ```
   URL: http://localhost:5173/pos/login
   ```

2. **Click "Forgot Password"**
   - Modal appears with OTP button

3. **Click "Reset via OTP"**
   ```
   Redirect to: /pos/reset-password
   ```

4. **Enter Email**
   ```
   Input: staff@restaurant.com
   Action: POST /api/v1/auth/request-password-reset-otp
   Response: OTP sent to email
   ```

5. **Receive Email**
   ```
   Subject: Password Reset - Your OTP Code
   Body: Your OTP is 123456 (valid for 10 minutes)
   ```

6. **Enter OTP Code**
   ```
   Input: 123456
   Action: POST /api/v1/auth/verify-otp
   Response: OTP verified
   ```

7. **Set New Password**
   ```
   Input: NewPassword123
   Action: POST /api/v1/auth/set-password-with-otp
   Response: Password updated ✓
   Email sent: Password reset confirmation
   ```

8. **Login with New Password**
   ```
   Email: staff@restaurant.com
   Password: NewPassword123
   Login: SUCCESS
   ```

## Security Considerations

### OTP Security
- ✅ 6-digit code is sufficient for 10-minute validity
- ✅ Limited to 5 verification attempts
- ✅ Expires after 10 minutes
- ✅ Attempts reset after 15 minutes of inactivity

### Password Security
- ✅ Minimum 8 characters required
- ✅ Bcrypt hashing with 10 salt rounds
- ✅ Confirmation field prevents typos
- ✅ Stored as `password_hash` in database

### Email Security
- ✅ Uses Resend API (professional email service)
- ✅ HTTPS only
- ✅ OTP never visible in URL
- ✅ Confirmation email on successful reset

## Development/Testing

### Testing OTP System

**1. Using Development Mode:**

When `NODE_ENV=development` or `RESEND_API_KEY` not set:
- OTP is logged to backend console
- Email sending is skipped
- Use logged OTP for testing

**2. Manual Testing Steps:**

```bash
# Terminal 1: Backend (watch console for OTP)
cd backend
npm start
# Watch for: "[OTP created for email@com]: 123456"

# Terminal 2: Frontend
cd frontend
npm run dev
```

**3. Test Flow:**

1. Go to `http://localhost:5173/pos/reset-password`
2. Enter: `test@staff.com`, Role: `staff`
3. Check backend console for OTP
4. Enter OTP in UI
5. Set new password
6. See "Success" page

### API Testing with cURL

```bash
# 1. Request OTP
curl -X POST http://localhost:3000/api/v1/auth/request-password-reset-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@rest.com","role":"staff"}'

# 2. Verify OTP (check backend console for OTP)
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@rest.com","otp":"123456"}'

# 3. Set new password
curl -X POST http://localhost:3000/api/v1/auth/set-password-with-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@rest.com","newPassword":"NewPass123"}'
```

## Deployment Configuration

### Environment Variables

**Production:**
```env
RESEND_API_KEY=re_xxxxx  # From Resend dashboard
NODE_ENV=production
```

**Development:**
```env
NODE_ENV=development
RESEND_API_KEY=test-key  # Optional - will log to console
```

### Email Provider Setup

**Using Resend:**

1. Sign up at https://resend.com
2. Get API key from Dashboard
3. Set `RESEND_API_KEY` in environment
4. Update `FROM_EMAIL` in `emailService.js` if needed

**Alternative Email Providers:**
- SendGrid: Update `emailService.js` to use SendGrid API
- AWS SES: Update `emailService.js` to use AWS SDK
- Custom SMTP: Use `nodemailer` package

### Redis Integration (Production)

For production, replace in-memory OTP storage with Redis:

```javascript
// In otpService.js
import redis from 'redis';
const redisClient = redis.createClient();

// Replace Map-based storage with Redis
static async createOTP(email) {
  const otp = this.generateOTP();
  const expiresAt = OTP_LIFETIME_MINUTES * 60;
  await redisClient.setex(`otp:${email}`, expiresAt, JSON.stringify({otp, attempts: 0}));
}
```

## UI Routes

**System:**
- Staff: `/pos/reset-password` (Direct OTP-based self-service)
- Admin: Supabase Auth for owner portal reset

## OTP-Based Reset (Current System)

| Feature | Value |
|---------|-------|
| **Who resets password** | Staff (self-service) |
| **Time to reset** | 2-3 minutes |
| **Verification method** | Email OTP |
| **User experience** | Instant, self-directed |
| **Support load** | Low |
| **Security** | High (OTP-based) |

## Troubleshooting

### Issue: OTP not received in email

**Solutions:**
1. Check spam/junk folder
2. Verify email address is correct
3. Check `RESEND_API_KEY` is set
4. Check logs in development mode

### Issue: "Invalid OTP" error

**Possible causes:**
1. OTP expired (valid 10 minutes)
2. Incorrect 6-digit code
3. Used too many attempts (max 5)

**Solutions:**
1. Request new OTP
2. Double-check code
3. Wait 15 minutes or contact admin

### Issue: "Password too short" error

**Reason:** Password must be at least 8 characters

**Solution:** Use password with 8+ characters, mixed case, numbers, symbols

### Issue: Backend won't start

**Check:**
1. Node dependencies: `npm install`
2. Environment variables set
3. Port 3000 available
4. Database connection working

## Files Modified/Created

### New Files Created
- `backend/src/utils/otpService.js` - OTP generation & verification
- `backend/src/utils/emailService.js` - Email sending
- `frontend/src/pages/StaffPasswordResetOTP.jsx` - UI component

### Files Modified
- `backend/src/services/passwordResetService.js` - Added OTP methods
- `backend/src/controllers/passwordResetController.js` - Added OTP endpoints
- `backend/src/routes/auth.js` - Added OTP routes
- `frontend/src/pages/Login.jsx` - Added OTP link for POS
- `frontend/src/App.jsx` - Added route + import

### Database
- No migrations needed

## Future Enhancements

1. **SMS OTP** - Send OTP via SMS as alternative
2. **Biometric Reset** - Support fingerprint/face ID
3. **Recovery Codes** - Generate backup codes for account recovery
4. **2FA** - Combine with two-factor authentication
5. **Email Verification** - Verify email on account creation
6. **Rate Limiting** - Prevent brute force attacks
7. **Analytics** - Track password reset metrics

## Support & Questions

For issues or questions:
1. Check logs in `backend/logs/`
2. Review console output in development
3. Check database connectivity
4. Verify email service configuration

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** Production Ready
