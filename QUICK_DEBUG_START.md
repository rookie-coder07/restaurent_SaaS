# Quick Debug Start Guide

## 5-Minute Debugging for Bulk Upload Issues

### Step 1: Run Automated Tests (2 mins)

```bash
cd backend
node debug-bulk-upload.js
```

**Watch for these outputs:**

✅ **SUCCESS:**
```
✓ Authentication
✓ Authorization Header
✓ File Upload
✓ Request Debugging
TEST SUMMARY - All tests passed
```

❌ **FAILURE - Example output:**
```
✗ Authentication failed - cannot proceed
❌ AUTHENTICATION FAILED:
  1. Check if API is running
  2. Verify TEST_EMAIL and TEST_PASSWORD environment variables
  3. Run: npm test or npm run test:api
```

### Step 2: Check Authorization (1 min)

If test gets 401 error:

```bash
# Check token in browser console
localStorage.getItem('token')

# Should show: eyJhbGciOiJIUzI1NiIs...
# If empty → User not logged in
```

### Step 3: Enable Backend Logs (1 min)

In another terminal:
```bash
# Start backend with debug logs
NODE_ENV=development npm start
```

### Step 4: Make Test Request (1 min)

From browser:
```javascript
// Paste in browser console (on your app page)
const token = localStorage.getItem('token');

const formData = new FormData();
formData.append('file', new File(['name,price,category\ntest,100,test'], 'test.csv'));

fetch('/api/v1/menu/bulk-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e));
```

Watch backend logs and look for:
- `[DEBUG] BULK UPLOAD MIDDLEWARE CHAIN` → Request entered
- `[DEBUG] 2. AUTHORIZATION: Header present: YES` → Token sent
- `[DEBUG] 3. USER CONTEXT` → User authenticated
- `[DEBUG] 5. FILE INFORMATION: File received: YES` → File received

## Most Common Issues & Quick Fixes

### Issue 1: 401 Unauthorized

```
[DEBUG] 2. AUTHORIZATION:
  - Header present: NO ❌
```

**Fix:**
```javascript
// In browser console
localStorage.setItem('token', 'your-token-here');

// OR re-login
fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'owner@test.com',
    password: 'password123'
  })
})
```

### Issue 2: 403 Forbidden

```
[DEBUG] 3. USER CONTEXT:
  - Role: manager ❌
```

**Fix:**
- Only "owner" role can bulk upload
- User needs to be restaurant owner, not manager

### Issue 3: 400 File Not Received

```
[DEBUG] 5. FILE INFORMATION:
  - File received: NO ❌
```

**Fix:**
- Check FormData has file:
  ```javascript
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  // ✓ Correct key name must be 'file'
  ```

- Don't manually set multipart header:
  ```javascript
  // ✗ Wrong - removes FormData headers
  api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

  // ✓ Correct - let FormData set headers
  fetch(url, {
    method: 'POST',
    body: formData
  })
  ```

### Issue 4: 500 Server Error

Look at backend logs for `[BULK_UPLOAD]` errors:

```
[BULK_UPLOAD] File parsing failed: ...
```

**Check CSV format:**
- First row: `name,price,category`
- Data rows: `Biryani,350,Rice Dishes`
- No empty rows at top or middle
- Price must be a number

## Files Modified for Debugging

| File | Purpose | Location |
|------|---------|----------|
| `debug-bulk-upload.js` | Automated test suite | `backend/` |
| `debugBulkUpload.js` | Debug middleware | `backend/src/middleware/` |
| `menu.js` | Routes with debug logging | `backend/src/routes/` |
| `BULK_UPLOAD_DEBUGGING_GUIDE.md` | Detailed guide | Root |

## Expected Debug Output Flow

### ✓ Successful Upload
```
[DEBUG] BULK UPLOAD MIDDLEWARE CHAIN
[DEBUG] 1. REQUEST DETAILS: ✓
[DEBUG] 2. AUTHORIZATION: Header present: YES ✓
[DEBUG] 3. USER CONTEXT (after authMiddleware): ✓
[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation): ✓
[DEBUG] 5. FILE INFORMATION: File received: YES ✓
[DEBUG] 📁 MULTER: About to process file upload...
[DEBUG] 📁 MULTER SUCCESS: fileReceived: true ✓
[BULK_UPLOAD] Authorization check: ✓
[BULK_UPLOAD] File parsed successfully ✓
[BULK_UPLOAD] 5 items validated ✓
[BULK_UPLOAD] Insert successful ✓
[DEBUG] MIDDLEWARE EXECUTION: Response status: 200 ✓
```

### ✗ Authorization Failure
```
[DEBUG] BULK UPLOAD MIDDLEWARE CHAIN
[DEBUG] 1. REQUEST DETAILS: ✓
[DEBUG] 2. AUTHORIZATION: Header present: NO ❌
[DEBUG] MIDDLEWARE EXECUTION: Response status: 401 ERROR
```

## Running Tests with Custom Credentials

```bash
# Using environment variables
TEST_EMAIL=myemail@test.com TEST_PASSWORD=mypass node backend/debug-bulk-upload.js

# Using different API base
API_BASE=http://production.com/api node backend/debug-bulk-upload.js

# Combined
API_BASE=http://localhost:3000/api TEST_EMAIL=operator@test.com node backend/debug-bulk-upload.js
```

## Next Steps

1. ✅ Run debug test: `node backend/debug-bulk-upload.js`
2. ✅ Check which test fails
3. ✅ Reference troubleshooting section above
4. ✅ If still stuck, enable backend logs and test manually
5. ✅ Check `BULK_UPLOAD_DEBUGGING_GUIDE.md` for detailed help

## Need More Help?

See [BULK_UPLOAD_DEBUGGING_GUIDE.md](./BULK_UPLOAD_DEBUGGING_GUIDE.md) for:
- Detailed debug output interpretation
- Common error scenarios with solutions
- Testing with cURL and Postman
- Database verification queries
- Complete troubleshooting checklist
