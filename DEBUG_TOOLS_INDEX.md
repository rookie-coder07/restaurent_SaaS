# Bulk Upload Debugging Tools - Complete Index

## 🎯 Quick Start

**You have 401/500 errors on bulk upload?**

Follow this 5-minute process:

1. **Terminal 1: Start backend with debug logs**
   ```bash
   cd backend
   NODE_ENV=development npm start
   ```

2. **Terminal 2: Run automated tests**
   ```bash
   cd backend
   node debug-bulk-upload.js
   ```

3. **Watch output and find your issue** in the visual reference
4. **Apply the fix** suggested for your error type
5. **Test again** to confirm it works

---

## 📚 Documentation Files

### For Quick Fixes (You're in a hurry)
- **[QUICK_DEBUG_START.md](./QUICK_DEBUG_START.md)** ⚡
  - 5-minute debugging procedure
  - Most common issues with fixes
  - Terminal commands to run

### For Understanding Debug Output
- **[DEBUG_OUTPUT_VISUAL_REFERENCE.md](./DEBUG_OUTPUT_VISUAL_REFERENCE.md)** 👀
  - Visual examples of debug output
  - What each section means
  - How to interpret ✓ and ✗ indicators
  - Quick error translation chart

### For Detailed Troubleshooting
- **[BULK_UPLOAD_DEBUGGING_GUIDE.md](./BULK_UPLOAD_DEBUGGING_GUIDE.md)** 🔍
  - Complete debugging reference
  - All error scenarios with solutions
  - Database queries for verification
  - cURL and Postman examples
  - Full troubleshooting checklist

### For Understanding Implementation
- **[DEBUG_IMPLEMENTATION_SUMMARY.md](./DEBUG_IMPLEMENTATION_SUMMARY.md)** 🛠️
  - What files were created
  - What was modified
  - How debug logging works
  - Step-by-step debug procedure
  - Performance impact

---

## 🛠️ Tools & Files Created

### 1. Automated Test Suite
**File:** `backend/debug-bulk-upload.js`

**Purpose:** Test entire bulk upload flow automatically

**To run:**
```bash
cd backend
node debug-bulk-upload.js

# With custom credentials:
TEST_EMAIL=owner@test.com TEST_PASSWORD=password node debug-bulk-upload.js
```

**What it tests:**
- ✓ Authentication (can you login?)
- ✓ Authorization header (is token being sent?)
- ✓ File upload (can server receive file?)
- ✓ Request structure (proper format?)

**Output includes:**
- Test results (pass/fail for each step)
- Token payload inspection
- Error messages with fixes
- Troubleshooting guide

### 2. Debug Middleware
**File:** `backend/src/middleware/debugBulkUpload.js`

**Purpose:** Log every step of the middleware chain

**What it logs:**
- Request details (method, URL, IP)
- Authorization header (present? valid? expired?)
- User context (authenticated? correct role?)
- Restaurant context (identified correctly?)
- File information (received? how large? format?)
- Response status (success? error code?)
- Execution time (how long did it take?)

**Provides:**
- Token payload decoding
- JWT expiration check
- Decoded permissions
- File buffer preview

---

## 📋 Error Resolution Guide

### If Getting 401 Unauthorized

**Most likely cause:** Token not being sent or expired

**Check these in order:**
1. Browser console: `localStorage.getItem('token')`
   - If empty → Need to login
   - If expired → Need to refresh

2. Backend logs: Should show `[DEBUG] 2. AUTHORIZATION: Header present: YES`
   - If NO → Check API interceptor setting header

3. Run test: `node backend/debug-bulk-upload.js`
   - Check "Token payload" section
   - Look for "expiresAt" in future

**Quick fix:**
```javascript
// In browser console
localStorage.removeItem('token');
// Then reload page and login again
```

---

### If Getting 403 Forbidden

**Most likely cause:** User is not owner role

**Check these:**
1. Backend logs: Should show `[DEBUG] 3. USER CONTEXT: Role: admin`
   - If `Role: manager` → Only owners can upload

2. Database check:
   ```sql
   SELECT email, role FROM restaurant_users 
   WHERE email = 'your@email.com';
   ```

**Quick fix:**
- Login as owner user (admin role)
- Or upgrade user in database:
  ```sql
  UPDATE restaurant_users SET role = 'admin' 
  WHERE email = 'your@email.com';
  ```

---

### If Getting 400 Bad Request

**Most likely cause:** File not being received

**Check these:**
1. Backend logs: Should show `[DEBUG] 5. FILE INFORMATION: File received: YES`
   - If NO → FormData not set up correctly

2. Browser Network tab:
   - POST request to `/api/v1/menu/bulk-upload`
   - Should show form-data in Request payload
   - Should have "file: (binary)" entry

3. Frontend code:
   ```javascript
   // ✓ Correct
   const formData = new FormData();
   formData.append('file', fileInput.files[0]);
   api.post('/bulk-upload', formData);

   // ✗ Wrong
   api.post('/bulk-upload', formData, {
     headers: { 'Content-Type': 'multipart/form-data' }
   });
   ```

**Quick fix:**
- Don't manually set Content-Type
- Ensure file is selected: `fileInput.files[0]`
- Check field name is exactly "file"

---

### If Getting 500 Internal Server Error

**Most likely cause:** File format invalid or database error

**Check these:**
1. Backend logs: Look for `[BULK_UPLOAD]` prefix
   - Will show exact error location
   - Check CSV format

2. Expected CSV format:
   ```csv
   name,price,category
   Biryani,350,Rice Dishes
   Samosa,20,Appetizers
   ```

3. Common issues:
   - Missing header row
   - Empty rows at top
   - Price not a number
   - Extra columns causing issues

**Quick fix:**
- Verify CSV has: name, price, category columns
- No empty rows before data
- Price is numeric value
- See DEBUG_OUTPUT_VISUAL_REFERENCE.md Section 5

---

## 🔍 How to Debug Step by Step

### Step 1: Identify Error Type
```
401 → Token/Auth issue
403 → Permission issue  
400 → File not received
500 → File format or database issue
```

### Step 2: Run Automated Test
```bash
node backend/debug-bulk-upload.js
```
This tells you WHAT is failing.

### Step 3: Check Visual Reference
Open [DEBUG_OUTPUT_VISUAL_REFERENCE.md](./DEBUG_OUTPUT_VISUAL_REFERENCE.md)
and find your error section.

### Step 4: Enable Backend Logs
```bash
NODE_ENV=development npm start
```
This tells you WHERE it's failing.

### Step 5: Read Error Message
Both test output and backend logs show specific error.

### Step 6: Apply Fix
Use the fix suggested in visual reference or quick start guide.

### Step 7: Test Again
Run test again to confirm fixed.

---

## 📊 Debug Output Sections

Each section of debug output maps to a part of the system:

| Section | What it checks | Error codes | Fix location |
|---------|---------------|------------|--------------|
| 1. REQUEST DETAILS | Request arrives | - | Network setup |
| 2. AUTHORIZATION | Token sent & valid | 401 | Auth/token |
| 3. USER CONTEXT | User authenticated | 401, 403 | Login/permissions |
| 4. RESTAURANT CONTEXT | Restaurant identified | 403 | Tenant isolation |
| 5. FILE INFORMATION | File received | 400 | FormData setup |
| 6. MULTER | File processed | 400, 413 | File format |
| 7. RESPONSE | Final result | 200, 4xx, 500 | Overall status |

---

## 🚀 Files Modified

### New Files Created:
1. `backend/debug-bulk-upload.js` - Automated test suite
2. `backend/src/middleware/debugBulkUpload.js` - Debug middleware
3. `QUICK_DEBUG_START.md` - Quick reference guide
4. `DEBUG_OUTPUT_VISUAL_REFERENCE.md` - Visual reference
5. `BULK_UPLOAD_DEBUGGING_GUIDE.md` - Detailed guide
6. `DEBUG_IMPLEMENTATION_SUMMARY.md` - Implementation details
7. This file - Index and guide

### Files Modified:
1. `backend/src/routes/menu.js` - Added debug middleware

**No breaking changes** - All modifications are additive logging only.

---

## ✅ Verification Checklist

After completing debugging:

- [ ] Run `node backend/debug-bulk-upload.js` - All tests pass
- [ ] Check backend logs - No [ERROR] prefixed lines
- [ ] Make test upload from UI - Succeeds without error
- [ ] Verify file processed - Appears in menu items
- [ ] Check response - Shows success status 200

---

## 📞 Getting Help

### If test fails with specific error:
1. Check [DEBUG_OUTPUT_VISUAL_REFERENCE.md](./DEBUG_OUTPUT_VISUAL_REFERENCE.md)
2. Find the section matching your error
3. Read the "Fix" suggestion

### If still not working:
1. Collect debug output:
   ```bash
   node backend/debug-bulk-upload.js > debug.log 2>&1
   ```
2. Check backend logs during request:
   ```bash
   NODE_ENV=development npm start | grep "\[DEBUG\]\|\[BULK_UPLOAD\]"
   ```
3. Review [BULK_UPLOAD_DEBUGGING_GUIDE.md](./BULK_UPLOAD_DEBUGGING_GUIDE.md)
4. Search for your specific error message

### Common questions:

**Q: How do I enable debug logging?**
A: Run backend with `NODE_ENV=development npm start`

**Q: How do I run the automated tests?**
A: `cd backend && node debug-bulk-upload.js`

**Q: Can I use custom login credentials?**
A: Yes: `TEST_EMAIL=user@example.com TEST_PASSWORD=pass node debug-bulk-upload.js`

**Q: Will debug logging slow down my app?**
A: No, it's only enabled with `NODE_ENV=development`

**Q: How do I disable debug logging for production?**
A: Run with `NODE_ENV=production npm start` or remove debug middleware from routes

---

## 📖 Document Reading Order

1. **First:** [QUICK_DEBUG_START.md](./QUICK_DEBUG_START.md)
   - Gets you unstuck fast

2. **Then:** [DEBUG_OUTPUT_VISUAL_REFERENCE.md](./DEBUG_OUTPUT_VISUAL_REFERENCE.md)
   - Shows what your output means

3. **If needed:** [BULK_UPLOAD_DEBUGGING_GUIDE.md](./BULK_UPLOAD_DEBUGGING_GUIDE.md)
   - Deep dive into specific scenarios

4. **For context:** [DEBUG_IMPLEMENTATION_SUMMARY.md](./DEBUG_IMPLEMENTATION_SUMMARY.md)
   - Understand what was added and why

---

## 🎓 Learning the Debug Flow

**Complete debugging flow (for your understanding):**

```
Request comes in
    ↓
[DEBUG] 1. REQUEST DETAILS logged
    ↓
Authorization header checked
[DEBUG] 2. AUTHORIZATION logged
    ↓
authMiddleware verifies token ← if fails → 401 error
    ↓
[DEBUG] 3. USER CONTEXT logged
    ↓
tenantIsolation extracts restaurant ← if fails → 403 error
    ↓
[DEBUG] 4. RESTAURANT CONTEXT logged
    ↓
requireRole(['owner']) checks role ← if fails → 403 error
    ↓
checkPermission(['create_menu']) checks perms ← if fails → 403 error
    ↓
Multer processes file ← if fails → 400 error
    ↓
[DEBUG] 5. FILE INFORMATION logged
    ↓
[DEBUG] 6. MULTER section logged
    ↓
bulkUploadMenu controller runs
    ↓
Parsing and database operations
    ↓
Response sent
    ↓
[DEBUG] 7. RESPONSE STATUS logged
```

---

## 🔄 Troubleshooting Workflow

```
1. Get error on bulk upload
         ↓
2. Note error code (401, 403, 400, 500)
         ↓
3. Run: node backend/debug-bulk-upload.js
         ↓
4. Read output, find which section fails
         ↓
5. Open DEBUG_OUTPUT_VISUAL_REFERENCE.md
         ↓
6. Find that section, read Fix
         ↓
7. Apply fix (usually localStorage, FormData, or role)
         ↓
8. Run test again
         ↓
9. All pass? ✓ You're done!
   Still failing? → Try next fix in that section
```

---

## 📌 Summary

**You now have:**
- ✅ Automated test suite (`debug-bulk-upload.js`)
- ✅ Debug middleware (logs everything)
- ✅ 4 comprehensive guides
- ✅ Visual reference for all errors
- ✅ Quick start for in-a-hurry fixes

**To get started:**
```bash
NODE_ENV=development npm start          # Terminal 1: backend with logs
cd backend && node debug-bulk-upload.js # Terminal 2: run tests
```

**Then read** [DEBUG_OUTPUT_VISUAL_REFERENCE.md](./DEBUG_OUTPUT_VISUAL_REFERENCE.md) to interpret results.

---

Last updated: 2024
Part of bulk upload debugging enhancement project
