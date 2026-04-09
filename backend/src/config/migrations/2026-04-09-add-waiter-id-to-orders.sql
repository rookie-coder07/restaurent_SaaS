-- Add waiter_id column to orders table to track which waiter created/handled the order

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_waiter_id
  ON orders(restaurant_id, waiter_id);

-- Allow null waiter_id for orders created via QR code or POS without waiter assignment
