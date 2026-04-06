ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2);

UPDATE orders
SET final_amount = COALESCE(final_amount, total_amount)
WHERE final_amount IS NULL;
