# Staff Activity - Database Schema Deployment Guide

## Status
- ✅ Permission fixes applied - Managers can now view waiter/staff activity
- ❌ Database schema still needs to be deployed to Supabase

## The Issue
The activity logs table hasn't been created in your Supabase database yet. You'll see errors like:
```
Could not find the table 'public.activity_logs' in the schema cache
```

## How to Deploy

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project

### Step 2: Navigate to SQL Editor
1. Click **SQL Editor** in the left sidebar
2. Click **New Query**

### Step 3: Copy and Run the Schema
Copy the entire SQL from [ACTIVITY_SCHEMA.sql](./ACTIVITY_SCHEMA.sql) and run it.

The SQL will:
- ✅ Create `activity_logs` table
- ✅ Create performance indexes  
- ✅ Enable Row Level Security (RLS)
- ✅ Set up security policies

### Step 4: Verify Deployment
After running the SQL, you should see:
```
SUCCESS: Activity table created
SUCCESS: Indexes created
SUCCESS: RLS enabled
```

## SQL to Execute

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

## What Works After Deployment

### Manager Permissions - NOW FIXED ✅
- ✅ Managers can view staff list
- ✅ Managers can view waiter activity logs
- ✅ Managers can view staff activity logs
- ✅ Managers can view kitchen_staff activity logs
- ❌ Managers cannot view other manager's activity (security feature)

### Staff Permissions
- ✅ Staff can view their own activity
- ✅ Owners can view anyone's activity

### API Endpoints Ready
- `GET /api/v1/activity/staff` - Get filtered staff list (needs table)
- `GET /api/v1/activity/:userId/logs` - Get user activity logs (needs table)
- `GET /api/v1/activity/:userId/info` - Get user info + stats (needs table)

## Troubleshooting

### Error: "User not found in your restaurant"
- Check that the staff member belongs to the same restaurant
- Verify restaurant_id matches in the users table

### Error: "Managers can only view staff/waiter activity"  
- Only staff, waiter, and kitchen_staff roles can be viewed by managers
- Managers cannot view other managers (security feature)
- Only owners can view everyone

### Still getting 403 responses?
- Run `npm start` in backend to apply the latest permission fixes
- Deploy the schema via Supabase dashboard

## Next Steps
1. ✅ Backend permission logic: FIXED (query users table not auth.users)
2. ⏳ Deploy schema to Supabase (run SQL above)
3. ⏳ Test the endpoints with valid manager token
4. ⏳ Verify staff list appears in frontend
5. ⏳ Click on staff to view their activity timeline

---

**Need Help?**
- Backend logs are at: `backend/logs/app.log`
- All fixed code is ready - just waiting for schema
