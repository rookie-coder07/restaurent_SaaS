# Bulk Menu Upload - Quick Testing Checklist

## ✅ Validation Tests

### Test 1: Valid CSV Upload
**File:** `test_valid.csv`
```
name,price,category
Biryani,250.99,Rice Dishes
Butter Chicken,350.50,Curries
Paneer Tikka,280.00,Appetizers
Samosa,50,Appetizers
```

**Expected Result:**
```
Status: 200
✓ message: "Successfully uploaded 4 items"
✓ inserted: 4
✓ skipped: 0
✓ errors: []
```

---

### Test 2: Invalid Price (Non-numeric)
**File:** `test_invalid_price.csv`
```
name,price,category
Biryani,NOT_A_NUMBER,Rice
```

**Expected Result:**
```
Status: 422
✓ message: "No valid rows to insert. All 1 rows were skipped..."
✓ inserted: 0
✓ skipped: 1
✓ errors[0].reason: "Invalid price value: \"NOT_A_NUMBER\" (not a valid number)"
```

---

### Test 3: Negative Price
**File:** `test_negative_price.csv`
```
name,price,category
Biryani,-100,Rice
```

**Expected Result:**
```
Status: 422
✓ errors[0].reason: "Price cannot be negative: -100"
✓ skipped: 1
```

---

### Test 4: Price Too High
**File:** `test_price_too_high.csv`
```
name,price,category
Biryani,1000000,Rice
```

**Expected Result:**
```
Status: 422
✓ errors[0].reason: "Price exceeds maximum allowed value: 1000000"
✓ skipped: 1
```

---

### Test 5: Missing Required Field - Name
**File:** `test_missing_name.csv`
```
name,price,category
,250,Rice
Butter Chicken,350,Curry
```

**Expected Result:**
```
Status: 200
✓ inserted: 1 (Butter Chicken)
✓ skipped: 1
✓ errors[0].reason: "Missing required field: name"
```

---

### Test 6: Missing Required Field - Price
**File:** `test_missing_price.csv`
```
name,price,category
Biryani,,Rice
```

**Expected Result:**
```
Status: 422
✓ errors[0].reason: "Missing required field: price"
✓ skipped: 1
```

---

### Test 7: Missing Required Field - Category
**File:** `test_missing_category.csv`
```
name,price,category
Biryani,250,
```

**Expected Result:**
```
Status: 422
✓ errors[0].reason: "Missing required field: category"
✓ skipped: 1
```

---

### Test 8: Mixed Valid and Invalid Rows
**File:** `test_mixed.csv`
```
name,price,category
Biryani,250,Rice
InvalidItem,INVALID_PRICE,Curry
Butter Chicken,350,Curry
MissingPrice,,Appetizers
Samosa,50,Appetizers
```

**Expected Result:**
```
Status: 200
✓ message: "Successfully uploaded 3 items"
✓ inserted: 3
✓ skipped: 2
✓ errors has 2 entries
  - Row 2: "Invalid price value"
  - Row 4: "Missing required field: price"
```

---

### Test 9: Empty File
**File:** `test_empty.csv` (empty data)

**Expected Result:**
```
Status: 400
✓ message: "File contains no data rows. Please check your file format."
```

---

### Test 10: CSV Corruption
**File:** `test_corrupted.csv` (binary garbage)

**Expected Result:**
```
Status: 400
✓ message contains "parsing failed"
```

---

### Test 11: Valid XLSX File
**File:** `test_valid.xlsx`
- Sheet with columns: name, price, category
- 3 valid rows

**Expected Result:**
```
Status: 200
✓ inserted: 3
✓ skipped: 0
```

---

### Test 12: XLSX with No Sheets
**File:** `test_no_sheets.xlsx` (Excel file with empty workbook)

**Expected Result:**
```
Status: 400
✓ message: "File parsing failed: Excel file contains no sheets"
```

---

### Test 13: Column Name Variations
**File:** `test_variations.csv`
```
Item Name,Price,Category
Biryani,250,Rice Dishes
```

**Expected Result:**
```
Status: 200
✓ Header detection should map "Item Name" → name
✓ inserted: 1
```

---

### Test 14: Price with Currency Symbol
**File:** `test_currency.csv`
```
name,price,category
Biryani,₹250.99,Rice
Butter Chicken,$350.50,Curry
```

**Expected Result:**
```
Status: 200
✓ Currency symbols stripped
✓ inserted: 2
✓ prices: [250.99, 350.50]
```

---

### Test 15: Item Name Too Long (>255 chars)
**File:** `test_long_name.csv`
```
name,price,category
"This is a very long item name that exceeds the 255 character limit and should be rejected by the system to prevent database issues and maintain data integrity across all systems...................................................................................................................",250,Rice
```

**Expected Result:**
```
Status: 422
✓ errors[0].reason: "Item name exceeds 255 characters"
✓ skipped: 1
```

---

### Test 16: Unauthorized Access
**Request:** Without proper authorization header

**Expected Result:**
```
Status: 403
✓ message: "Access denied"
```

---

### Test 17: Missing File
**Request:** POST /menu/bulk-upload without file

**Expected Result:**
```
Status: 400
✓ message: "Menu file is required. Please upload a CSV or XLSX file."
```

---

## 🧪 Automated Test Cases

### Success Scenario
```bash
curl -X POST http://localhost:3000/api/v1/menu/bulk-upload \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@test_valid.csv"
```

### Error Scenario
```bash
curl -X POST http://localhost:3000/api/v1/menu/bulk-upload \
  -H "Authorization: Bearer {TOKEN}" \
  -F "file=@test_invalid_price.csv"
```

---

## 📊 Success Criteria

✅ **All tests should NOT return 500 errors**
- Even with invalid data, should return 400/422
- Errors should be descriptive

✅ **Valid rows inserted even with some invalid rows**
- Mixed valid/invalid should insert valid ones
- Only skip invalid rows

✅ **Error messages include row numbers**
- Users can identify problematic rows
- Makes fixing easier

✅ **No console.log spam**
- Only structured logger calls
- Clean production logs

✅ **Upload completes in reasonable time**
- <5s for 100 rows on typical hardware
- <30s for 1000 rows

---

## 🔍 Debugging

### Check Logs
```bash
# View last upload attempt
docker logs restaurent-backend 2>&1 | grep "Bulk upload"
```

### Common Issues

| Issue | Check |
|-------|-------|
| "File parsing failed" | Is file valid CSV/XLSX? |
| "Missing required field" | Are name/price/category in file? |
| "Invalid price value" | Are prices numeric? |
| "Category could not be resolved" | Does category exist or can it be created? |
| All rows skipped | Check data format matches expectations |

---

## 📝 Production Deployment

1. **Before deploying:**
   - ✓ Run all test cases above
   - ✓ Check logs for deprecation warnings
   - ✓ Verify no breaking changes

2. **During deployment:**
   - ✓ Backup database (standard practice)
   - ✓ No schema migration needed
   - ✓ Code-only deployment

3. **After deployment:**
   - ✓ Test with real restaurant data
   - ✓ Monitor error logs for 48 hours
   - ✓ Have rollback plan ready

---

## 📈 Performance Metrics

**Target metrics:**

| Metric | Target | Actual |
|--------|--------|--------|
| 10 items | <1s | ? |
| 100 items | <3s | ? |
| 1000 items | <15s | ? |
| Parsing time | <500ms | ? |
| DB insert time | <2s for 100 items | ? |

Record actual metrics after deployment.

---

## 🚀 Success Indicators

- ✓ No 500 errors reported
- ✓ Invalid rows skip gracefully
- ✓ Users report clear error messages
- ✓ Logs help identify issues
- ✓ Upload speed acceptable
- ✓ No database corruption
