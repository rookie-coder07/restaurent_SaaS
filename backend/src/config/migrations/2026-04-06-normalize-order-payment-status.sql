UPDATE orders
SET payment_status = CASE
  WHEN LOWER(COALESCE(payment_status, '')) = 'paid' THEN 'paid'
  WHEN LOWER(COALESCE(payment_status, '')) = 'failed' THEN 'failed'
  ELSE 'pending'
END;

UPDATE orders
SET payment_method = CASE
  WHEN LOWER(COALESCE(payment_method, '')) = 'upi' THEN 'upi'
  ELSE 'cash'
END;

ALTER TABLE orders
  ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE orders
  ALTER COLUMN payment_method SET DEFAULT 'cash';

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'upi'));
