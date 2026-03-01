# DIAGNOSIS & TESTING COMMANDS

Quick reference for testing the fix in your environment.

---

## 1. VERIFY BACKEND IS RUNNING

```bash
curl http://localhost:3000/api/v1/health

# Expected: 200 OK (or similar health check response)
# Shows backend is running
```

---

## 2. CREATE A TEST TABLE

```bash
curl -X POST http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 99,
    "seatCapacity": 2
  }'

# Save the returned "id" field for next steps
# Example: id: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
```

---

## 3. TEST MENU LOADING (Simulating QR Scan)

```bash
curl "http://localhost:3000/api/v1/customer/menu/items?table=99"

# Expected: 200 OK with array of menu items
# Confirms menu can be fetched for table
```

---

## 4. TEST ORDER CREATION WITH TABLE NUMBER (THE CRITICAL TEST)

```bash
curl -X POST http://localhost:3000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 99,
    "items": [
      {
        "menuItemId": "00000000-0000-0000-0000-000000000001",
        "quantity": 1,
        "unitPrice": 100
      }
    ],
    "totalAmount": 100,
    "paymentMethod": "cash"
  }'

# IMPORTANT: Watch backend logs!
# Should see: ✅ Resolved Table #99 → ID: a1b2c3d4...
# 
# Expected Response:
# {
#   "statusCode": 201,
#   "success": true,
#   "data": {
#     "id": "order-id-here",
#     "table_id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
#     "tableNumber": 99,
#     "status": "pending",
#     "items": [...]
#   }
# }
#
# Save the "id" field (it's your order ID)
```

**If this fails:**
- Check backend logs for "❌ Table lookup error"
- Verify table_number in database matches request (99 = 99)
- Make sure table was created successfully

---

## 5. TEST KITCHEN ORDER FETCH

```bash
curl http://localhost:3000/api/v1/kitchen/orders \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: 200 OK with array of orders
# Check that recent order is in the list
# Most important: Verify "tableNumber": 99 is present
#
# If order shows "tableNumber": null, the fix didn't apply
# If order shows "tableNumber": 99, the fix is working! ✅
```

---

## 6. DATABASE VERIFICATION (Direct Query)

```bash
# Using your Supabase dashboard or psql:

SELECT id, table_id, status, created_at 
FROM orders 
WHERE created_at > NOW() - INTERVAL '10 minutes'
LIMIT 1;

# Should show:
# id           | table_id             | status  | created_at
# order-...    | a1b2c3d4-e5f6-...   | pending | 2024-03-01...
#
# table_id should NOT be NULL ✅
# If it is, the middleware didn't run
```

---

## 7. CHECK TABLE RECORD

```bash
SELECT id, table_number, restaurant_id 
FROM tables 
WHERE table_number = 99;

# Should show:
# id                   | table_number | restaurant_id
# a1b2c3d4-e5f6-...   | 99           | rest-id-...
#
# This is what the middleware looks up
```

---

## 8. FULL END-TO-END TEST (Just Copy-Paste All)

```bash
# Create a test table
TABLE_ID=$(curl -s -X POST http://localhost:3000/api/v1/tables \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 88,
    "seatCapacity": 2
  }' | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')

echo "Created Table: $TABLE_ID"

# Get menu items
curl "http://localhost:3000/api/v1/customer/menu/items?table=88"

# Place an order
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 88,
    "items": [{"menuItemId": "00000000-0000-0000-0000-000000000001", "quantity": 1, "unitPrice": 100}],
    "totalAmount": 100,
    "paymentMethod": "cash"
  }')

echo "Order Response:"
echo "$RESPONSE" | jq '.'

# Check kitchen
curl -s http://localhost:3000/api/v1/kitchen/orders \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data[-1]'
```

---

## 9. BACKEND LOG INDICATORS

**Look for these in backend logs:**

✅ **Success indicators:**
```
✅ Resolved Table #99 → ID: a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
✅ Order created: order-id-here
```

❌ **Error indicators (fix not working):**
```
❌ Table lookup error: Table 99 not found
❌ Error resolving table: Table number is required
```

---

## 10. POSTMAN COLLECTION (If Using Postman)

```json
{
  "info": {
    "name": "Table Order Linking Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Table",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Content-Type", "value": "application/json"},
          {"key": "Authorization", "value": "Bearer YOUR_TOKEN"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"tableNumber\": 77,\n  \"seatCapacity\": 4\n}"
        },
        "url": {"raw": "http://localhost:3000/api/v1/tables", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api","v1","tables"]}
      }
    },
    {
      "name": "Place Order",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"tableNumber\": 77,\n  \"items\": [{\"menuItemId\": \"00000000-0000-0000-0000-000000000001\", \"quantity\": 1, \"unitPrice\": 100}],\n  \"totalAmount\": 100,\n  \"paymentMethod\": \"cash\"\n}"
        },
        "url": {"raw": "http://localhost:3000/api/v1/customer/orders", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api","v1","customer","orders"]}
      }
    },
    {
      "name": "Get Kitchen Orders",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer YOUR_TOKEN"}],
        "url": {"raw": "http://localhost:3000/api/v1/kitchen/orders", "protocol": "http", "host": ["localhost"], "port": "3000", "path": ["api","v1","kitchen","orders"]}
      }
    }
  ]
}
```

---

## 11. EXPECTED RESULTS CHECKLIST

After running test at #4 above:

- [ ] Backend logs show: `✅ Resolved Table #99`
- [ ] Response status: 201 (Created)
- [ ] Response includes: `"table_id": "uuid-here"` (NOT NULL)
- [ ] Response includes: `"tableNumber": 99`
- [ ] Order appears in kitchen query (#5)
- [ ] Kitchen order has `"tableNumber": 99`
- [ ] Database shows `table_id` is populated

**If all checked**: Fix is working! ✅

---

## 12. ROLLBACK (If Needed)

```bash
# If something goes wrong, rollback:
git revert HEAD
git push origin main

# Old version deployed automatically
# Orders will still work (backward compatible)
```

---

## 13. COMPARISON TABLE

| Test | Before Fix | After Fix |
|------|-----------|-----------|
| Table found? | ❌ NULL | ✅ UUID |
| Kitchen sees table? | ❌ No | ✅ Yes |
| Order response has tableNumber? | ❌ No | ✅ Yes |
| Backend logs "Resolved"? | ❌ No | ✅ Yes |
| Kitchen order includes tableNumber? | ❌ Null | ✅ 99 |

---

## 14. PERFORMANCE CHECK (Optional)

```bash
# Measure time to place order
time curl -X POST http://localhost:3000/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 99,
    "items": [
      {"menuItemId": "00000000-0000-0000-0000-000000000001", "quantity": 1, "unitPrice": 100}
    ],
    "totalAmount": 100,
    "paymentMethod": "cash"
  }'

# Should be < 500ms (was probably < 200ms before)
# The single table lookup adds ~5-20ms which is acceptable
```

---

## 15. MENU ITEM ID REFERENCE

If you need a test menu item ID, get one from:

```bash
curl "http://localhost:3000/api/v1/customer/menu/items?table=99"

# Copy the "id" field from any item
# Use it in order creation instead of "00000000-0000-0000-0000-000000000001"
```

---

## QUICK TEST SCRIPT

Save as `test_fix.sh`:

```bash
#!/bin/bash

API="http://localhost:3000/api"
TOKEN="YOUR_TOKEN_HERE"

echo "=== Creating Table #42 ==="
TABLE=$(curl -s -X POST $API/v1/tables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableNumber":42,"seatCapacity":4}')
TABLE_ID=$(echo $TABLE | jq -r '.data.id')
echo "Table ID: $TABLE_ID"

echo -e "\n=== Placing Order for Table #42 ==="
ORDER=$(curl -s -X POST $API/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber":42,
    "items":[{"menuItemId":"00000000-0000-0000-0000-000000000001","quantity":1,"unitPrice":100}],
    "totalAmount":100,
    "paymentMethod":"cash"
  }')
ORDER_ID=$(echo $ORDER | jq -r '.data.id')
TABLE_NUM=$(echo $ORDER | jq -r '.data.tableNumber')
echo "Order ID: $ORDER_ID"
echo "Table Number in Response: $TABLE_NUM"

if [ "$TABLE_NUM" = "42" ]; then
  echo "✅ FIX IS WORKING! tableNumber is present in response"
else
  echo "❌ FIX NOT WORKING! tableNumber is missing or wrong"
fi

echo -e "\n=== Checking Kitchen Orders ==="
KITCHEN=$(curl -s $API/v1/kitchen/orders -H "Authorization: Bearer $TOKEN")
KITCHEN_TABLE=$(echo $KITCHEN | jq '.data[-1].tableNumber')
echo "Kitchen Order Table: $KITCHEN_TABLE"

if [ "$KITCHEN_TABLE" = "42" ]; then
  echo "✅ FIX IS COMPLETE! Kitchen receives tableNumber"
else
  echo "❌ Kitchen query failing! Check middleware"
fi
```

Run with:
```bash
chmod +x test_fix.sh
./test_fix.sh
```

---

## SUMMARY

**All these tests verify:**
1. ✅ Frontend can send tableNumber
2. ✅ Middleware resolves it to tableId
3. ✅ Order created with table linkage
4. ✅ Kitchen receives table information
5. ✅ Complete flow working

**If all pass**: Ready for production! 🚀
