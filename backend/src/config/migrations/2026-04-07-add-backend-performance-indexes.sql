CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at
  ON orders(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table_updated_at
  ON orders(restaurant_id, table_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_created_at
  ON order_items(order_id, created_at ASC);
