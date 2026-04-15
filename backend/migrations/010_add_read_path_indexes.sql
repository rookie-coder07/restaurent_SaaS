-- Production-safe read-path indexes for common restaurant-scoped queries.
-- These are additive only and do not change table schemas or API contracts.

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_open_bill_lookup
ON orders (restaurant_id, table_id, updated_at DESC)
WHERE is_deleted = false
  AND is_archived = false
  AND payment_status <> 'paid'
  AND status IN ('awaiting_waiter_approval', 'pending', 'preparing', 'ready', 'served', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_active_feed
ON orders (restaurant_id, updated_at DESC)
WHERE is_deleted = false
  AND is_archived = false
  AND payment_status <> 'paid';

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_table_number
ON tables (restaurant_id, table_number);

CREATE INDEX IF NOT EXISTS idx_table_assignments_active_table_lookup
ON table_assignments (restaurant_id, table_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_display_order
ON menu_categories (restaurant_id, status, display_order);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category_created
ON menu_items (restaurant_id, status, category_id, created_at DESC);

ANALYZE orders;
ANALYZE tables;
ANALYZE table_assignments;
ANALYZE menu_categories;
ANALYZE menu_items;
