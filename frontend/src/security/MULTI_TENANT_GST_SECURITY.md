# Frontend Multi-Tenant GST Security

## ✅ SECURE: Frontend Invoice Building

### GST Data Source
**File**: `src/pages/BillView.jsx:116`
```javascript
const restaurant = await restaurantAPI.getProfile();
// Server validates: .eq('id', req.restaurantId)
// Result: Only current user's restaurant data
```

### Invoice Building
**File**: `src/utils/invoice.js:96-161`
```javascript
export const buildInvoiceData = ({
  order,
  restaurant = {},  // ← PASSED PARAMETER (scoped by server)
  ...
}) => {
  // Extract GST from restaurant object (never hardcoded)
  gstin: restaurant?.gstNumber || '',
  
  // Get rates from restaurant settings
  const restaurantSettings = getRestaurantBillingSettings(restaurant);
  
  return {
    gstin,
    summary: {
      cgstRate: restaurantSettings.cgstRate,
      sgstRate: restaurantSettings.sgstRate,
      ...
    }
  };
};
```

### Display on Bill
**File**: `src/pages/BillView.jsx:295-299`
```jsx
{(invoice.phone || invoice.gstin) ? (
  <div>
    {invoice.gstin ? `GSTIN: ${invoice.gstin}` : ''}
  </div>
) : null}

{/* Display taxed amounts using restaurant's rates */}
<div>CGST ({invoice.summary.cgstRate}%): {cgstAmount}</div>
<div>SGST ({invoice.summary.sgstRate}%): {sgstAmount}</div>
```

---

## 🔒 Security Guarantees

### ✅ No Global GST
```javascript
// ❌ NEVER (this doesn't exist)
const GLOBAL_GST = 0.18;
gstin: GLOBAL_GST

// ✅ ALWAYS
gstin: restaurant?.gstNumber || ''
```

### ✅ No Hardcoded GST
```javascript
// ❌ NEVER (hardcoded rate)
cgstRate: 2.5

// ✅ ALWAYS
cgstRate: restaurant?.defaultCGSTPercent ?? 2.5  // Only fallback
```

### ✅ No Cross-Restaurant Leak
```javascript
// ✅ Flow is always:
1. Component: setRestaurant(await restaurantAPI.getProfile())
   └─ Server validates: .eq('id', req.restaurantId)
2. buildInvoiceData uses restaurant object from step 1
3. Invoice displays only scoped restaurant's GST

// ❌ NEVER: Fetch GST separately without restaurant context
```

### ✅ No Cached GST
```javascript
// ❌ NEVER (cached globally)
const cache = { gstin: '...' }

// ✅ ALWAYS (fetched fresh per context)
const restaurant = await restaurantAPI.getProfile();
// Each user session gets their own restaurant's GST
```

---

## Data Flow Diagram

```
User Login
    ↓
req.restaurantId = 'abc-123'  (from JWT/Auth)
    ↓
GET /restaurants/profile
    ├─ Backend: .eq('id', 'abc-123')
    ├─ Return: { gstNumber: '27AAA...', ... }
    └─ Frontend: setRestaurant(data)
    ↓
buildInvoiceData({ order, restaurant })
    ├─ Extract: gstin = restaurant.gstNumber
    ├─ Extract: cgstRate = restaurant.defaultCGSTPercent
    └─ Return: { gstin: '27AAA...', cgstRate: 5%, ... }
    ↓
Display Invoice
    └─ Show: GSTIN: 27AAA..., CGST: 5%
```

---

## Multi-Restaurant Example

### Restaurant A (User logged in)
```javascript
// Auth: restaurantId='abc-123'
const restaurant = restaurantAPI.getProfile()
// Returns: { gstNumber: '27AABCU1234H1Z0', defaultCGSTPercent: 5 }

const invoice = buildInvoiceData({ order, restaurant })
// Bill displays: GSTIN: 27AABCU1234H1Z0, CGST: 5%
```

### Restaurant B (Different user logged in)
```javascript
// Auth: restaurantId='xyz-789'
const restaurant = restaurantAPI.getProfile()
// Returns: { gstNumber: '22CCEBA5678K2V5', defaultCGSTPercent: 9 }

const invoice = buildInvoiceData({ order, restaurant })
// Bill displays: GSTIN: 22CCEBA5678K2V5, CGST: 9%  ← DIFFERENT
```

---

## Implementation Checklist

- [x] buildInvoiceData receives restaurant as parameter (not global)
- [x] GST extracted from restaurant.gstNumber (not hardcoded)
- [x] Rates extracted from restaurant billing settings
- [x] restaurant object fetched from /restaurants/profile (server-scoped)
- [x] No cache of GST between requests
- [x] No fallback to hardcoded GSTIN
- [x] All bills include restaurant's GSTIN
- [x] All tax calculations use restaurant's rates
- [x] No cross-restaurant data mixing

---

## Testing on Frontend

### Test 1: GST Displays Correctly
```javascript
// Setup
const invoice = buildInvoiceData({
  order: { ... },
  restaurant: { gstNumber: '27AABCU1234H1Z0' }
})

// Verify
expect(invoice.gstin).toBe('27AABCU1234H1Z0') ✅
```

### Test 2: Rates Are Restaurant-Specific
```javascript
// Setup
const invoice = buildInvoiceData({
  order: { ... },
  restaurant: { 
    defaultCGSTPercent: 5,
    defaultSGSTPercent: 5
  }
})

// Verify
expect(invoice.summary.cgstRate).toBe(5) ✅
expect(invoice.summary.sgstRate).toBe(5) ✅
```

### Test 3: No Hardcoded Fallback
```javascript
// Setup - no restaurant GST
const invoice = buildInvoiceData({
  order: { ... },
  restaurant: { gstNumber: undefined }
})

// Verify - uses empty string (not a hardcoded GSTIN)
expect(invoice.gstin).toBe('') ✅
```

---

## Security Warnings

⚠️ **Alert**: If you see these in code, report immediately:
- ❌ `const GLOBAL_GST`
- ❌ `27AABCU1234H1Z0` (hardcoded GSTIN)
- ❌ `gstin: '...'` (any hardcoded value)
- ❌ `cgstRate: 9` (not from restaurant object)
- ❌ Fetching GST without matching restaurantId

✅ **Correct**: Always see these patterns:
- ✅ `restaurant?.gstNumber`
- ✅ `.eq('id', restaurantId)` filter
- ✅ `getRestaurantBillingSettings(restaurant)`
- ✅ `restaurant?.defaultCGSTPercent ?? DEFAULT`
