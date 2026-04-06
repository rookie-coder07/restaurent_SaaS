ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_request_id_unique
  ON orders(request_id)
  WHERE request_id IS NOT NULL;
