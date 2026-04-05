CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_restaurant_display_order_number_unique
  ON orders(restaurant_id, display_order_number)
  WHERE display_order_number IS NOT NULL;
