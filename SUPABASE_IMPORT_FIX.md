# Supabase Import Fix - Critical Production Error

## Problem Identified

**Error:** `ReferenceError: supabase is not defined` at menuController.js:232

**Root Cause:** 
The supabase.js config file exports `getSupabase()` function calls, but menuController.js was importing the default export which calls `getSupabase()` at import time. However, when modules import this, the `supabase` variable wasn't properly accessible within the function scope, causing runtime errors.

**Symptom:**
- Authorization check passed ✅
- Backend tried to fetch existing menu categories
- CRASHED: "supabase is not defined" at line 232

## Solution Applied

### Change 1: Update Import Statement
**File:** `backend/src/controllers/menuController.js` (Line 6)

**Before:**
```javascript
import supabase from '../config/supabase.js';
```

**After:**
```javascript
import { getSupabase } from '../config/supabase.js';
```

### Change 2: Update Supabase Usage Throughout Function
Changed all `await supabase.from()` calls to `await getSupabase().from()` to call the function at runtime instead of at import time.

**Locations Updated:**
1. **Line ~374** - Fetch existing categories:
```javascript
const { data: existingCategories, error: categoryFetchError } = await getSupabase()
  .from('menu_categories')
  .select('id, name')
  .eq('restaurant_id', req.restaurantId);
```

2. **Line ~418** - Create new category:
```javascript
const { data: createdCategory, error: createCategoryError } = await getSupabase()
  .from('menu_categories')
  .insert([{...}])
  .select('id, name')
  .single();
```

3. **Line ~643** - Insert bulk menu items:
```javascript
const { data, error } = await getSupabase()
  .from('menu_items')
  .insert(menuItems);
```

## Why This Works

### Before (Broken):
```
Module Load:
1. menuController.js imports supabase from supabase.js
2. supabase.js runs: export default getSupabase()
3. getSupabase() returns a client instance
4. supabase variable has the client...
5. But at runtime inside bulkUploadMenu(), supabase is undefined ❌
```

### After (Fixed):
```
Module Load:
1. menuController.js imports { getSupabase } from supabase.js
2. supabase.js exports getSupabase as a function
3. Function is stored, not called

At Runtime:
1. bulkUploadMenu() calls getSupabase()
2. Function runs, returns fresh client instance
3. Client is immediately used with .from().select()...
4. supabase is never undefined ✅
```

## Benefits of getSupabase() Pattern

1. **Lazy Initialization:** Client only created when needed
2. **Singleton Pattern:** Reuses same instance across calls (prevents multiple instances)
3. **Fresh Context:** Each call gets proper scope access
4. **Error Recovery:** Can reinitialize if needed
5. **Testing:** Easier to mock in test environment

## Testing Verification

### Expected Behavior After Fix:

**Terminal Log Output:**
```
[BULK_UPLOAD] Authorization check: { normalizedRole: 'admin' }
[REQUIRE_ROLE] ✅ ROLE ALLOWED: { normalizedRole: 'admin' }
[BULK_UPLOAD] File parsed successfully: { rowCount: 15 }
[BULK_UPLOAD] Fetching existing categories...
[BULK_UPLOAD] Categories fetched successfully: { categoryCount: 5 }
[BULK_UPLOAD] Inserting menu items...
[BULK_UPLOAD] Upload completed successfully: { inserted: 12, skipped: 3 }
```

### What Changed:
- ✅ Authorization check passes
- ✅ File parsing works
- ✅ Category fetch succeeds (NO supabase error)
- ✅ Database insert completes
- ✅ Frontend receives 200 response

### Next Steps:
1. Deploy code to production (Render)
2. Test bulk upload with CSV/XLSX file
3. Verify logs show [BULK_UPLOAD] entries with no errors
4. Confirm frontend receives success response

## Files Modified

- `backend/src/controllers/menuController.js` - Lines 6, 374, 418, 643

## Impact

- **Severity:** Critical (blocks entire bulk upload feature)
- **Scope:** Only affects bulk menu upload functionality
- **Risk:** Very Low - getSupabase() is same function, just called later
- **Performance:** Negligible impact (function call overhead is minimal)

## Related Documentation

- See `BULK_UPLOAD_500_ERROR_FIX.md` for full error diagnosis process
- See `AUTH_AND_BULK_UPLOAD_FIX.md` for complete implementation context
- See `test-bulk-upload-debug.js` for debugging tests
