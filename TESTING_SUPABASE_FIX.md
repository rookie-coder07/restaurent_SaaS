# Testing the Supabase Import Fix

## Quick Test Steps

### 1. Verify Code is Deployed
```bash
# Check that menuController.js has the new import
grep "getSupabase" backend/src/controllers/menuController.js

# Should output 4 lines:
# - 1 import line
# - 3 usage lines
```

### 2. Manual Testing - Bulk Upload

**Prerequisites:**
- Backend running
- Authenticated user with admin/owner role
- CSV or XLSX file ready

**Test Steps:**
1. Login to application as restaurant owner
2. Navigate to Menu Management
3. Click "Bulk Upload" button
4. Select CSV file with menu items:
   ```csv
   name,price,category
   Biryani,350,Rice Dishes
   Samosa,20,Appetizers
   Chai,50,Beverages
   ```
5. Click Upload
6. Verify result:
   - ✅ File processes successfully
   - ✅ Categories are created/fetched
   - ✅ Items inserted into database
   - ✅ Frontend shows "Successfully uploaded X items" message

### 3. Backend Log Verification

**Expected Log Output:**
```
[BULK_UPLOAD] Authorization check: { normalizedRole: 'admin' }
[REQUIRE_ROLE] ✅ ROLE ALLOWED: { normalizedRole: 'admin' }
[BULK_UPLOAD] File parsed successfully: { rowCount: 3 }
[BULK_UPLOAD] Building header map...
[BULK_UPLOAD] Header map built successfully...
[BULK_UPLOAD] Fetching existing categories...
[BULK_UPLOAD] Categories fetched successfully: { categoryCount: 2 }
[BULK_UPLOAD] Inserting menu items to database: { count: 3 }
[BULK_UPLOAD] Menu items inserted successfully: { count: 3 }
[BULK_UPLOAD] Upload completed successfully: { total: 3, inserted: 3, skipped: 0 }
```

**Do NOT see:**
- ❌ "ReferenceError: supabase is not defined"
- ❌ "Cannot read property 'from' of undefined"
- ❌ Any supabase null/undefined errors

### 4. Error Case Testing

**Test Non-Admin User:**
- Login as staff/manager user
- Attempt bulk upload
- Verify error: "Only restaurant owners can bulk upload menu items" (403)

**Test Large File:**
- Create file with 1000+ rows
- Upload should still work (or fail gracefully with size error)
- Check [BULK_UPLOAD] logs for processing

**Test Invalid CSV:**
- Create CSV with missing price column
- Upload should process but skip rows with errors
- Frontend shows error details

### 5. Automated Testing

```bash
# Run test suite
node test-bulk-upload-debug.js

# Expected output:
# ✅ Test 1: Auth check passed
# ✅ Test 2: File parsing succeeded
# ✅ Test 3: Categories fetched
# ✅ Test 4: Items inserted
# ✅ All tests passed
```

## What Should Now Work

✅ **Before this fix, failed at:**
- Authorization check PASSED
- Category fetch FAILED → "supabase is not defined"

✅ **After this fix, continues to:**
- Authorization check PASSED ✅
- File parsing PASSED ✅
- Category fetch PASSED ✅ (was broken)
- Items insertion PASSED ✅
- Response sent to frontend ✅

## Rollback Plan (if needed)

If this fix causes issues, rollback to:
```javascript
// Change back to:
import supabase from '../config/supabase.js';

// And revert getSupabase() calls back to supabase:
const { data, error } = await supabase.from('menu_items').insert(menuItems);
```

But this should not be necessary - the fix is low-risk.

## Success Criteria

- [ ] No "supabase is not defined" errors in production logs
- [ ] Bulk uploads complete successfully
- [ ] [BULK_UPLOAD] logs show all stages passing
- [ ] Frontend receives 200 response with inserted count
- [ ] Menu items appear in database after upload
- [ ] Categories are properly created/linked
