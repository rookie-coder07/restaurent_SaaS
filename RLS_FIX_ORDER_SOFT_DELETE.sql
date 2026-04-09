-- RLS Policy Fix for Order Soft Delete
-- Purpose: Allow UPDATE operations on orders table for soft-delete functionality
-- This should be executed in Supabase SQL Editor

-- Step 1: Drop existing restrictive policy if it exists (optional - only if necessary)
-- DROP POLICY IF EXISTS "Allow authenticated users to update own orders" ON orders;
-- DROP POLICY IF EXISTS "Allow update to orderers" ON orders;

-- Step 2: Create/Update policy to allow service role and authenticated users to UPDATE orders
CREATE POLICY "Allow soft delete updates on orders"
ON orders
FOR UPDATE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id')
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Step 3: Verify RLS is enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'orders'
AND policyname LIKE '%soft%delete%'
ORDER BY policyname;

-- Step 5: Test query - this should work now
-- BEGIN;
-- UPDATE orders 
-- SET is_deleted = true, deleted_at = NOW()
-- WHERE id = 'test-order-id' AND restaurant_id = auth.jwt() ->> 'restaurant_id';
-- ROLLBACK; -- Remove ROLLBACK to actually apply
