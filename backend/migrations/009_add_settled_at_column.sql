-- Add settled_at column to orders table for settlement tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP NULL;

-- Create index for performance when filtering settled orders
CREATE INDEX IF NOT EXISTS idx_orders_settled_at 
ON orders(restaurant_id, settled_at DESC);

-- Create index for settlement queries
CREATE INDEX IF NOT EXISTS idx_orders_status_settled
ON orders(restaurant_id, status, settled_at DESC);
