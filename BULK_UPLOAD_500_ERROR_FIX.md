# 500 Error Diagnosis & Fix Guide

## 🔴 Current Issue

Backend is returning **500 Internal Server Error** on bulk upload with generic message:
```
{
  "statusCode": 500,
  "data": null,
  "message": "Something went wrong. Please try again.",
  "errors": null,
  "success": false
}
```

This is a catch-all error from the error handler middleware, indicating an unhandled error in the controller.

---

## ✅ Improvements Made

### 1. Enhanced Error Handling
Added comprehensive try-catch blocks and detailed logging throughout the `bulkUploadMenu` controller:

- ✅ Better error logging at each step
- ✅ Error stack traces logged
- ✅ Specific error messages returned to frontend
- ✅ Database error details logged
- ✅ File parsing errors detailed
- ✅ Category resolution errors logged

### 2. Specific Error Messages
Instead of generic "Something went wrong", you'll now get:

```
❌ 400: File parsing failed: CSV buffer is empty
❌ 400: Unable to detect columns in file: headers not found
❌ 403: Only restaurant owners can bulk upload menu items
❌ 500: Database error: Unique constraint violation...
❌ 500: Unable to fetch categories: Connection timeout
```

### 3. Comprehensive Logging
Each step logs:
- User ID and email
- Restaurant ID
- File details (name, size)
- Row counts
- Parse errors with stack traces
- Database errors with error codes

---

## 🧪 Testing & Debugging

### Option 1: Run Debug Script
```bash
node test-bulk-upload-debug.js
```

This will:
1. Login as owner
2. Test with simple CSV string
3. Try to find and test actual CSV files
4. Show detailed error messages
5. Provide debugging tips

### Option 2: Check Backend Logs
```bash
# Docker logs
docker logs restaurent-backend 2>&1 | grep "BULK_UPLOAD"

# Watch for new errors
docker logs -f restaurent-backend 2>&1 | grep "BULK_UPLOAD"

# Get last errors
docker logs restaurent-backend 2>&1 | grep "BULK_UPLOAD" | tail -50
```

### Option 3: Browser Console Debugging
```javascript
// In browser console
localStorage.getItem('token') // Verify token exists
localStorage.getItem('restaurantId') // Verify restaurantId

// Enable API debug logging
localStorage.setItem('VITE_DEBUG_API', 'true') // May need to reload
```

---

## 🔍 Common Causes of 500 Error

### 1. CSV/XLSX Parsing Error
**Symptom:** 500 error when uploading certain file types
**Cause:** File format not recognized or corrupted
**Fix:** Ensure file is valid CSV or XLSX

**Test:**
```bash
# Test with simple CSV
echo "name,price,category
Pizza,300,Main
Coke,50,Drink" > test.csv

# Try uploading
```

### 2. Database Connection Error
**Symptom:** 500 error consistently on all upload attempts
**Cause:** Supabase connection issue
**Fix:** Check backend `.env` file for correct Supabase credentials

**Check:**
```bash
# Verify environment variables
docker inspect restaurent-backend | grep -A 20 "Env"

# Test database connection
# Add test query in backend logs
```

### 3. Missing restaurantId in Token
**Symptom:** 500 error even with valid file
**Cause:** JWT token doesn't include restaurantId
**Fix:** Re-login, ensure token has restaurantId

**Test:**
```javascript
// Decode token
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload); // Should have "restaurantId"
```

### 4. File Too Large
**Symptom:** 500 error on large files
**Cause:** File > 5MB
**Fix:** Reduce file size or split into multiple uploads

**Check:**
```bash
# Get file size in bytes
ls -lh menu.csv
# Compare to 5MB limit (5242880 bytes)
```

### 5. Invalid File Headers
**Symptom:** 500 error or "no data rows" error
**Cause:** File doesn't have required columns (name, price, category)
**Fix:** Verify CSV has these columns

**Valid CSV format:**
```csv
name,price,category
Paneer Butter Masala,350,Indian
Butter Naan,60,Bread
Regular Lassi,80,Beverages
```

**Invalid (missing columns):**
```csv
item_name,cost
Pizza,300
```

### 6. Encoding Issues
**Symptom:** 500 error with special characters
**Cause:** File encoding not UTF-8
**Fix:** Save file as UTF-8 encoding

**Terminal:**
```bash
# Convert to UTF-8
iconv -f ISO-8859-1 -t UTF-8 menu.csv > menu-utf8.csv

# Verify encoding
file menu.csv
# Should say: "UTF-8 Unicode text"
```

---

## 🛠️ Step-by-Step Troubleshooting

### Step 1: Verify Authentication
```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@restaurant.com","password":"Owner123@456","portal":"admin"}'

# Should get token back
```

### Step 2: Verify Token Works
```bash
# Test with token
curl -X GET http://localhost:3000/api/v1/menu/categories \
  -H "Authorization: Bearer <token>"

# Should get categories (no 401 error)
```

### Step 3: Test File Format
```bash
# Create simple test file
cat > test.csv << 'EOF'
name,price,category
Pizza,300,Italian
EOF

# Upload test file
curl -X POST http://localhost:3000/api/v1/menu/bulk-upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.csv"
```

### Step 4: Check Backend Logs
```bash
# Watch for bulk upload errors
docker logs -f restaurent-backend 2>&1 | grep -A 5 "BULK_UPLOAD\|error"
```

### Step 5: Check Database
```bash
# Verify restaurantId exists
# Go to Supabase dashboard → restaurants table
# Check if your restaurant has valid ID

# Verify categories table
# May need to create categories first
```

---

## 📋 Validation Checklist

Before uploading, verify:

- [ ] User is logged in as OWNER (not manager)
- [ ] File is CSV or XLSX format
- [ ] File size < 5MB
- [ ] File has columns: name, price, category
- [ ] File is UTF-8 encoded
- [ ] File has at least 1 data row
- [ ] Name values are not empty
- [ ] Price values are valid numbers
- [ ] Category values are not empty
- [ ] No special characters causing issues

---

## 🚀 Quick Fix Checklist

```bash
# 1. Verify file format
file menu.csv

# 2. Check file size
ls -lh menu.csv

# 3. Check file content
head -5 menu.csv

# 4. Convert encoding if needed
iconv -f ISO-8859-1 -t UTF-8 menu.csv > menu-utf8.csv

# 5. Test with simple file
echo "name,price,category\nPizza,300,Italian" > simple.csv

# 6. Run debug script
node test-bulk-upload-debug.js

# 7. Check logs
docker logs restaurent-backend 2>&1 | grep BULK_UPLOAD
```

---

## 📊 Enhanced Logging Output

With the new error handling, you'll see in backend logs:

```
[BULK_UPLOAD] Authorization check: { 
  userRole: 'owner', 
  normalizedRole: 'admin', 
  restaurantId: 'xxx' 
}

[BULK_UPLOAD] File parsed successfully: { 
  rowCount: 100, 
  fileSize: 5120 
}

[BULK_UPLOAD] Building header map: { 
  detectedColumns: { 
    name: 'name', 
    price: 'price', 
    category: 'category' 
  } 
}

[BULK_UPLOAD] Fetching existing categories: { 
  categoryCount: 5 
}

[BULK_UPLOAD] Inserting menu items to database: { 
  count: 98 
}

[BULK_UPLOAD] Uncaught error: File parsing failed: CSV buffer is empty
```

---

## 🔧 Code Changes Summary

###  File: `backend/src/controllers/menuController.js`

**Changes in `bulkUploadMenu` function:**

1. ✅ Added try-catch around entire function
2. ✅ Enhanced logging with [BULK_UPLOAD] prefix
3. ✅ Added error stack traces to logs
4. ✅ Return specific error messages instead of generic ones
5. ✅ Added logging for file, parsing, header detection, category fetch, database insert
6. ✅ Better error context in logs

**Result:** Clear, actionable error messages that identify the exact issue

---

## 🎯 Expected Behavior After Fix

### Successful Upload
```json
{
  "success": true,
  "message": "Successfully uploaded 98 items",
  "data": {
    "total": 100,
    "inserted": 98,
    "skipped": 2,
    "errors": [
      { "row": 5, "reason": "Missing name" },
      { "row": 12, "reason": "Invalid price" }
    ]
  }
}
```

### File Parse Error
```json
{
  "success": false,
  "statusCode": 400,
  "message": "File parsing failed: CSV buffer is empty"
}
```

### Permission Error
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only restaurant owners can bulk upload menu items"
}
```

### Database Error
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Database error: unique violation on menu_items_name_key"
}
```

---

## 📞 Next Steps

1. **Run debug script:** `node test-bulk-upload-debug.js`
2. **Check logs:** `docker logs restaurent-backend 2>&1 | grep BULK_UPLOAD`
3. **Share error output** if still getting 500 errors
4. **Verify file format** matches CSV/XLSX requirements

---

## 🎓 Prevention

To avoid 500 errors in the future:

1. ✅ Always validate file format before upload
2. ✅ Check file size (< 5MB)
3. ✅ Verify required columns exist
4. ✅ Use UTF-8 encoding
5. ✅ Test with small file first
6. ✅ Check backend logs for errors
7. ✅ Use the debug script when issues occur

---

**Status:** ✅ Error handling improved - should now get specific error messages instead of generic 500 errors
