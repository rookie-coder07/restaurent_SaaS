ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_source VARCHAR(20) DEFAULT 'manual';

UPDATE orders
SET order_source = CASE
  WHEN COALESCE(order_source, '') <> '' THEN order_source
  WHEN status = 'awaiting_waiter_approval' THEN 'qr'
  ELSE 'manual'
END
WHERE order_source IS NULL OR order_source = '';

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS locked_by_qr BOOLEAN DEFAULT false;

UPDATE tables
SET locked_by_qr = false
WHERE locked_by_qr IS NULL;
