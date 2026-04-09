#!/bin/bash
# Check Printer Settings Migration Status in Supabase

echo "================================"
echo "Printer Settings Migration Check"
echo "================================"
echo ""

# This is a bash script that can be run to check if tables exist
# If you can't run bash, copy the SQL below into Supabase SQL Editor

cat << 'EOF'
Run this SQL in Supabase SQL Editor to check if printer settings are deployed:

-- Check if printer columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN (
  'print_provider',
  'print_service_url', 
  'receipt_width_mm',
  'auto_print_kot',
  'auto_print_bill',
  'bill_printer',
  'kot_printers'
)
ORDER BY column_name;

-- If you see 7 rows with those column names, migration was successful ✅
-- If you see 0 rows, migration hasn't been run yet ❌

-- Quick fix: Run the migration SQL
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
  receipt_width_mm = CASE WHEN receipt_width_mm IN (58, 80) THEN receipt_width_mm ELSE 80 END,
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

EOF

echo ""
echo "✅ After running migration:"
echo "  1. Go to Settings page"
echo "  2. Scroll to 'Printer Routing' section"
echo "  3. Configure your printer settings"
echo "  4. Click 'Save settings'"
echo ""
