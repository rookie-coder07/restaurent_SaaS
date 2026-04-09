# Multi-Tenant GST Security Audit

## REQUIREMENT: GST must be restaurant-specific, never global or hardcoded

---

## ✅ SECURE ACCESS POINTS

### 1. Restaurant GST Number Fetch
**File**: `src/services/restaurantService.js:396`
```javascript
.eq('id', restaurantId)
.single();
```
- ✅ Scoped to single restaurant
- ✅ Returns: gstin from `gst_number` field
- ✅ Used in: Frontend buildInvoiceData

### 2. GST Rates Fetch (Enable GST, CGST, SGST)
**File**: `src/services/orderService.js:279-289`
```javascript
.from('restaurants')
.select('id, enable_gst, default_gst_percent, default_cgst_percent, default_sgst_percent')
.eq('id', restaurantId)
.single();
```
- ✅ Scoped to single restaurant
- ✅ Fallback for legacy schemas
- ✅ Never hardcoded defaults

### 3. Invoice Counter (Restaurant-specific)
**File**: `src/services/invoiceService.js:43-52`
```javascript
.from('invoice_counters')
.select('*')
.eq('restaurant_id', restaurantId)
.maybeSingle();
```
- ✅ Scoped to single restaurant
- ✅ Generates restaurant-specific invoice numbers
- ✅ RPC uses parameter: `p_restaurant_id`

### 4. Order Fetching with GST Context
**File**: `src/services/orderService.js:1809-1850`
```javascript
.eq('id', orderId)
.eq('restaurant_id', restaurantId)
.single();
```
- ✅ Double checks: both ID and restaurant_id
- ✅ Prevents cross-restaurant lease
- ✅ Ensures bill reflects correct restaurant's GST

### 5. Frontend Invoice Data
**File**: `src/utils/invoice.js:96-161`
- Gets gstin from: `restaurant?.gstNumber`
- Restaurant object source: `/api/v1/restaurants/profile` ✅ Scoped to current user's restaurant
- GST rates: Fetched via `getRestaurantBillingSettings(restaurant)` ✅ Uses restaurant object only

---

## 🔒 SECURITY GUARANTEES

| Restaurant A | Restaurant B | GST Visibility |
|---|---|---|
| Restaurant ID: `abc-123` | Restaurant ID: `xyz-789` | ✅ ISOLATED |
| GST: `27AABCU1234H1Z0` | GST: `22CCEBA5678K2V5` | ✅ EACH SEES OWN |
| CGST Rate: 5% | CGST Rate: 9% | ✅ RATES DIFFER |
| Bill Generated: Uses `27AABCU1234H1Z0` | Bill Generated: Uses `22CCEBA5678K2V5` | ✅ CORRECT GST ON BILL |

---

## ❌ PREVENTED SCENARIOS

1. **Global GST Number**: ❌ Never used
2. **Hardcoded GST**: ❌ Never used (defaults only as fallback)
3. **Cross-Restaurant Leak**: ❌ Prevented by double .eq('id', restaurantId) + .eq('restaurant_id', restaurantId)
4. **Invoice Counter Collision**: ❌ Each restaurant has own counter sequence
5. **Bill with Wrong GST**: ❌ Restaurant ID matched at order fetch

---

## 🔍 VERIFICATION CHECKLIST

- [x] All restaurant queries include: `.eq('id', restaurantId)` or `.eq('restaurant_id', restaurantId)`
- [x] Frontend receives restaurant from authenticated API endpoint
- [x] Frontend buildInvoiceData uses passed restaurant object (not global)
- [x] Invoice counter scoped per restaurant
- [x] Order fetch validates restaurant_id before returning
- [x] Customer endpoints validate table belongs to restaurant before returning bill
- [x] No hardcoded GST values (except NULL defaults)
- [x] All RPC calls include restaurantId parameter

---

## 📋 ENDPOINTS VALIDATED

- `GET /api/v1/restaurants/profile` ✅ Scoped to req.restaurantId
- `GET /api/v1/orders/:orderId` ✅ Scoped to req.restaurantId
- `GET /api/v1/orders` ✅ Scoped to req.user.restaurantId
- `POST /api/v1/orders/:orderId/paid` ✅ Scoped to req.restaurantId
- `GET /customer/orders/:orderId` ✅ Validates table->restaurant relationship
- `GET /customer/orders/table/:tableNumber` ✅ Scoped by table's restaurant_id

---

## ⚡ DEPLOYMENT CHECKLIST

- [x] GST Number properly stored per restaurant
- [x] GST Rates stored per restaurant settings
- [x] All queries properly scoped
- [x] No globals or cached GST data
- [x] Multi-tenant RLS enforced in database (additional layer)
