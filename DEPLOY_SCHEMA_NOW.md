# Quick Schema Deployment Steps

## ⚡ METHOD 1: Fastest Way - Supabase Dashboard

### Step 1: Open SQL Editor
1. Go to https://supabase.com/dashboard
2. Find your project: **pzjjuuqwpbfbfosgblzv**
3. Click **SQL Editor** in the left sidebar

### Step 2: Create New Query
1. Click **New Query**
2. Click **New SQL Snippet** (or paste directly in the editor)

### Step 3: Copy & Run the SQL
Copy this entire SQL block and paste it into the editor:

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see activity logs for their restaurant
CREATE POLICY "activity_logs_select_restaurant" ON activity_logs
FOR SELECT USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "activity_logs_insert_restaurant" ON activity_logs
FOR INSERT WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');
```

### Step 4: Execute
Click **Run** (or Ctrl+Enter)

### Step 5: Verify Success
You should see:
```
✓ CREATE TABLE
✓ CREATE INDEX (4x)
✓ ALTER TABLE
✓ CREATE POLICY (2x)
```

---

## ✅ What This Does

After deployment:
- ✅ Creates `activity_logs` table with proper structure
- ✅ Adds 4 performance indexes for fast queries  
- ✅ Enables Row Level Security (RLS)
- ✅ Sets up security policies for data isolation

---

## 🧪 Test After Deployment

After running the SQL, test that everything works:

1. Restart backend:
   ```powershell
   cd backend
   npm start
   ```

2. Open frontend and test:
   - Go to Staff Activity page
   - Login as manager
   - View staff list
   - Click on staff member to see activity

3. Check logs for the error:
   ```
   "Could not find the table 'public.activity_logs'" 
   ```
   This error should be GONE ✅

---

## 🔧 If You Need Help

### Error: "relation 'activity_logs' does not exist"
- Table wasn't created, re-run the SQL above

### Error: "Permission denied for schema public"
- Check your Supabase service role has correct permissions
- Try running SQL as the service role user

### Backend still showing error after SQL runs
- Stop and restart backend: `npm start`
- Clear browser cache
- Refresh the page

---

## ⏱️ Timeline
- **SQL Execution**: 1-2 seconds
- **Table Ready**: Immediate
- **Backend Restart**: ~5 seconds
- **Test**: 1 minute

**Total Time: ~5 minutes** ⚡

---

## 📚 Reference
- Supabase Dashboard: https://supabase.com/dashboard
- Your Project: https://supabase.com/dashboard/project/pzjjuuqwpbfbfosgblzv
- SQL Editor Docs: https://supabase.com/docs/guides/database/sql-editor
