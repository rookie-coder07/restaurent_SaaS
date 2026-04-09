-- Add invoice_number column to orders table for bill tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);

-- Create performance indexes for bills loading
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON orders(restaurant_id, status, created_at DESC)
  WHERE payment_status = 'paid';

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_payment_status_created
  ON orders(restaurant_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_invoice_number
  ON orders(restaurant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;
