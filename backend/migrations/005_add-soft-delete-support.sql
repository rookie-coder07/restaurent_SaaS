-- Migration: Add is_deleted column to orders table
-- Purpose: Enable soft-delete functionality since hard deletes are blocked by RLS

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- Create index for faster queries filtering out deleted orders
CREATE INDEX IF NOT EXISTS idx_orders_is_deleted 
ON orders(restaurant_id, is_deleted, created_at DESC)
WHERE is_deleted = false;

-- Create index for audit trail lookups
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at 
ON orders(restaurant_id, deleted_at DESC)
WHERE is_deleted = true;

-- Add comments for documentation
COMMENT ON COLUMN orders.is_deleted IS 'Soft delete flag - true means order is deleted but retained for audit';
COMMENT ON COLUMN orders.deleted_at IS 'Timestamp when order was deleted';
COMMENT ON COLUMN orders.delete_reason IS 'Reason provided when order was deleted';
