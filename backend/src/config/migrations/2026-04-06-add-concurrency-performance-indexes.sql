CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_tables_status
  ON tables(status);
