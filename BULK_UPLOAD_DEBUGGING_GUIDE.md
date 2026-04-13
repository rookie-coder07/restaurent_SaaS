# Bulk Upload Debugging Guide

## Overview

The bulk upload feature has been enhanced with comprehensive debug logging to identify exactly where requests are failing when receiving 401/500 errors.

## Running Debug Tests

### Option 1: Automated Test Suite

```bash
# Install required dependencies (one-time)
npm install node-fetch form-data

# Run debug tests
node backend/debug-bulk-upload.js

# With custom credentials
TEST_EMAIL=your@email.com TEST_PASSWORD=yourpassword node backend/debug-bulk-upload.js

# With custom API base
API_BASE=http://localhost:5000/api node backend/debug-bulk-upload.js
```

**What it tests:**
1. Authentication - Login and token validation
2. Authorization header - Check if token is accepted
3. File upload - Send test CSV file
4. Request debugging - Display request structure

### Option 2: Enable Server Logs

The backend now includes comprehensive debug logging. To see it:

1. **Ensure environment is development:**
   ```bash
   NODE_ENV=development npm start
   ```

2. **Watch for [DEBUG] logs** when making bulk upload requests:
   ```
   [DEBUG] BULK UPLOAD MIDDLEWARE CHAIN
   [DEBUG] 1. REQUEST DETAILS: ...
   [DEBUG] 2. AUTHORIZATION: ...
   [DEBUG] 3. USER CONTEXT: ...
   [DEBUG] 4. RESTAURANT CONTEXT: ...
   [DEBUG] 5. FILE INFORMATION: ...
   ```

## Debug Output Interpretation

### 1. REQUEST DETAILS Section
```
[DEBUG] 1. REQUEST DETAILS:
  - Method: POST
  - URL: /api/v1/menu/bulk-upload
  - Path: /v1/menu/bulk-upload
```
**✓ Expected:** Method should be POST, path should be `/v1/menu/bulk-upload`

### 2. AUTHORIZATION Section
```
[DEBUG] 2. AUTHORIZATION:
  - Header present: YES
  - Token length: 489
  - Token preview: eyJhbGciOiJIUzI1NiIsInR5cCI6...
  - Token payload:
    - userId: abc123
    - email: owner@test.com
    - role: admin
    - restaurantId: restaurant1
    - expiresAt: 2024-01-15T10:30:00.000Z
```

**✓ Expected:**
- Header present: YES
- Token length: > 100 (usually 400-600)
- Token is not expired (expiresAt is in the future)

**✗ Problems:**
- "Header present: NO" → Token not being sent
- "Token is EXPIRED" → Need to refresh token
- Token length very small → Malformed token

### 3. USER CONTEXT Section
```
[DEBUG] 3. USER CONTEXT (after authMiddleware):
  - User ID: abc123
  - Email: owner@test.com
  - Role: admin
  - Permissions: [...]
```

**✓ Expected:**
- User ID: Should be set
- Email: Should match login email
- Role: Should be "admin" or "owner"

**✗ Problems:**
- "User: NOT SET" → authMiddleware failed
  - Check Authorization header
  - Verify token is valid JWT
  - Verify SUPABASE_JWT_SECRET matches token signature

### 4. RESTAURANT CONTEXT Section
```
[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation):
  - Restaurant ID: restaurant1
```

**✓ Expected:**
- Restaurant ID: Should be set and valid

**✗ Problems:**
- "Restaurant ID: NOT SET" → tenantIsolation middleware failed
  - Check token includes restaurantId claim
  - Verify restaurant exists in database

### 5. FILE INFORMATION Section
```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Filename: menu.csv
  - MIME type: text/csv
  - File size: 256 bytes
  - Buffer length: 256 bytes
  - Encoding: 7bit
  - Field name: file
  - Buffer preview: name,price,category...
```

**✓ Expected:**
- File received: YES
- Buffer length: > 0 (larger than 0 bytes)
- MIME type: text/csv or application/vnd.ms-excel
- Field name: file

**✗ Problems:**
- "File received: NO" → Multer did not receive the file
  - Check FormData.append('file', file)
  - Verify Content-Type header is multipart/form-data
  - Not manually setting Content-Type (let FormData set it)

## Common Error Scenarios

### Scenario 1: "401 Unauthorized"
```
[DEBUG] 2. AUTHORIZATION:
  - Header present: NO
```

**Solutions:**
1. Check localStorage has token:
   ```javascript
   // In browser console
   localStorage.getItem('token')
   localStorage.getItem('accessToken')
   ```

2. Check token is valid:
   - Should be 3 dot-separated parts (header.payload.signature)
   - Should not be expired
   - Should include restaurantId claim

3. Verify API interceptor setting header:
   - File: `frontend/src/services/api.js`
   - Check request interceptor has: `config.headers.Authorization = \`Bearer \${token}\``

### Scenario 2: "403 Forbidden"
```
[DEBUG] 3. USER CONTEXT:
  - Role: manager
```

**Solutions:**
1. Only "owner" (admin) role can bulk upload
2. Verify user is owner in database:
   ```sql
   SELECT role FROM restaurant_users WHERE email = 'your@email.com';
   ```
3. If manager, upgrade to owner role

### Scenario 3: "400 Bad Request - No file provided"
```
[DEBUG] 5. FILE INFORMATION:
  - File received: NO
```

**Solutions:**
1. Check FormData construction:
   ```javascript
   const formData = new FormData();
   formData.append('file', file);  // ✓ Correct
   ```

2. Check Content-Type header:
   ```javascript
   // ✓ Correct (FormData sets it automatically)
   api.post('/bulk-upload', formData, {
     headers: { 'Content-Type': 'multipart/form-data' }
   })

   // BUT FormData usually handles it, so sometimes don't include header
   ```

3. Check file exists:
   ```javascript
   if (!fileInput.files[0]) console.log('No file selected');
   ```

### Scenario 4: "500 Internal Server Error"
```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Buffer preview: ???
```

**Solutions:**
1. Check CSV format is valid:
   - First row should have: name, price, category
   - Data rows should have corresponding values
   - No special characters breaking parsing

2. Look for backend logs with `[BULK_UPLOAD]` prefix:
   ```
   [BULK_UPLOAD] File parsing failed: ...
   [BULK_UPLOAD] Authorization check: ...
   ```

3. Common file format issues:
   - Headers in different language
   - Extra empty rows
   - Data types incorrect (price not a number)

## Enhanced Logging in Backend

### Starting Server with Debug Logs
```bash
# Development mode (shows all logs)
NODE_ENV=development npm start

# Or with explicit debug flag
DEBUG=* npm start
```

### Key Log Prefixes
- `[DEBUG]` - Request flow debugging
- `[BULK_UPLOAD]` - Bulk upload operation details
- `[AUTH]` - Authentication/authorization
- `[MULTER]` - File upload processing

### Example Backend Log Output
```
[DEBUG] BULK UPLOAD MIDDLEWARE CHAIN
================================================================================
[DEBUG] 1. REQUEST DETAILS:
  - Method: POST
  - URL: /api/v1/menu/bulk-upload

[DEBUG] 2. AUTHORIZATION:
  - Header present: YES
  - Token length: 489

[DEBUG] 3. USER CONTEXT (after authMiddleware):
  - User ID: abc123
  - Email: owner@test.com
  - Role: admin

[DEBUG] 4. RESTAURANT CONTEXT (after tenantIsolation):
  - Restaurant ID: rest123

[DEBUG] 5. FILE INFORMATION:
  - File received: YES
  - Filename: menu.csv
  - File size: 256 bytes

[DEBUG] 📁 MULTER: About to process file upload...
[DEBUG] 📁 MULTER SUCCESS:
  - fileReceived: true
  - fileName: menu.csv
  - size: 256

[BULK_UPLOAD] Authorization check: {...}
[BULK_UPLOAD] File parsed successfully: {...}
[BULK_UPLOAD] Building header map: {...}

[DEBUG] MIDDLEWARE EXECUTION:
  - Duration: 250 ms
  - Response status: 200
  - ✓ SUCCESS RESPONSE
================================================================================
```

## Testing with cURL

For server-side testing without frontend:

```bash
# 1. Get authentication token
TOKEN=$(curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.com","password":"password123"}' \
  | jq -r '.data.accessToken')

# 2. Test bulk upload with CSV
curl -X POST http://localhost:5000/api/v1/menu/bulk-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@menu.csv"
```

## Testing with Postman

1. **Set up authentication:**
   - Login endpoint: `POST /v1/auth/login`
   - Copy `accessToken` from response
   - Set in Authorization tab → Bearer Token

2. **Configure bulk upload request:**
   - Method: POST
   - URL: `{{API_BASE}}/v1/menu/bulk-upload`
   - Body: form-data
     - Key: "file"
     - Type: File
     - Value: [select CSV file]
   - Headers:
     - Authorization: Bearer [token]

3. **Send and check:**
   - Look for debug logs in console
   - Response should show success or specific error
   - Check response details for error reason

## Troubleshooting Checklist

- [ ] Server is running: `curl http://localhost:5000/api/v1/health`
- [ ] Database is accessible: Check server logs for connection errors
- [ ] User is authenticated: Token present and not expired
- [ ] User is owner role: Check user role in database
- [ ] File is being sent: Debug logs show file received
- [ ] File is valid CSV: Check format matches schema
- [ ] SUPABASE_JWT_SECRET matches: Should match token signature
- [ ] SUPABASE_URL is set: Must be valid Supabase URL
- [ ] Environment variables loaded: Check .env file presence

## Getting Help

If debugging doesn't resolve the issue:

1. **Collect debug output:**
   ```bash
   # Run test and capture output
   node backend/debug-bulk-upload.js > debug.log 2>&1
   ```

2. **Include in bug report:**
   - Debug output from test suite
   - Backend server logs from request time
   - Frontend console logs
   - Environment variables (without secrets)
   - User role and restaurant ID

3. **Common fixes:**
   - Reset token: Re-login to get fresh token
   - Clear cache: Browser DevTools → Application → Clear cache
   - Restart server: Stop and restart backend
   - Check database: Verify user and restaurant exist
