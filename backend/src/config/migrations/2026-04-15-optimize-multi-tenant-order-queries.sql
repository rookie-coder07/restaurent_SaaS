-- Optimize tenant-scoped order listings used by orders, bills, and takeaway pages.
-- Keeps the access pattern anchored on restaurant_id to preserve tenant isolation.

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at_desc
  ON orders (restaurant_id, created_at DESC);
