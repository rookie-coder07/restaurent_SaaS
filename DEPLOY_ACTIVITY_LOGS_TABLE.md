# 🚀 Deploy Activity Logs Table - Copy & Paste Guide

## Current Status
✅ Staff Activity page is loading  
✅ Staff list is displaying  
✅ Permission logic is working  
❌ **ONLY BLOCKER**: `activity_logs` table missing in Supabase

## Deploy in 2 Minutes

### Step 1: Open SQL Editor
```
https://supabase.com/dashboard → Your Project → SQL Editor → New Query
```

### Step 2: Copy This SQL
```sql
-- Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

-- Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "activity_logs_select_restaurant" ON activity_logs
FOR SELECT USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY IF NOT EXISTS "activity_logs_insert_restaurant" ON activity_logs
FOR INSERT WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');
```

### Step 3: Run It
Click **Run** button (or Ctrl+Enter)

### Step 4: Verify Success
You should see green ✅ messages for:
- CREATE TABLE
- CREATE INDEX (×4)
- ALTER TABLE  
- CREATE POLICY (×2)

### Step 5: Restart Backend
```powershell
cd backend
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep -Seconds 2
npm start
```

### Step 6: Test It
1. Open Staff Activity page
2. Login as Manager
3. Click on staff member
4. Activity Timeline should now load (empty initially, but no more error!)

---

## ✅ What This Creates

| Component | Status |
|-----------|--------|
| Table: `activity_logs` | ✅ Will be created |
| Indexes (4) | ✅ Will be created |
| RLS (Row Level Security) | ✅ Will be enabled |
| Policies (2) | ✅ Will be created |

After this, your app will:
- ✅ Track staff activity
- ✅ Show activity timeline
- ✅ Display stats (orders, last active)
- ✅ Filter by role (manager only sees staff/waiters)

---

## 🔍 Verify After Deploying

Once backend restarts, check logs:
```
Should NOT see: "Could not find the table 'public.activity_logs'"
Should see: "Activity: Get logs for user..." (no errors)
```

---

## 💡 Tips

- **Copy-paste the SQL directly** - don't type it
- **Run all statements together** - don't run one by one  
- **You should see green checkmarks** after clicking Run
- **Restart backend** is required after SQL runs

---

## 🎯 After Deployment

Your Staff Activity page will fully work:
- Staff list ✅
- Activity logs ✅
- Manager permissions ✅
- Performance stats ✅
- Activity tracking ✅
