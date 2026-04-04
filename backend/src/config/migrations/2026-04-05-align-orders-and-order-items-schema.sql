ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'dine-in';

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'price'
  ) THEN
    EXECUTE '
      UPDATE order_items
      SET unit_price = COALESCE(unit_price, price)
      WHERE unit_price IS NULL
    ';
  END IF;
END $$;
