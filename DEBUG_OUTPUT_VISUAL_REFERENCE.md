# Debug Output Visual Reference

## How to Read Debug Output

Each section of the debug output tells you something specific about the request flow.

---

## Part 1: REQUEST DETAILS

```
[DEBUG] 1. REQUEST DETAILS:
  - Method: POST
  - URL: /api/v1/menu/bulk-upload
  - Path: /v1/menu/bulk-upload
  - IP: 127.0.0.1
```

✅ **What's good:**
- Method is `POST`
- Path ends with `/bulk-upload`
- IP is your client IP

❌ **What's bad:**
- Method is not `POST`
- Path is different
- IP is unexpected

---

## Part 2: AUTHORIZATION

### ✅ Authorization Header PRESENT and VALID

```
[DEBUG] 2. AUTHORIZATION:
  - Header present: YES
  - Token length: 489
  - Token preview: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  - Token payload:
    - userId: 550e8400-e29b-41d4-a716-446655440001
    - email: owner@test.com
    - role: admin
    - restaurantId: 550e8400-e29b-41d4-a716-446655440002
    - expiresAt: 2024-01-15T10:30:00.000Z
```

✅ **Status:** Token is properly formatted and not expired

**What to check:**
- [ ] `Header present: YES`
- [ ] Token length > 300 characters
- [ ] `role: admin` (not manager)
- [ ] `expiresAt` is future date
- [ ] `restaurantId` is present

---

### ❌ Authorization Header MISSING

```
[DEBUG] 2. AUTHORIZATION:
  - Header present: NO ❌
```

**Problem:** Token not being sent from frontend

**Fix:**
```javascript
// In frontend/src/services/api.js
// Check this exists in request interceptor:
if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}

// Or in browser console:
const token = localStorage.getItem('token');
if (!token) {
  // Re-login
  window.location.href = '/login';
}
```

---

### ❌ Authorization Header EXPIRED

```
[DEBUG] 2. AUTHORIZATION:
  - Header present: YES
  - Token length: 489
  - Token payload:
    - expiresAt: 2023-12-15T10:30:00.000Z
    - ⚠ WARNING: Token is EXPIRED
```

**Problem:** Token has expired (current time > expireAt)

**Fix:**
```javascript
// Refresh token in frontend
const response = await fetch('/api/v1/auth/refresh', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${oldToken}` }
});
const newToken = await response.json();
localStorage.setItem('token', newToken.accessToken);
```

---

### ❌ Authorization Header MALFORMED

```
[DEBUG] 2. AUTHORIZATION:
  - Header present: YES
  - Token length: 23
  - Could not decode token
```

**Problem:** Token is not valid JWT format

**Fix:**
```javascript
// Token should be: header.payload.signature (3 parts)
const token = localStorage.getItem('token');
const parts = token.split('.');
if (parts.length !== 3) {
  // Token is malformed - need to re-login
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

---

## Part 3: USER CONTEXT

### ✅ User Successfully Authenticated

```
[DEBUG] 3. USER CONTEXT (after authMiddleware):
  - User ID: 550e8400-e29b-41d4-a716-446655440001
  - Email: owner@test.com
  - Role: admin
  - Permissions: ['create_menu', 'manage_menu', 'view_orders', ...]
```

✅ **Status:** Auth middleware successfully verified token

**What to check:**
- [ ] User ID is present
- [ ] Email matches your login
- [ ] `Role: admin` (case-sensitive)
- [ ] 'create_menu' in permissions

---

### ❌ User NOT Authenticated

```
[DEBUG] 3. USER CONTEXT (after authMiddleware):
  - User: NOT SET ❌ (authMiddleware may have failed)
```

**Problem:** authMiddleware failed to verify token

**Possible causes:**
1. Token signature doesn't match SUPABASE_JWT_SECRET
2. Token was tampered with
3. Token from different authentication system
4. SUPABASE_JWT_SECRET changed

**Fix:**
```bash
# Verify SUPABASE_JWT_SECRET is correct
cat .env | grep SUPABASE_JWT_SECRET

# Re-login to get valid token
# Use correct password for login user
```

---

### ⚠ User Has Wrong Role

```
[DEBUG] 3. USER CONTEXT (after authMiddleware):
  - User ID: 550e8400-e29b-41d4-a716-446655440001
  - Email: manager@test.com
  - Role: manager
  - Permissions: ['view_orders', 'manage_orders']
```

**Problem:** Role is 'manager' not 'admin'

**What this means:**
- User cannot do `requireRole(['owner'])`
- User cannot bulk upload
- User can only view/manage orders

**Fix:**
```javascript
// Option 1: Login as admin/owner user
// Option 2: Upgrade user role in database
UPDATE restaurant_users SET role = 'admin' 
WHERE email = 'manager@test.com';
```

---

## Part 4: RESTAURANT CONTEXT

### ✅ Restaurant Identified

```
[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation):
  - Restaurant ID: 550e8400-e29b-41d4-a716-446655440002
```

✅ **Status:** Successfully extracted restaurant from token

**What to check:**
- [ ] Restaurant ID is a valid UUID or ID
- [ ] Value matches your restaurant

---

### ❌ Restaurant NOT Identified

```
[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation):
  - Restaurant ID: NOT SET ❌ (tenantIsolation may have failed)
```

**Problem:** Could not extract restaurant ID from token

**Fix:**
```javascript
// Check token includes restaurantId claim
const token = localStorage.getItem('token');
const payload = JSON.parse(
  Buffer.from(token.split('.')[1], 'base64').toString()
);
console.log('Token has restaurantId:', payload.restaurantId);

// If missing, need to re-login or check JWT creation
```

---

## Part 5: FILE INFORMATION

### ✅ File Successfully Received

```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Filename: menu.csv
  - MIME type: text/csv
  - File size: 256 bytes
  - Buffer length: 256 bytes
  - Encoding: 7bit
  - Field name: file
  - Buffer preview: name,price,category
Biryani,350,Rice Dishes
```

✅ **Status:** Multer received file correctly

**What to check:**
- [ ] `File received: YES`
- [ ] Filename matches (should be .csv or .xlsx)
- [ ] `Buffer length > 0` (not empty)
- [ ] Preview shows CSV data (name,price,category)
- [ ] `Field name: file` (not 'files' or other)

---

### ❌ File NOT Received

```
[DEBUG] 5. FILE INFORMATION:
  - File received: NO ❌ (multer may not have received file)
  - Available fields: {}
  - Available files: {}
```

**Problem:** Multer didn't receive file

**Possible causes:**
1. FormData not created correctly
2. File key is wrong (should be 'file')
3. Content-Type header interfering
4. File input has no selection
5. Multer fileFilter rejected file

**Fix:**
```javascript
// Check FormData creation
const formData = new FormData();
formData.append('file', fileInput.files[0]);  // ✓ Correct
// NOT: formData.append('files', ...)
// NOT: formData.append('upload', ...)

// Check file is selected
if (!fileInput.files[0]) {
  console.error('No file selected');
  return;
}

// Do NOT manually set Content-Type
api.post('/bulk-upload', formData, {
  // headers: { 'Content-Type': 'multipart/form-data' }  // ✗ Don't do this
})

// Let FormData handle it automatically
api.post('/bulk-upload', formData)
```

---

### ⚠ File is Empty

```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Filename: menu.csv
  - File size: 0 bytes
  - Buffer length: 0 bytes
```

**Problem:** File has no data

**Fix:**
```javascript
// Check file has content before sending
if (fileInput.files[0].size === 0) {
  console.error('File is empty');
  return;
}
```

---

### ⚠ File Format Wrong

```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Filename: menu.pdf  // ✗ Wrong extension
  - MIME type: application/pdf
```

**Problem:** Only CSV and XLSX files supported

**Fix:**
- Export file as CSV instead of PDF
- Check file extension is .csv or .xlsx
- Multer fileFilter will reject other types

---

## Part 6: MULTER STAGE

### ✅ Multer Successfully Processed

```
[DEBUG] 📁 MULTER: About to process file upload...
[DEBUG] 📁 MULTER SUCCESS:
  - fileReceived: true
  - fileName: menu.csv
  - size: 256
  - bufferLength: 256
```

✅ **Status:** File parsed and ready for processing

---

### ❌ Multer Processing Failed

```
[DEBUG] 📁 MULTER ERROR:
  - code: LIMIT_FILE_SIZE
  - message: File exceeds 5MB limit
  - isMulterError: true

[DEBUG] ⚠ File too large
```

**Problem:** File is larger than 5MB limit

**Fix:**
- Split file into smaller uploads
- Compress file before uploading
- Increase limit in backend (not recommended)

---

### ❌ Multer File Rejected

```
[DEBUG] 📁 MULTER ERROR:
  - code: UNSUPPORTED_TYPE
  - message: Only CSV and XLSX files are supported
  - isMulterError: true

[DEBUG] ⚠ Multer error: Only CSV and XLSX files are supported
```

**Problem:** File type not supported

**Fix:**
- Convert file to CSV (.csv) or Excel (.xlsx)
- Check file extension
- Don't upload as PDF, JSON, or other formats

---

## Part 7: RESPONSE STATUS

### ✅ Success Response

```
[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 250 ms
  - Response status: 200
  - ✓ SUCCESS RESPONSE
```

✅ **Status:** Bulk upload completed successfully

**What happened:**
- File was received
- Authorization passed
- File was parsed
- Items were inserted into database
- Response returned with success

---

### ✗ Error Response (401)

```
[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 50 ms
  - Response status: 401
  - ⚠ ERROR RESPONSE
  - Error message: Unauthorized: Invalid token
```

❌ **Status:** Authentication failed

**Likely cause:** Token missing or invalid

**Next action:** Check Section 2 (Authorization)

---

### ✗ Error Response (403)

```
[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 75 ms
  - Response status: 403
  - ⚠ ERROR RESPONSE
  - Error message: Only restaurant owners can bulk upload menu items
```

❌ **Status:** Permission denied

**Likely cause:** User is not owner role

**Next action:** Check Section 3 (User Context for role)

---

### ✗ Error Response (400)

```
[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 100 ms
  - Response status: 400
  - ⚠ ERROR RESPONSE
  - Error message: Menu file is required
```

❌ **Status:** Bad request

**Likely cause:** File not received or malformed

**Next action:** Check Section 5 (File Information)

---

### ✗ Error Response (500)

```
[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 150 ms
  - Response status: 500
  - ⚠ ERROR RESPONSE
  - Error message: File parsing failed: Invalid CSV format
```

❌ **Status:** Server error

**Likely cause:** File format issue or server error

**Next action:** Check backend logs for `[BULK_UPLOAD]` prefix

---

## Quick Error Translation Chart

| Response | Check This | Likely Cause |
|----------|-----------|--------------|
| 401 | Section 2 (Authorization) | Token missing or expired |
| 403 | Section 3 (User Context) | User is not owner role |
| 400 | Section 5 (File Information) | File not received or invalid |
| 500 | Backend logs | File parsing or database error |

---

## Debug Output Checklist

✅ **For successful upload, verify:**
- [ ] Section 2: `Header present: YES` and not expired
- [ ] Section 3: `Role: admin`
- [ ] Section 4: `Restaurant ID:` is set
- [ ] Section 5: `File received: YES`
- [ ] Section 5: `Buffer length: > 0`
- [ ] Section 7: `Response status: 200`

❌ **If failed, find which section has issue:**
- Section 2 failed → Authorization problem
- Section 3 failed → User authentication problem
- Section 4 failed → Restaurant identification problem
- Section 5 failed → File upload problem
- Section 7 shows 500 → Server/parsing error

---

## Using This Guide

1. Run debug test: `node backend/debug-bulk-upload.js`
2. Copy the debug output
3. Find your output in this guide
4. Check what's marked ✓ or ✗
5. Follow the "Fix" section for your issue
6. Re-run test to verify fix worked

For detailed solutions, see:
- **Quick fixes:** QUICK_DEBUG_START.md
- **Detailed troubleshooting:** BULK_UPLOAD_DEBUGGING_GUIDE.md
- **Full implementation:** DEBUG_IMPLEMENTATION_SUMMARY.md
