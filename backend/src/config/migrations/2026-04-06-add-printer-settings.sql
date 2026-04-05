ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS print_provider VARCHAR(50) DEFAULT 'browser',
ADD COLUMN IF NOT EXISTS print_service_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_width_mm INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS auto_print_kot BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_print_bill BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bill_printer JSONB DEFAULT '{"name":"","enabled":false}'::jsonb,
ADD COLUMN IF NOT EXISTS kot_printers JSONB DEFAULT '[]'::jsonb;

UPDATE public.restaurants
SET
  print_provider = COALESCE(print_provider, 'browser'),
  receipt_width_mm = CASE
    WHEN receipt_width_mm IN (58, 80) THEN receipt_width_mm
    ELSE 80
  END,
  auto_print_kot = COALESCE(auto_print_kot, false),
  auto_print_bill = COALESCE(auto_print_bill, false),
  bill_printer = COALESCE(bill_printer, '{"name":"","enabled":false}'::jsonb),
  kot_printers = COALESCE(kot_printers, '[]'::jsonb)
WHERE
  print_provider IS NULL
  OR receipt_width_mm IS NULL
  OR auto_print_kot IS NULL
  OR auto_print_bill IS NULL
  OR bill_printer IS NULL
  OR kot_printers IS NULL;
