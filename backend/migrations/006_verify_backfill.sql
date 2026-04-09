-- Verification queries for invoice_number backfill
-- Run these to verify the migration worked correctly

-- 1. Count how many orders now have invoice numbers
SELECT 
  COUNT(*) as total_paid_orders,
  COUNT(CASE WHEN invoice_number IS NOT NULL THEN 1 END) as with_invoice_number,
  ROUND(100.0 * COUNT(CASE WHEN invoice_number IS NOT NULL THEN 1 END) / COUNT(*), 2) as coverage_percent
FROM orders
WHERE payment_status = 'paid';

-- 2. Find any paid orders that still don't have invoice numbers (should be empty)
SELECT id, invoice_number, payment_status, total_amount
FROM orders
WHERE payment_status = 'paid'
AND invoice_number IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 3. Sample of orders that were successfully backfilled
SELECT 
  id,
  invoice_number,
  total_amount,
  payment_status,
  created_at
FROM orders
WHERE invoice_number IS NOT NULL
AND payment_status = 'paid'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verify consistency: Compare column value with JSON value
SELECT 
  id,
  invoice_number as column_value,
  (notes->'billing'->>'invoiceNumber') as json_value,
  CASE 
    WHEN invoice_number = (notes->'billing'->>'invoiceNumber') THEN 'Match ✓'
    WHEN invoice_number IS NOT NULL AND (notes->'billing'->>'invoiceNumber') IS NOT NULL THEN 'Mismatch ⚠'
    ELSE 'One is null'
  END as consistency
FROM orders
WHERE payment_status = 'paid'
AND (invoice_number IS NOT NULL OR (notes->'billing'->>'invoiceNumber') IS NOT NULL)
LIMIT 50;

-- 5. Statistics summary
SELECT 
  'Total Orders' as metric, COUNT(*) as value FROM orders
UNION ALL
SELECT 'Paid Orders', COUNT(*) FROM orders WHERE payment_status = 'paid'
UNION ALL
SELECT 'Paid with Invoice', COUNT(*) FROM orders WHERE payment_status = 'paid' AND invoice_number IS NOT NULL
UNION ALL
SELECT 'Unpaid Orders', COUNT(*) FROM orders WHERE payment_status != 'paid'
UNION ALL
SELECT 'With Invoice (any status)', COUNT(*) FROM orders WHERE invoice_number IS NOT NULL;
