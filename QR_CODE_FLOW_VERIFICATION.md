# QR Code Flow - Complete Verification Guide

## 🎯 Problem Solved

**Issue**: Scanning QR codes resulted in "404 Route not found: GET /menu"

**Root Cause**: QR codes were pointing to the Render backend (`https://resturant-saas.onrender.com/menu`) instead of the Vercel frontend (`https://restaurentsaas.vercel.app/menu`)

**Solution**: Updated QR code generation to use the correct frontend URL

---

## 📊 Complete QR-to-Order Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER SCANS QR CODE                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  QR CONTAINS: https://restaurentsaas.vercel.app/menu?table=1    │
│  ✅ Points to FRONTEND (Vercel), not backend                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│         FRONTEND ROUTE ACTIVATES: /menu?table=1                 │
│    (React Router matches CustomerMenu component)                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│      CustomerMenu Component Extracts table=1                    │
│      Calls: customerAPI.getPublicMenu(1)                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND CALLS BACKEND API:                                    │
│  GET https://resturant-saas.onrender.com/api/v1/customer/      │
│      menu/items?table=1                                         │
│  ✅ Points to BACKEND API (correctly under /api/)              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     BACKEND LOOKUP: GET /v1/customer/menu/items?table=1        │
│     1. Query tables WHERE table_number=1                        │
│     2. Extract restaurant_id from table                         │
│     3. Fetch menu items for that restaurant                     │
│     4. Return as JSON                                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     FRONTEND DISPLAYS MENU                                      │
│     Customer browses items, adds to cart                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     CUSTOMER PLACES ORDER                                       │
│     POST /api/v1/customer/orders                                │
│     Backend saves order → Kitchen sees it real-time             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│     ORDER CONFIRMATION                                          │
│     Customer redirected to /order-status?order=<id>             │
│     Shows real-time order progress                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Key Components 

### Frontend QR Code Generation
**Files**: 
- `frontend/src/components/QRCodeModal.jsx`
- `frontend/src/utils/qrCodeGenerator.js`

**Code**:
```javascript
// Production URL (Vercel)
const baseUrl = import.meta.env.PROD 
  ? 'https://restaurentsaas.vercel.app'  // ✅ CORRECT - Frontend
  : window.location.origin;

const qrValue = `${baseUrl}/menu?table=${table.tableNumber}`;
```

### Frontend Route Definition
**File**: `frontend/src/App.jsx`
```jsx
<Route path="/menu" element={<CustomerMenu />} />
```

### Backend Customer Menu Endpoint
**File**: `backend/src/routes/customer.js`
```javascript
router.get('/menu/items', async (req, res) => {
  // 1. Get table number from ?table=X
  // 2. Look up restaurant_id from tables WHERE table_number=X
  // 3. Fetch menu items for that restaurant
  // 4. Return JSON response
});
```

---

## ✅ Verification Checklist

### 1. **QR Code Points to Frontend**
- [ ] QR code URL contains: `https://restaurentsaas.vercel.app/menu?table=1`
- [ ] NOT: `https://resturant-saas.onrender.com/menu` (❌ backend)
- [ ] Test: Scan QR or manually visit URL in browser

### 2. **Frontend Route Works**
- [ ] Page loads at `/menu?table=1`
- [ ] CustomerMenu component renders
- [ ] Console shows: "🔍 CustomerMenu loaded - Query params: {table: '1'}"
- [ ] Console shows: "📊 Table number from QR: 1"

### 3. **Frontend Calls Backend API**
- [ ] Open DevTools → Network tab
- [ ] Look for: `GET .../api/v1/customer/menu/items?table=1`
- [ ] Status should be: **200 OK** ✅
- [ ] Response contains menu items array

### 4. **Backend Lookup Works**
- [ ] Monitor backend logs (Render dashboard or local)
- [ ] Should see:
  ```
  📋 Customer menu request - Table: 1
  🔍 Looking up table 1...
  ✅ Found restaurant: [restaurant-id] for table 1
  📦 Fetching menu items for restaurant [id]...
  ✅ Retrieved X menu items
  ```

### 5. **Error Scenarios**
| Scenario | Expected Response |
|----------|------------------|
| Valid table | 200 + menu items |
| Invalid table | 404 + "Table X not found" |
| No ?table param | 400 + "Table number required" |
| DB error | 500 + "Failed to load menu" |

---

## 🐛 Debugging - If It Still Doesn't Work

### **In Browser (DevTools)**
```javascript
// Check why menu isn't loading
console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
// Should be: https://resturant-saas.onrender.com/api

// Check QR value
const qrValue = 'https://restaurentsaas.vercel.app/menu?table=1';
console.log('QR Points To:', qrValue);

// Check if table param exists
const urlParams = new URLSearchParams(window.location.search);
console.log('Table param:', urlParams.get('table'));
```

### **In DevTools Network Tab**
1. Filter by "customer/menu/items"
2. Click the request
3. Check:
   - **URL**: `/api/v1/customer/menu/items?table=1` ✅
   - **Status**: 200 ✅
   - **Response**: `{statusCode: 200, data: [...], success: true}` ✅

### **In Backend Logs**
```bash
# SSH into Render backend
tail -f logs/app.log

# Should show:
📋 Customer menu request - Table: 1
✅ Retrieved X menu items
```

---

## 📋 Environment Variables

### **Frontend (.env.production)**
```dotenv
VITE_API_BASE_URL=https://resturant-saas.onrender.com/api
VITE_SUPABASE_URL=https://pzjjuuqwpbfbfosgblzv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### **Frontend QR Generation** (in code)
```javascript
// Development
const baseUrl = 'http://localhost:5173'  // Local frontend

// Production  
const baseUrl = 'https://restaurentsaas.vercel.app'  // Vercel frontend
```

---

## 🚀 Deployment Checklist

- [ ] **Frontend Deployed to Vercel**
  - URL: `https://restaurentsaas.vercel.app`
  - Environment variables set in Vercel dashboard
  
- [ ] **Backend Deployed to Render**
  - URL: `https://resturant-saas.onrender.com`
  - Environment variables set in Render dashboard

- [ ] **QR Code Regenerated** (after deploying)
  - Old QRs point to old URLs, regenerate in admin panel
  - New QRs contain correct Vercel frontend URL

- [ ] **CORS Configured** on backend
  - ✅ Backend allows requests from `https://restaurentsaas.vercel.app`
  - Found in `backend/src/app.js` corsOptions

- [ ] **Database Tables Exist**
  - `tables` table must exist with `table_number` field
  - `menu_items` table must exist for the restaurant
  - Each table must have valid `restaurant_id`

---

## 📝 Summary

| Component | Deployment | URL |
|-----------|------------|-----|
| **Frontend** | Vercel | `https://restaurentsaas.vercel.app` |
| **Backend API** | Render | `https://resturant-saas.onrender.com` |
| **QR Destination** | → Frontend | `/menu?table=X` |
| **API Calls** | → Backend | `/api/v1/customer/menu/items?table=X` |

✅ **The flow is now correctly set up!**

