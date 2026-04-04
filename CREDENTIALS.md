# 🔐 LOGIN CREDENTIALS - QUICK ACCESS

## SAMPLE TEST CREDENTIALS (DEMO 1)

```
Email:    test@example.com
Password: Test123@456
```

## SAMPLE MANAGER CREDENTIALS (DEMO 2)

```
Email:    manager@restaurant.com
Password: Manager123@456
```

### Account Info:
- **Restaurant Name**: Test Restaurant
- **Phone**: 9876543210
- **City**: Bellary
- **Role**: Owner (Full Access)
- **Status**: Active ✅

### Where to Login:
- **Frontend URL**: http://localhost:5173
- **Backend API**: http://localhost:3000


---

## HOW TO CREATE ADDITIONAL TEST ACCOUNTS

### Method 1: Register via UI
1. Go to http://localhost:5173/register
2. Fill form with:
   - Restaurant Name: Any name
   - Email: your-email@example.com
   - Phone: 10-digit number
   - City: Select "Bellary"
   - Password: Min 8 chars (uppercase, lowercase, number)
3. Click "Register"
4. Account created automatically ✅

### Method 2: API Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Restaurant",
    "email": "my-restaurant@example.com",
    "phone": "9999999999",
    "city": "Bellary",
    "password": "MyPassword123"
  }'
```


---

## STAFF ACCOUNTS

### Create Staff Account:
```bash
POST http://localhost:3000/api/v1/staff
{
  "email": "staff@restaurant.com",
  "password": "Staff123@456",
  "role": "kitchen_staff",
  "restaurantId": "<restaurant-id>"
}
```

### Staff Login:
- Email: staff@restaurant.com
- Password: Staff123@456


---

## ROLES & PERMISSIONS

### 1. OWNER (Full Admin)
- ✅ All features
- ✅ Profile management
- ✅ Staff management
- ✅ Menu management
- ✅ Order management
- ✅ Analytics
- ✅ Settings

### 2. MANAGER
- ✅ Menu management
- ✅ Analytics
- ✅ View orders
- ❌ Staff management
- ❌ Settings

### 3. KITCHEN STAFF
- ✅ View active orders
- ✅ Update order status
- ❌ Menu access
- ❌ Analytics
- ❌ Settings


---

## PASSWORD REQUIREMENTS

All passwords must have:
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter (A-Z)
- ✅ At least 1 lowercase letter (a-z)
- ✅ At least 1 number (0-9)
- ✅ Special characters optional (!, @, #, etc.)

### Valid Examples:
- Test123@456 ✅
- MyPassword1 ✅
- SecurePass99! ✅

### Invalid Examples:
- test123 ❌ (no uppercase)
- TESTING1 ❌ (no lowercase)  
- TestPass ❌ (no number)
- test ❌ (too short)


---

## TESTING CHECKLIST

- [ ] Start Backend: `npm start` (port 3000)
- [ ] Start Frontend: `npm run dev` (port 5173)
- [ ] Login with: test@example.com / Test123@456
- [ ] View Dashboard
- [ ] Check Menu Management
- [ ] Create Test Order
- [ ] View Kitchen Queue
- [ ] Check Analytics
- [ ] Run E2E Tests: `npm run test:e2e`
- [ ] Review Test Report


---

## RESET/TROUBLESHOOT

### Reset Test Database
```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Restart backend (will reload mock DB with test data)
cd backend && npm start
```

### Reset Single Account
- Delete from mock database (in-memory)
- Restart backend
- Account will be recreated

### Clear Browser Cache
```javascript
// Open browser DevTools (F12)
// In Console, run:
localStorage.clear();
sessionStorage.clear();
location.reload();
```


---

## API AUTHENTICATION

### Get Access Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123@456"
  }'

# Response:
{
  "statusCode": 200,
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Use Token in API Calls
```bash
curl -X GET http://localhost:3000/api/v1/menu \
  -H "Authorization: Bearer eyJhbGc..."
```


---

## QUICK TEST COMMANDS

```bash
# Test Login Endpoint
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123@456"}'

# Check if Backend is Running
curl http://localhost:3000/health

# Run E2E Tests
npm run test:e2e

# View Test Report
# After tests: http://localhost:9323
```


---

## BROWSER DEVELOPER TOOLS

### Check Login in Console
1. Open Browser (http://localhost:5173)
2. Press F12 (DevTools)
3. Go to Storage → LocalStorage
4. Look for auth tokens or user info

### Check API Calls
1. DevTools → Network tab
2. Perform login
3. See requests to `/api/v1/auth/login`
4. Check response payload


---

## SUPPORT

### Issues with Credentials?
1. Verify backend is running on http://localhost:3000
2. Confirm exact credentials: `test@example.com` / `Test123@456`
3. Check browser console for errors (F12)
4. Restart backend to reset mock database

### Issues with Tests?
1. Run: `npx playwright install chromium`
2. Ensure both servers running
3. Check ports: 3000 (backend), 5173 (frontend)
4. View test report at http://localhost:9323

### Still Having Issues?
1. Check logs: `backend/logs/app.log`
2. Kill all node processes: `taskkill /F /IM node.exe`
3. Restart services
4. Try in incognito browser window


---

## ONE-LINE SETUP

```bash
# Terminal 1
cd backend && npm install && npm start

# Terminal 2 (new window)
cd frontend && npm install && npm run dev

# Terminal 3 (optional - for tests)
cd frontend && npm run test:e2e

# Then open: http://localhost:5173
# Login: test@example.com / Test123@456
```

---

**Status**: Ready for Testing ✅  
**Last Updated**: 2026-02-24  
**Credentials Valid**: Immediately Active
