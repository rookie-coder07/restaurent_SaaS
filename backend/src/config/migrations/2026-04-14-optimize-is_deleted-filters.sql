-- Optimize is_deleted filters for performance
-- This migration adds indexes on frequently filtered columns

-- Index on is_deleted for general queries
CREATE INDEX IF NOT EXISTS idx_orders_is_deleted on orders(is_deleted);

-- Composite index for getActiveOrderByTable query
-- Filters: restaurant_id, table_id, is_deleted, is_archived, payment_status, status
CREATE INDEX IF NOT EXISTS idx_orders_active_by_table 
  on orders(restaurant_id, table_id, is_deleted, is_archived, payment_status) 
  WHERE is_deleted = false AND is_archived = false AND payment_status != 'paid';

-- Index for getActiveTableStates query
-- Filters: restaurant_id, is_deleted, is_archived, payment_status, status
CREATE INDEX IF NOT EXISTS idx_orders_active_states 
  on orders(restaurant_id, is_deleted, is_archived, payment_status) 
  WHERE is_deleted = false AND is_archived = false AND payment_status != 'paid';

-- Index on orders by restaurant and created_at with is_deleted
-- For timeline queries
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_deleted 
  on orders(restaurant_id, created_at DESC, is_deleted);

-- Analyze table to update query planner
ANALYZE orders;
