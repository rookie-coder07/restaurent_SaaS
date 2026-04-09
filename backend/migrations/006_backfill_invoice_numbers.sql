-- Migration: Backfill invoice_number column from notes JSON
-- Purpose: Extract invoiceNumber from notes.billing and populate the invoice_number column
-- This ensures data consistency and allows frontend to read from column instead of JSON

BEGIN;

-- Step 1: Update orders that have invoiceNumber in notes JSON but NULL in column
UPDATE orders
SET invoice_number = 
  CASE 
    -- Extract from notes if it contains billing.invoiceNumber
    WHEN notes::text LIKE '%"invoiceNumber"%' THEN
      (notes->'billing'->>'invoiceNumber')
    ELSE NULL
  END
WHERE 
  -- Only update if column is currently NULL and JSON has invoiceNumber
  invoice_number IS NULL
  AND notes IS NOT NULL
  AND notes::text LIKE '%"invoiceNumber"%'
  AND (notes->'billing'->>'invoiceNumber') IS NOT NULL
  AND (notes->'billing'->>'invoiceNumber') != '';

-- Step 2: Add NOT NULL constraint if there are any settled orders
-- First, find orders with payment_status = 'paid' that now have invoice_number
-- Verify the backfill worked
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN invoice_number IS NOT NULL THEN 1 END) as with_invoice_number,
  COUNT(CASE WHEN invoice_number IS NULL AND payment_status = 'paid' THEN 1 END) as missing_bills
FROM orders;

-- Step 3: Log any orders that couldn't be backfilled (for manual review)
SELECT id, invoice_number, notes->>'billing' as billing_meta
FROM orders
WHERE payment_status = 'paid'
AND invoice_number IS NULL
LIMIT 100;

COMMIT;
