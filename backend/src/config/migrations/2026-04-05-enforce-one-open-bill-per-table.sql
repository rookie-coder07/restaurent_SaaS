-- ✅ FIXED: Exclude soft-deleted orders from constraint so tables can accept new orders after deletion
DROP INDEX IF EXISTS public.idx_orders_one_open_bill_per_table CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_open_bill_per_table
ON public.orders (restaurant_id, table_id)
WHERE table_id IS NOT NULL
  AND COALESCE(is_deleted, false) = false
  AND COALESCE(payment_status, 'pending') <> 'paid'
  AND status IN ('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress');
