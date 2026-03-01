# ⚡ QUICK START - TABLE-ORDER LINKING FIX

## What Was Fixed
✅ Orders now linked to tables when customer scans QR code

## Files Modified (3 total)

### 1. **backend/src/routes/customer.js**
Just added table resolution before order creation:
```javascript
// NEW: Converts tableNumber → tableId
router.post('/orders', optionalAuth, async (req, res, next) => {
  if (req.body.tableNumber && !req.body.tableId) {
    const table = await supabase.from('tables')
      .select('id, restaurant_id')
      .eq('table_number', parseInt(req.body.tableNumber))
      .single();
    
    req.body.tableId = table.id;
    req.restaurantId = table.restaurant_id;
  }
  next(); // → orderController.createOrder()
}, orderController.createOrder);
```

### 2. **backend/src/services/orderService.js**
Updated order methods to include table info:
- `createOrder()` - Now adds items automatically
- `getOrderById()` - Adds table join
- `getOrdersByRestaurant()` - Adds table join
- `getOrders()` - Adds table join  
- `getKitchenOrders()` - With table projection

All query patterns changed from:
```javascript
// BEFORE
.select(`*, order_items (...)`)

// AFTER
.select(`
  *,
  order_items (...),
  tables!table_id (table_number)
`)
```

### 3. **backend/src/services/kitchenService_supabase.js**
Same table join additions:
- `getPendingOrders()` - Added table join
- `getOrdersInProgress()` - Added table join
- `getOrderDetails()` - Added table join

---

## How It Works

```
Customer Action          Backend Processing
──────────────────      ──────────────────
Scans QR: /menu?table=1
                        ↓
Loads CustomerMenu      Frontend reads: table=1
                        ↓
Adds items to cart
                        ↓
Submits order:
tableNumber: 1    →     NEW: Resolve tableNumber→tableId
items: [...]            Lookup table in DB
                        ↓
                        Create order with:
                        - tableId: UUID ✅
                        - restaurantId: UUID ✅
                        - items: [...]
                        ↓
Kitchen polls           Query with table join
                        ↓
Shows Order:            Display: Table #1
- Table #1              Items
- Items                 Status
- Status
```

---

## Testing (Copy-Paste)

### Create Table
```bash
curl -X POST https://your-api.com/api/v1/tables \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 1,
    "seatCapacity": 4
  }'
```

### Place Order (What Customer Does)
```bash
curl -X POST https://your-api.com/api/v1/customer/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 1,
    "items": [
      {
        "menuItemId": "MENU_ITEM_UUID",
        "quantity": 1,
        "unitPrice": 250
      }
    ],
    "totalAmount": 250,
    "paymentMethod": "cash"
  }'
```

Expected Response:
```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "id": "ORDER_UUID",
    "table_id": "TABLE_UUID",      // ✅ NOW SET
    "tableNumber": 1,               // ✅ CALCULATED  
    "status": "pending",
    "items": [...]
  }
}
```

### Kitchen View (Next 3 Seconds)
```bash
# Browser: Kitchen dashboard auto-refreshes
# API call happens automatically:
GET https://your-api.com/api/v1/kitchen/orders
```

Expected Response:
```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "id": "ORDER_UUID",
      "tableNumber": 1,             // ✅ NOW SHOWN
      "status": "pending",
      "items": [...]                // ✅ DISPLAYED
    }
  ]
}
```

---

## No Changes Needed

✅ **Frontend** - Already reads table param  
✅ **QR Generation** - Already includes table in URL  
✅ **Menu Page** - Already displays table number  
✅ **Kitchen Display** - Now gets table from backend  
✅ **Database Schema** - No migrations needed  

---

## Deployment

```bash
# 1. Commit
git add backend/src/routes/customer.js
git add backend/src/services/orderService.js
git add backend/src/services/kitchenService_supabase.js
git commit -m "Fix: Link orders to tables via QR flow"

# 2. Push
git push origin main

# 3. Done! (Auto-deploys)
```

---

## What Gets Fixed

| Issue | Solution |
|-------|----------|
| Menu opens without table | Frontend already reads from URL |
| Orders not linked to table | NEW: Backend resolves tableNumber→tableId |
| Kitchen doesn't see table | NEW: Table join in Supabase queries |
| Kitchen can't filter by table | NEW: tableNumber accessible in response |

---

## Verify It Works

### Step 1: Check Backend Logs
After placing order, you should see:
```
✅ Resolved Table #1 → ID: abc-123-def
✅ Order created: order-uuid-here
```

### Step 2: Kitchen Dashboard
Orders should show:
```
┌─────────────────┐
│ TABLE #1        │
├─────────────────┤
│ • Item 1 x2     │
│ • Item 2 x1     │
├─────────────────┤
│ Status: PENDING │
└─────────────────┘
```

### Step 3: Database Check
```sql
SELECT id, table_id, status FROM orders 
WHERE created_at > NOW() - INTERVAL '1 minute'
LIMIT 1;

-- Should show table_id populated (not NULL)
```

---

## If It Doesn't Work

1. **Check table exists**:
   ```bash
   curl GET https://your-api.com/api/v1/tables
   # Look for your table
   ```

2. **Check logs for errors**:
   ```
   ❌ Table lookup error
   ❌ Order creation failed
   ```

3. **Verify API responses**:
   - Order creation returns 201 (not 400/404)
   - Kitchen query returns orders
   - Check `tableNumber` in response

4. **Check database directly**:
   ```sql
   SELECT * FROM tables WHERE table_number = 1;
   SELECT * FROM orders WHERE id = 'YOUR_ORDER_ID';
   ```

---

## What Changed Under the Hood

### Order Creation Pipeline

**BEFORE:**
```
POST /customer/orders
├─ tableNumber: 1
└─ itemData: [...]
        ↓
    Create order with:
    - table_id: NULL ❌
    - restaurantId: ??? ❌
```

**AFTER:**
```
POST /customer/orders
├─ tableNumber: 1
└─ itemData: [...]
        ↓
    Middleware:
    - Query: SELECT id FROM tables WHERE table_number=1
    - Set: req.body.tableId = result.id ✅
    - Set: req.restaurantId = result.restaurant_id ✅
        ↓
    Create order with:
    - table_id: UUID ✅
    - restaurantId: UUID ✅
    - items: auto-added ✅
```

### Kitchen Query Pipeline

**BEFORE:**
```
GET /kitchen/orders
    ↓
SELECT orders.*, order_items(...)
    ↓
Response:
[
  { id, status, items ... }  // table_id NULL ❌
]
```

**AFTER:**
```
GET /kitchen/orders
    ↓
SELECT orders.*, order_items(...), tables(table_number)
    ↓
Response:
[
  { 
    id, status, items ...,
    table_id: UUID,
    tableNumber: 1 ✅
  }
]
```

---

## Performance Impact

✅ **None** - Only added 1 DB query per order submit (table resolution)  
✅ **Minimal** - Table join already in Supabase (no N+1 queries)  
✅ **Fast** - Indexed lookups (table_number has index)  

---

## Backward Compatibility

✅ **Old QR codes still work** - Point to same /menu?table=X  
✅ **Old orders unaffected** - No data migration  
✅ **Existing kitchen works** - Just gets more data  
✅ **API compatible** - Optional tableNumber field  

---

## Summary

**Problem**: Orders not linked to tables  
**Root Cause**: Frontend sends tableNumber, backend expected tableId  
**Solution**: Middleware resolves tableNumber→tableId  
**Result**: Complete QR → Menu → Cart → Order → Kitchen flow ✅  

**Deploy**: 3 files, no migrations, auto-compatible  
**Test Time**: 2 minutes  
**Live Time**: Immediate  

---

*For detailed info: see TABLE_ORDER_LINKING_FIX.md*
