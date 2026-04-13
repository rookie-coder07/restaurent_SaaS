# Category Normalization & Deduplication Test Plan

## Overview
Test the new category normalization and deduplication logic that handles:
- Duplicate category names in database
- Case-insensitive matching ("Appetizers" vs "appetizers" vs "APPETIZERS")
- Proper category_id resolution for bulk uploads
- Concurrent category creation handling

## Test Scenarios

### Scenario 1: Duplicate Categories in Database
**Setup:**
- Database has categories: "Appetizers" (id:1), "Appetizers" (id:2)

**Test:**
- Upload CSV with "appetizers" in menu items
- Expected: Should resolve to id:1 (first occurrence after deduplication)
- Verify: Log shows "Duplicate category found" warning for id:2

**Code Path:**
- Lines 440-506: Category fetch with deduplication
- Uses Set to track normalized names
- Keeps first occurrence

### Scenario 2: Case-Insensitive Matching
**Setup:**
- Database has category "Snacks" (id:5)
- New item has category "snacks"

**Test:**
- Upload CSV with "snacks", "SNACKS", "Snacks", "SnAcKs"
- Expected: All should resolve to id:5
- Verify: All items created with category_id=5

**Code Path:**
- Lines 568-599: Database query with case-insensitive search
- Uses LOWER()/TRIM() normalization
- Finds matching category regardless of case

### Scenario 3: Multiple Spelling Issues
**Setup:**
- One CSV has "Desserts"
- One CSV has "Deserts" (typo)
- Database only has "Desserts" (id:10)

**Test:**
- Upload first CSV: Should resolve "Desserts" to id:10
- Upload second CSV: "Deserts" not found → creates new category (id:11)
- Verify: Both categories exist in database
- Verify: Items properly linked to respective categories

**Code Path:**
- Lines 600-670: Category creation fallback
- If not found in cache or database, creates new
- Logs new category creation

### Scenario 4: Concurrent Uploads (Unique Constraint)
**Setup:**
- Two simultaneous bulk uploads both try to create "Beverages"

**Test:**
- Upload 1: Creates "Beverages" (id:7)
- Upload 2: Gets unique constraint error (23505) on create
- Expected: Upload 2 retries and finds the category Upload 1 just created
- Expected: Both uploads succeed
- Verify: Only one "Beverages" category in database

**Code Path:**
- Lines 626-654: Unique constraint error handling (23505)
- Retries the database fetch after constraint error
- Caches the found category

### Scenario 5: Normalization Edge Cases
**Setup:**
- Categories with leading/trailing spaces in CSV
- Categories with mixed case and spaces

**Test:**
- Upload CSV with " Appetizers ", "APPETIZERS", "  appetizers  "
- Expected: All resolve to same category_id
- Verify: Normalization uses TRIM() + LOWER()

**Code Path:**
- Lines 440-506: Initial normalization in category fetch
- Lines 540-545: Resolvable function normalizes input
- String.trim().toLowerCase() applied consistently

## Coverage Areas

### Phase 3 - Part 1: Category Fetch with Deduplication ✅
- [x] Fetch existing categories for restaurant
- [x] Deduplicate by normalized name
- [x] Keep first occurrence when duplicates found
- [x] Log duplicate removal
- [x] Build Map with normalized lowercase keys
- [x] Store objects with {id, originalName} structure

### Phase 3 - Part 2: Category Resolver ✅
- [x] Extract categoryId from new Map object structure
- [x] Cache lookup with normalized keys
- [x] Database fallback query
- [x] Case-insensitive search in results
- [x] Cache database-found categories
- [x] Create category if not found
- [x] Handle unique constraint errors (23505)
- [x] Cache newly created categories
- [x] Proper error logging at each step

## Test Execution Commands

```bash
# Test with duplicate categories CSV
curl -X POST http://localhost:3000/api/bulk-upload-menu \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-duplicate-categories.csv"

# Expected Response:
{
  "success": true,
  "message": "Bulk upload completed",
  "data": {
    "created": 15,
    "updated": 0,
    "total": 15,
    "errors": []
  },
  "logs": [
    "[BULK_UPLOAD] Duplicate category found: 'Appetizers' (kept id:1, skipped id:2)",
    "[BULK_UPLOAD] Found existing category in cache: 'appetizers' -> id:1",
    ...
  ]
}
```

## Export Test CSVs

### test-duplicate-categories.csv
```csv
Name,Description,Price,Category,Status
Homer Donut,Glazed,2.99,Appetizers,active
Caesar Salad,Fresh greens,4.99,appetizers,active
Spring Rolls,Crispy,3.99,APPETIZERS,active
```

### test-case-mismatch.csv
```csv
Name,Description,Price,Category,Status
Coke,Soft drink,1.99,Beverages,active
Sprite,Lemon lime,1.99,beverages,active
Fanta,Fruity,1.99,BEVERAGES,active
```

### test-spelling-issues.csv
```csv
Name,Description,Price,Category,Status
Chocolate Cake,Rich,4.99,Desserts,active
Ice Cream,Cold,3.99,Deserts,active
Tiramisu,Italian,5.99,DESSERTS,active
```

## Success Criteria

✅ All uploads complete without errors
✅ Category deduplication works
✅ Case-insensitive matching succeeds  
✅ Concurrent uploads handle conflicts
✅ Logs show proper normalization
✅ No foreign key violations
✅ All menu items created with correct category_id
✅ Database has no orphaned categories

## Current Implementation Status

**Completed:**
- ✅ Import fixes (supabase defined)
- ✅ Category_id foreign key mapping
- ✅ Pre-insert validation
- ✅ PostgreSQL error handling
- ✅ Category deduplication logic (Part 1)
- ✅ Category resolver update (Part 2)

**In Testing:**
- 🔄 Deduplication with duplicate categories
- 🔄 Case-insensitive matching
- 🔄 Unique constraint retry logic

**Not Started:**
- ⏳ Load testing
- ⏳ Performance benchmarks
- ⏳ Production deployment

## Next Steps

1. **Execute test scenarios** - Run all CSV test files
2. **Verify logs** - Check for expected deduplication messages
3. **Database validation** - Confirm category counts and links
4. **Performance check** - Ensure no N+1 queries
5. **Documentation** - Update API docs with examples
6. **Production ready** - Sign off on category normalization
