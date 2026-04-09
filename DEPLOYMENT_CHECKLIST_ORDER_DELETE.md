# Order Deletion Fix - Deployment Checklist

## Pre-Deployment (Check Before Deploying)
- [ ] Backup Supabase database (use Supabase Console backup feature)
- [ ] Verify you have access to Supabase console
- [ ] Verify backend can be restarted
- [ ] Review [ORDER_DELETION_FIX.md](./ORDER_DELETION_FIX.md) for full context

## Step 1: Deploy Database Migration (5 minutes)

### Option A: Using Supabase SQL Editor (Recommended)
1. [ ] Log into [Supabase Console](https://app.supabase.com)
2. [ ] Select your restaurant SaaS project
3. [ ] Go to **SQL Editor** on the left sidebar
4. [ ] Click **New Query**
5. [ ] Copy the entire content from [backend/migrations/005_add-soft-delete-support.sql](./backend/migrations/005_add-soft-delete-support.sql)
6. [ ] Click **Run** button (⚡ icon)
7. [ ] Verify success - you should see:
   - `ALTER TABLE` statement completed successfully
   - No errors in the results panel
8. [ ] Run verification query to check columns exist:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('is_deleted', 'deleted_at', 'delete_reason')
ORDER BY ordinal_position;
```
Expected output: 3 rows showing the three new columns

### Option B: Using psql Command Line
```bash
# Get your Supabase connection string from Supabase Console
# Go to: Project Settings > Database > Connection Pooling > Connection string
psql $YOUR_SUPABASE_CONNECTION_STRING < backend/migrations/005_add-soft-delete-support.sql
```

## Step 2: Deploy Backend Code (5 minutes)

### 2a: Update Backend Service
```bash
# On your backend server
cd restaurent_SaaS/backend

# Pull latest changes (orderService.js updated)
git pull origin main
# OR copy the updated orderService.js manually

# Verify the changes are in place
grep "is_deleted, false" src/services/orderService.js
# Should find matches in getOrders, getKitchenOrders, getActiveOrderByTable

# Restart backend service
pm2 restart <your-app-name>
# OR
systemctl restart restaurant-backend
# OR
docker restart <backend-container-name>

# Verify backend is running
curl http://localhost:3001/health
# Should get 200 OK response
```

### 2b: Backend Changes Summary
- ✅ `softDeleteOrder()` updated to use `is_deleted` flag with fallback to hard delete
- ✅ `getOrders()` filters with `.eq('is_deleted', false)`
- ✅ `getKitchenOrders()` filters with `.eq('is_deleted', false)`
- ✅ `getActiveOrderByTable()` filters with `.eq('is_deleted', false)`

## Step 3: Frontend Verification (5 minutes)

### Clear Browser Cache
Users should do this to ensure they see latest code:
```
Chrome/Edge: Ctrl+Shift+Delete → Clear browsing data → All time
Firefox: Ctrl+Shift+Delete → Everything → Clear Now
Safari: Develop menu → Empty Web Inspector Caches
```

### Manual Testing (CRITICAL!)
1. [ ] **Create Test Order**
   - Login to manager dashboard
   - Create a new order manually or process QR code order
   - Note the order number/ID

2. [ ] **Verify Order Appears**
   - Go to Orders/Bills section
   - Confirm order shows in the list
   - Note the total count (e.g., "6,760 bills")

3. [ ] **Delete the Order**
   - Click delete icon on the test order
   - Confirm "Undo available for 2 seconds" message appears
   - Let timer expire or click final confirmation

4. [ ] **Verify Deletion (Same Session)**
   - Order should disappear from list
   - Total count should decrease by 1

5. [ ] **Verify Deletion (After Refresh) - KEY TEST**
   - Press F5 or Cmd+R to refresh page
   - **CRITICAL**: Order should still be gone
   - If order reappears, deletion fix didn't work
   - Check backend logs for errors

6. [ ] **Verify Related Records Deleted**
   - Check kitchen tickets list (if separate page)
   - Deleted order's items should not appear
   - Check any order bills/invoices
   - Verify table was marked available

## Step 4: Rollback Plan (In Case of Issues)

### If Deletion Still Not Working After Deploy:
```sql
-- Check if columns were added
SELECT * FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'is_deleted';
-- Should return 1 row

-- Check if soft-deleted orders exist
SELECT COUNT(*) FROM orders WHERE is_deleted = true;

-- If needed, revert soft deletes
UPDATE orders SET is_deleted = false WHERE is_deleted = true;

-- Or rollback migration entirely
ALTER TABLE orders DROP COLUMN IF EXISTS is_deleted CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS deleted_at CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS delete_reason CASCADE;
```

### If Backend Won't Start:
1. Check logs: `pm2 logs <app-name>`
2. Revert orderService.js to previous version
3. Restart backend
4. Investigate error in logs

## Step 5: Monitoring

### Create Test Orders Daily
- [ ] Set up daily test order deletion (ideally automated)
- [ ] Monitor that deleted orders stay deleted after page refresh
- [ ] Check logs for any deletion errors

### Review Logs
```bash
# Watch backend logs for deletion operations
pm2 logs <app-name> --lines 1000 | grep -i "delete"

# Should see messages like:
# "Soft-deleted order <ID>: [order-delete] ..."
# "Order deletion completed: <ID> :: ..."
```

### Monitor Performance
- [ ] Check query performance on orders list (should be fast)
- [ ] Monitor index usage: `SELECT * FROM pg_stat_user_indexes WHERE relname = 'orders';`
- [ ] Should see high index hit rate for `idx_orders_is_deleted`

## Step 6: Documentation

### Update Your Team
- [ ] Inform team that order deletion now works reliably
- [ ] Order deletions now persist across page refreshes
- [ ] Deleted orders can be audited (check `deleted_at` and `delete_reason` columns)

### Record What Was Done
- [ ] Document migration date and time
- [ ] Note any issues encountered
- [ ] Record testing results

## Estimated Timeline
- Database migration: **5 minutes**
- Backend restart: **2-5 minutes** (depends on deployment method)
- Manual testing: **10-15 minutes**
- **Total: 20-30 minutes**

## Success Criteria
- ✅ Order can be created in UI
- ✅ Order appears in orders list with correct total count
- ✅ Order can be deleted from UI
- ✅ Deleted order disappears from list
- ✅ **Key**: Deleted order stays gone after page refresh
- ✅ Related items/kitchen tickets removed
- ✅ Table marked available
- ✅ Backend logs show successful deletion

## Post-Deployment
- [ ] Monitor for 24 hours for any issues
- [ ] Check database logs for errors
- [ ] Verify no customer complaints about order deletion
- [ ] Plan to add undo functionality in next release (optional)

## Support
If issues arise:
1. Check backend logs first: `pm2 logs`
2. Verify database migration ran: Check Supabase SQL Editor history
3. Check RLS policies: Supabase Console → Tables → orders → RLS Policies
4. See [ORDER_DELETION_FIX.md](./ORDER_DELETION_FIX.md) "Important Notes" section for RLS considerations

---

**Deploy Date**: _______________
**Deployed By**: _______________
**Status**: ☐ Pending | ☐ In Progress | ☐ Complete | ☐ Rolled Back
**Issues**: _____________________________________________________

