# Multi-Tenant GST Implementation Guide

## Architecture Overview

Each restaurant in the SaaS maintains isolated GST configuration:

### Data Model
```sql
-- restaurants table
id (PK)
gst_number          → Restaurant's unique GSTIN
enable_gst          → Boolean: GST enabled for restaurant
default_gst_percent → Total default GST rate
default_cgst_percent → Central GST rate (split)
default_sgst_percent → State GST rate (split)

-- invoice_counters table  
restaurant_id (scoped)  → Restaurant's invoice sequence
prefix                  → Restaurant-specific prefix (e.g., "INV-ABC")
next_number             → Next number in sequence (per restaurant)
```

---

## GST Fetch Flow (Secure)

### Backend Fetch Flow
```
1. User authenticates → req.restaurantId = 'abc-123'
2. GET /api/v1/restaurants/profile
   ├─ Query: .eq('id', req.restaurantId)
   ├─ Validation: validateRestaurantGSTContext(restaurantId, restaurant)
   └─ Return: { gst_number: "27AABCU1234H1Z0", ... }

3. GET /api/v1/orders/:orderId
   ├─ Query: .eq('id', orderId).eq('restaurant_id', restraurantId)
   ├─ Validation: validateOrderBelongsToRestaurant(restaurantId, order)
   └─ Return: Order with correct restaurant's GST context
```

### Frontend Invoice Build Flow
```
1. Frontend GET /api/v1/restaurants/profile
   ├─ Server returns: { gstNumber: "27AABCU1234H1Z0", ... }
   └─ Stored in: restaurant object (state)

2. buildInvoiceData({ order, restaurant })
   ├─ Extract: gstin = restaurant.gstNumber
   ├─ Extract: cgstRate, sgstRate from restaurant settings
   └─ Return: invoice with correct GST for bill

3. printBillReceipt(invoice)
   ├─ Display: GSTIN: 27AABCU1234H1Z0
   └─ Calculate: Taxes using restaurant's rates
```

---

## Security Checks

### ✅ Order Fetch Double-Check
```javascript
// File: orderService.js:1809
.eq('id', orderId)               // Get specific order
.eq('restaurant_id', restaurantId) // Ensure it belongs to this restaurant
// SECURITY: Prevents Restaurant A from seeing Restaurant B's order's GST
```

### ✅ Invoice Counter Isolation
```javascript
// File: invoiceService.js:43
.from('invoice_counters')
.eq('restaurant_id', restaurantId)
// SECURITY: Each restaurant increments its own counter
// Restaurant A: INV-001, INV-002, INV-003
// Restaurant B: INV-001, INV-002, INV-003 (separate sequence)
```

### ✅ Restaurant Profile Scoping
```javascript
// File: restaurantService.js:396
.from('restaurants')
.select('*')
.eq('id', restaurantId)
// SECURITY: Only returns requested restaurant's GST
```

### ✅ Multi-Tenant Validation Layer
```javascript
// File: multiTenantValidation.js (new)
validateOrderBelongsToRestaurant(restaurantId, order)
validateRestaurantGSTContext(restaurantId, restaurant)
validateInvoiceCounterRestaurant(restaurantId, counter)
// SECURITY: Application-level defense-in-depth
```

---

## Data Isolation Example

| Operation | Restaurant A | Restaurant B | Isolation |
|-----------|--------------|--------------|-----------|
| Fetch GST | `restaurantId='abc-123'` | `restaurantId='xyz-789'` | ✅ SEPARATE |
| Result | `gst_number='27AAA'` | `gst_number='22CCC'` | ✅ DIFFERENT |
| Invoice Counter | `restaurant_id='abc-123'` | `restaurant_id='xyz-789'` | ✅ ISOLATED |
| Bill Generated | Uses 27AAA | Uses 22CCC | ✅ CORRECT |

---

## Implementation Checklist

- [x] GST Number scoped per restaurant
- [x] GST Rates scoped per restaurant settings
- [x] Invoice Counter per restaurant
- [x] All order queries include restaurant_id filter
- [x] Multi-tenant validation middleware added
- [x] No hardcoded GST values
- [x] No global GST cache
- [x] Frontend receives restaurant from scoped API
- [x] buildInvoiceData uses passed restaurant object
- [x] All RPC calls include p_restaurant_id parameter

---

## Testing Scenarios

### Scenario 1: Restaurant A Accessing Its GST
```
1. User logs in → restaurantId = 'abc-123'
2. GET /restaurants/profile → gst_number = '27AABCU1234H1Z0' ✅
3. Generate bill → GSTIN: 27AABCU1234H1Z0 ✅
```

### Scenario 2: Restaurant B Accessing Its Different GST
```
1. User logs in → restaurantId = 'xyz-789'
2. GET /restaurants/profile → gst_number = '22CCEBA5678K2V5' ✅
3. Generate bill → GSTIN: 22CCEBA5678K2V5 ✅ (Different from A)
```

### Scenario 3: Attempted Cross-Restaurant Access (BLOCKED)
```
1. Restaurant A user somehow queries Restaurant B's order
2. Query: .eq('id', orderId).eq('restaurant_id', 'abc-123')
3. Result: Order not found (B's order has restaurant_id='xyz-789')
4. Validation: validateOrderBelongsToRestaurant throws error ✅
5. Response: 403 Forbidden ✅
```

---

## Audit Trail

All operations are logged with validation checks:

```
[✅ SECURITY] validateRestaurantGSTContext(abc-123, restaurant)
[✅ SECURITY] validateOrderBelongsToRestaurant(abc-123, order)
[⚠️ SECURITY] Cross-restaurant access attempt detected (abc-123 tried xyz-789)
```

---

## Deployment Verification

Run before deploying:

1. ✅ Check all `.eq('restaurant_id', restaurantId)` exist
2. ✅ Verify no hardcoded GST in code
3. ✅ Confirm multiTenantValidation middleware imported
4. ✅ Test cross-restaurant access (should fail)
5. ✅ Test same-restaurant access (should succeed)
6. ✅ Verify invoice numbers isolated per restaurant
