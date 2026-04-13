# 🧪 Bulk Upload Debug & Error Diagnosis Guide

## Quick Start: How to Debug 500 Errors

### Step 1: Check Frontend Console
Open browser DevTools (F12) → Console tab

**You'll now see detailed error messages:**
```
[BULK_UPLOAD] Full Error Details: {
  status: 500,
  statusText: 'Internal Server Error',
  message: 'Actual backend error message here',
  backendError: {...},
  fullResponse: {...}
}
```

### Step 2: Check Backend Logs
```bash
cd backend
node server.js    # Watch console for [BULK_UPLOAD] logs
```

**Backend logs show:**
- ✅ File received and validated
- ✅ File parsed successfully
- ✅ Row-by-row processing status
- ✅ Category resolution
- ✅ Database insert results
- ❌ Exact failure point if error occurs

### Step 3: Test with Debug Script
```bash
cd backend
node test-bulk-upload.js
```

This will:
- Login automatically
- Upload test files
- Show exact error messages
- Compare with expected results

---

## What Gets Logged at Each Step

### STEP 1: FILE VALIDATION
```
[BULK_UPLOAD] File validation starting
  - hasFile: true/false
  - fileName: 'test.csv'
  - fileSize: 1024
  - bufferLength: 1024
```

**Problem Signs:**
- ❌ `hasFile: false` → File not received
- ❌ `bufferLength: 0` → Empty file
- ❌ `mimeType: 'text/plain'` → Wrong format

---

### STEP 2: FILE PARSING
```
[BULK_UPLOAD] File parsed - Row details
  - totalRows: 5
  - isArray: true
  - firstRowKeys: ['name', 'price', 'category']
  - firstRowSample: {name: 'Donut', price: '2.99', ...}
```

**Problem Signs:**
- ❌ `isArray: false` → Parser returned wrong type
- ❌ `totalRows: 0` → No rows parsed
- ❌ Missing keys → Column headers not detected

---

### STEP 3: ROW PROCESSING
```
[BULK_UPLOAD] Processing row
  - rowNumber: 1
  - rawRowKeys: ['name', 'price', 'category']
  - name: 'Donut'
  - category: 'Breakfast'
  - price: '2.99'
```

For each row:
- ✅ Column normalization
- ✅ Field extraction
- ✅ Validation
- ✅ Category resolution

**Problem Signs:**
- ❌ `name: ''` → Missing name
- ❌ `category: null` → Category not found
- ❌ `price: NaN` → Invalid price format

---

### STEP 4: CATEGORY RESOLUTION
```
[BULK_UPLOAD] Resolving category
  - category: 'Breakfast'
  
[BULK_UPLOAD] ✅ Category resolved
  - categoryId: 123
```

OR if creation needed:
```
[BULK_UPLOAD] Creating new category (not found)
  - categoryName: 'Lunch'
  
[BULK_UPLOAD] Category created successfully
  - categoryId: 456
```

**Problem Signs:**
- ❌ `categoryId: null` → Could not find or create
- ❌ Error code 23505 → Unique constraint violation

---

### STEP 5: VALIDATION & FILTERING
```
[BULK_UPLOAD] Pre-insert validation starting
  - count: 5
  
[BULK_UPLOAD] Pre-insert validation complete
  - total: 5
  - valid: 5
  - invalid: 0
```

**Problem Signs:**
- ❌ `invalid: 2` → Some rows missing required fields
- ❌ `valid: 0` → All rows invalid

---

### STEP 6: DATABASE INSERT
```
[BULK_UPLOAD] Attempting database insert
  - count: 5
  
[BULK_UPLOAD] ✅ Database insert successful
  - count: 5
  - firstInsertedId: 'uuid-123'
  - totalInsertedIds: 5
```

**Problem Signs:**
- ❌ `[BULK_UPLOAD] ❌ DATABASE INSERT FAILED` → DB error
- ❌ Error code 23503 → Foreign key not found
- ❌ Error code 23505 → Duplicate entry

---

### STEP 7: RESPONSE
```
[BULK_UPLOAD] ✅ UPLOAD COMPLETED SUCCESSFULLY
  - total: 5
  - inserted: 5
  - skipped: 0
```

---

## Common Errors & Fixes

### Error: "Cannot read properties"
**Cause:** File parsing failed  
**Fix:** Ensure file is valid CSV or XLSX format

### Error: "Foreign key constraint (23503)"
**Cause:** Category ID doesn't exist  
**Fix:** Check category resolution logs - category may not have been created

### Error: "Duplicate key (23505)"
**Cause:** Item already exists in database  
**Fix:** Check if you're uploading duplicates, or delete old items first

### Error: "Column not found"
**Cause:** CSV headers don't match expected names  
**Fix:** Check CSV headers match: name, price, category, etc.

### Error: "Invalid price"
**Cause:** Price field not a valid number  
**Fix:** Ensure price column contains numbers only

### Error: "Missing category"
**Cause:** Category column is empty  
**Fix:** Fill category column for all rows

---

## Debug Script Output Example

```bash
node test-bulk-upload.js

╔══════════════════════════════════════╗
║  🧪 BULK UPLOAD TEST                 ║
╚══════════════════════════════════════╝

📝 Step 1: LOGIN AS MANAGER
✅ Login successful
   📛 Email: test@example.com
   🏪 Restaurant ID: 515cfff9-...
   🔑 Token: eyJhbGciOiJS...[REDACTED]

🧪 Testing: Duplicate Categories
────────────────────────────────
📋 Tests: "Appetizers" vs "appetizers"
📂 Reading file: test-duplicate-categories.csv
📤 Sending bulk upload request...

✅ UPLOAD SUCCESSFUL
────────────────────────────────
📊 Results:
   ✅ Created: 5
   🔄 Updated: 0
   📈 Total: 5
   ⚠️  Errors: 0

0/3 tests passed
```

---

## Enabling Debug Logs

### 1. **Frontend Console**
Open browser → F12 → Console
- Shows real-time error responses
- Displays `error.response.data` with backend details

### 2. **Backend Terminal**
```bash
cd backend
node server.js
```
Watch for `[BULK_UPLOAD]` prefixed logs

### 3. **Backend Log Files**
Check `backend/logs/` directory for persistent logs

### 4. **Supabase Logs** (if needed)
Supabase dashboard → Projects → Logs
- Shows database errors
- Displays constraint violations

---

## Step-by-Step Debugging Workflow

### Problem: Getting 500 error on upload

```
1. Check Browser Console
   └─ Copy error.response.data.message
   
2. Search Backend Terminal
   └─ Search for that exact message in logs
   
3. Look for ❌ markers in logs
   └─ Find which step failed
   
4. Review that section's logs
   └─ See what data caused it
   
5. Fix the issue
   └─ Adjust CSV or configuration
   
6. Re-test with test-bulk-upload.js
   └─ Verify fix works
```

### Example Debugging Session

```
Frontend shows: "Internal Server Error"

Browser Console:
  message: "Cannot find property 'name' of undefined"

Backend logs show:
  [BULK_UPLOAD] ❌ FILE PARSING FAILED
  [BULK_UPLOAD] Error:...

Fix: CSV file has no headers
Re-test: Add headers → Works ✅
```

---

## Testing Different Scenarios

### Test 1: Valid Data
```bash
# Should succeed with 0 errors
node test-bulk-upload.js
```

### Test 2: Duplicate Categories
```bash
# Should detect duplicates and map correctly
node test-category-deduplication-unit.js
```

### Test 3: Case-Insensitive Matching
```bash
# Should work with "Appetizers", "appetizers", "APPETIZERS"
node test-category-resolution-integration.js
```

### Test 4: Invalid Data
Create CSV with:
- Missing prices
- Invalid categories
- Negative prices
- Too-long names

Expected: All invalid rows reported as errors

### Test 5: Large File
Create CSV with 1000+ rows
Expected: Should process all rows successfully

---

## Checklist for Debugging

- [ ] Check browser console for error details
- [ ] Search backend logs for ❌ markers
- [ ] Look at step where error occurred
- [ ] Check what data was being processed
- [ ] Fix CSV or configuration
- [ ] Re-test with debug script
- [ ] Verify success response

---

## Getting More Verbose Logs

If standard logs aren't enough, add this to backend code:

```javascript
// Before the problematic line
console.log('[VERBOSE] Variable:', {
  name: row.name,
  type: typeof row.name,
  value: JSON.stringify(row),
  keys: Object.keys(row),
});
```

Then check terminal output for detailed variable state.

---

## Environment Variables for Testing

```bash
# Use different API endpoints
API_URL=http://localhost:3000/api/v1 node test-bulk-upload.js

# Use different credentials
TEST_EMAIL=owner@test.com TEST_PASSWORD=test123 node test-bulk-upload.js

# Redirect logs to file
node server.js > backend.log 2>&1
```

---

## Support Resources

| Issue | Check | Step |
|-------|-------|------|
| File not received | req.file exists? | #1 |
| File not parsed | parsedRows array? | #2 |
| Rows have errors | Each row logs? | #3 |
| Category missing | Category resolution logs? | #4 |
| Validation fails | Pre-insert validation? | #5 |
| Insert fails | Database error message? | #6 |
| Response wrong | Success vs error? | #7 |

---

## Next Steps

1. **Enable detailed logging** - Done ✅
2. **Run test script** - `node test-bulk-upload.js`
3. **Check console/logs** - Browser + Terminal
4. **Identify failure point** - Look for ❌ marker
5. **Fix issue** - Adjust CSV or code
6. **Re-test** - Verify fix works
7. **Monitor production** - Watch for errors

---

**Last Updated:** April 13, 2026  
**Version:** 2.0 (Enhanced Debugging)  
**Status:** Production Ready ✅
