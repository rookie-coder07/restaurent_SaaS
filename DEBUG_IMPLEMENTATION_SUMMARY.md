# Bulk Upload Debug Implementation Summary

## Overview

Complete debugging infrastructure has been added to identify why bulk upload requests are failing with 401/500 errors. The implementation includes automated testing, enhanced logging, and comprehensive troubleshooting guides.

## New Files Created

### 1. **backend/debug-bulk-upload.js** (Automated Test Suite)
**Purpose:** Automated testing of entire bulk upload flow

**Features:**
- ✅ Tests authentication (login with credentials)
- ✅ Tests authorization header handling
- ✅ Tests file upload with test CSV
- ✅ Tests request structure verification
- ✅ Token payload decoding and expiration check
- ✅ Detailed error reporting with fixes

**Usage:**
```bash
node backend/debug-bulk-upload.js
# With custom credentials:
TEST_EMAIL=owner@test.com TEST_PASSWORD=password123 node backend/debug-bulk-upload.js
```

**Output:**
- Test results for each step
- Token payload inspection
- File upload attempt with server response
- Troubleshooting guide if tests fail

### 2. **backend/src/middleware/debugBulkUpload.js** (Debug Middleware)
**Purpose:** Intercept requests and log full middleware chain execution

**Features:**
- Logs request details (method, URL, IP)
- Decodes and validates JWT token
- Displays user context after auth
- Displays restaurant context after tenant isolation
- Logs file details from multer
- Tracks response time and status

**Exported Functions:**
- `debugBulkUploadMiddleware` - Main middleware for full chain logging
- `debugAuthSteps` - Modular logging after each auth step

**Usage:**
```javascript
// In routes
import debugBulkUploadMiddleware from '../middleware/debugBulkUpload.js';
router.post('/bulk-upload', debugBulkUploadMiddleware, ...otherMiddleware, controller);
```

### 3. **BULK_UPLOAD_DEBUGGING_GUIDE.md** (Comprehensive Guide)
**Purpose:** In-depth debugging reference for all scenarios

**Sections:**
- Running automated tests
- Interpreting debug output
- Common error scenarios (401, 403, 400, 500)
- Backend middleware chain explanation
- cURL testing examples
- Postman configuration
- Database verification queries
- Troubleshooting checklist

### 4. **QUICK_DEBUG_START.md** (Quick Reference)
**Purpose:** Fast 5-minute debugging procedure

**Sections:**
- Step-by-step quick debug (2 min per step)
- Most common issues with quick fixes
- Expected debug output flow
- Custom credential testing
- Next steps

## Changes to Existing Files

### **backend/src/routes/menu.js**
- Added import for debug middleware
- Enhanced bulk-upload route with detailed logging
- Logs at multer stage
- Logs at route handler stage

**New logging at key points:**
```javascript
[DEBUG] 📁 MULTER: About to process file upload...
[DEBUG] 📁 MULTER SUCCESS/ERROR: { fileReceived, fileName, size }
```

## How Debug Output Maps to Issues

### Authorization Issues (401 Error)

**Debug output to check:**
```
[DEBUG] 2. AUTHORIZATION:
  - Header present: NO/YES
  - Token length: X
  - Token is EXPIRED: YES/NO
```

**What it tells you:**
- `Header present: NO` → Token not being sent from frontend
- `Header present: YES` → Token is sent but might be invalid
- `Token is EXPIRED: YES` → Token needs refresh
- `Token preview shows part number is invalid` → Malformed token

**Next action:** Check localStorage for valid token

### File Upload Issues (400 Error)

**Debug output to check:**
```
[DEBUG] 5. FILE INFORMATION:
  - File received: YES/NO
  - Buffer length: X bytes
  - Buffer preview: [first 100 chars]
```

**What it tells you:**
- `File received: NO` → Multer didn't get file
  - Check FormData.append('file', file)
  - Check Content-Type header
  - Check file input has selection
- `Buffer length: 0` → File is empty
- `Buffer preview: ???` → Parsing issue with file format

**Next action:** Check file upload in frontend, CSV format

### Permission Issues (403 Error)

**Debug output to check:**
```
[DEBUG] 3. USER CONTEXT:
  - Role: admin/owner/manager
  - Permissions: [arrays of perms]
```

**What it tells you:**
- `Role: manager` → Only owners can bulk upload
- `Permissions: []` → User has no permissions
- Missing 'create_menu' permission

**Next action:** Check user role in database, upgrade if needed

### Server Issues (500 Error)

**Debug output to check:**
```
[BULK_UPLOAD] Authorization check: { pass/fail info }
[BULK_UPLOAD] File parsing failed: { error details }
[BULK_UPLOAD] Building header map: { detected columns }
```

**What it tells you:**
- Location of failure in bulk upload pipeline
- Specific error message
- What stage succeeded before failure

**Next action:** Look for [BULK_UPLOAD] prefix logs for specific error

## Step-by-Step Debug Procedure

### 1. Run Automated Test Suite
```bash
# Terminal 1: Start backend
NODE_ENV=development npm start

# Terminal 2: Run tests
node backend/debug-bulk-upload.js
```

**Check results:**
- If all tests pass → Problem is environment-specific
- If auth test fails → User/token issue
- If file upload test fails → FormData/file issue

### 2. Enable Backend Logs
```bash
# Already started with NODE_ENV=development
# Watch for [DEBUG] logs in terminal
```

**Watch for these prefixes:**
- `[DEBUG]` - Request flow tracking
- `[BULK_UPLOAD]` - Operation-specific details
- `[AUTH]` - Authentication details

### 3. Manual Test from Browser
```javascript
// Paste in browser console while on app
const token = localStorage.getItem('token');
console.log('Token:', token); // Should be long string

const formData = new FormData();
formData.append('file', new File(['name,price,category\ntest,100,test'], 'test.csv'));

fetch('/api/v1/menu/bulk-upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
})
.then(r => r.json())
.then(d => console.log('Result:', d));
```

**Check:**
- Browser console shows token
- Network tab shows request sent
- Backend logs show [DEBUG] chain
- Response shows success or specific error

### 4. Interpret Results
- Match backend logs against "Expected Debug Output Flow"
- Check which step is failing
- Reference "Common Error Scenarios" section
- Apply suggested fix

## Key Debug Checkpoints

| Checkpoint | Expected Output | Problem Indicator |
|-----------|-----------------|-------------------|
| Authorization sent | `Header present: YES` | `Header present: NO` |
| Token valid | `expiresAt: ...future date...` | Token is EXPIRED |
| User authenticated | `User ID: abc123` | User: NOT SET |
| Restaurant identified | `Restaurant ID: rest123` | Restaurant ID: NOT SET |
| File received | `File received: YES` | `File received: NO` |
| File has content | `Buffer length: >0` | `Buffer length: 0` |
| File format valid | `Buffer preview: name,price...` | Invalid CSV format |
| Permissions ok | `Role: admin` | Role is manager |
| File processed | `[BULK_UPLOAD] File parsed successfully` | [BULK_UPLOAD] File parsing failed |

## Using Debug Output for Troubleshooting

### Scenario: "401 Unauthorized"

**Debug output shows:**
```
[DEBUG] 2. AUTHORIZATION:
  - Header present: NO
```

**Root cause:** Token not being sent

**Solutions in order:**
1. Check token exists: `localStorage.getItem('token')`
2. Check token not empty: Should be 400+ chars
3. Check request interceptor has: `Authorization: Bearer ${token}`
4. Check API headers being set correctly
5. Re-login to get fresh token

### Scenario: "403 Forbidden"

**Debug output shows:**
```
[DEBUG] 3. USER CONTEXT:
  - Role: manager
```

**Root cause:** User doesn't have owner role

**Solutions:**
1. Verify user is restaurant owner in database
2. Upgrade user role to owner if needed
3. Login as different user who is owner
4. Create new owner account for testing

### Scenario: "400 Bad Request - No file provided"

**Debug output shows:**
```
[DEBUG] 5. FILE INFORMATION:
  - File received: NO
```

**Root cause:** File not reaching backend

**Solutions:**
1. Check FormData: `formData.append('file', file)`
2. Check file is selected: `fileInput.files[0]`
3. Check Content-Type NOT manually set
4. Check request in Network tab shows FormData

### Scenario: "500 Internal Server Error"

**Debug output shows:**
```
[BULK_UPLOAD] File parsing failed: Expecting header containing 'name'
```

**Root cause:** CSV format invalid

**Solutions:**
1. Check CSV has header row: `name,price,category`
2. Check no empty rows before data
3. Check data types match (price is number)
4. Validate with: `node backend/debug-bulk-upload.js`

## Performance Impact

Debug middleware adds:
- ~1-2ms per request (minimal)
- Logging overhead only in development mode
- No impact to production (disabled with NODE_ENV=production)

## Disabling Debug Logging

For production or when debug is no longer needed:

```bash
# Option 1: Environment variable
NODE_ENV=production npm start

# Option 2: Comment out in routes/menu.js
// import debugBulkUploadMiddleware from '../middleware/debugBulkUpload.js';
// router.post('/bulk-upload', debugBulkUploadMiddleware, ...)
```

## Files That Were Enhanced

### Modified Files:
1. `backend/src/routes/menu.js`
   - Added debug middleware import
   - Enhanced bulk-upload route
   - Added multer stage logging

### New Files:
1. `backend/debug-bulk-upload.js` - Test suite
2. `backend/src/middleware/debugBulkUpload.js` - Debug middleware
3. `BULK_UPLOAD_DEBUGGING_GUIDE.md` - Detailed guide
4. `QUICK_DEBUG_START.md` - Quick reference
5. This file - Implementation summary

## Recommended Next Steps

1. **Immediate (Now):**
   - Run `node backend/debug-bulk-upload.js`
   - Watch backend logs with `NODE_ENV=development npm start`
   - Note which step fails

2. **Based on Output:**
   - Check auth section → Look at token
   - Check file section → Look at FormData
   - Check error message → Search in guide

3. **After Fix:**
   - Verify all tests pass
   - Remove debug middleware if needed
   - Deploy to production

## Testing Checklist

- [ ] Can run debug test suite: `node backend/debug-bulk-upload.js`
- [ ] Backend logs show [DEBUG] output
- [ ] Authorization section shows token
- [ ] User context shows correct role
- [ ] File information shows file received
- [ ] Response shows success (200) or specific error
- [ ] All tests pass or specific failure identified
- [ ] Applied suggested fix
- [ ] Re-tested and confirmed working

## Debugging Commands Quick Reference

```bash
# Run automated tests
node backend/debug-bulk-upload.js

# Run with custom email/password
TEST_EMAIL=user@example.com TEST_PASSWORD=pass node backend/debug-bulk-upload.js

# Start backend with debug logs
NODE_ENV=development npm start

# Enable all debug logs
DEBUG=* npm start

# Run tests and save output
node backend/debug-bulk-upload.js > debug-output.txt 2>&1

# Search backend logs for bulk upload operations
grep "\[BULK_UPLOAD\]" backend.log
grep "\[DEBUG\]" backend.log
```

## Support

For issues not covered by debugging:

1. **Collect debug output:**
   - `node backend/debug-bulk-upload.js > debug.log 2>&1`
   - Backend logs from request time
   - Browser console logs

2. **Include in bug report:**
   - Debug output
   - Backend logs (with [BULK_UPLOAD] prefix)
   - Frontend logs
   - Environment setup

3. **Reference documents:**
   - `BULK_UPLOAD_DEBUGGING_GUIDE.md` - Detailed troubleshooting
   - `QUICK_DEBUG_START.md` - Quick reference
   - Previous: `COMPLETE_ACTIVITY_LOGGING_PACKAGE.md` - Context
