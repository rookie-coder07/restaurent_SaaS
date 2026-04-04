ALTER TABLE orders
ADD COLUMN IF NOT EXISTS display_order_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_orders_display_order_number
  ON orders(display_order_number);
