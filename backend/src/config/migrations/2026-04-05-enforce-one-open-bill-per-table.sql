CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_open_bill_per_table
ON public.orders (restaurant_id, table_id)
WHERE table_id IS NOT NULL
  AND COALESCE(payment_status, 'pending') <> 'paid'
  AND status IN ('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress');
