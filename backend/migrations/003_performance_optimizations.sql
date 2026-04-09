-- Performance Optimization: Add Indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table ON orders(restaurant_id, table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status ON tables(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order ON kitchen_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_order_bills_order ON order_bills(order_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_restaurant ON table_assignments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_active ON table_assignments(restaurant_id, is_active);

-- Clean up old archived orders (older than 90 days)
DELETE FROM orders 
WHERE is_archived = true 
AND created_at < NOW() - INTERVAL '90 days'
AND restaurant_id IN (SELECT id FROM restaurants);

-- Clean up orphaned order_items (orders deleted but items remain)
DELETE FROM order_items 
WHERE order_id NOT IN (SELECT id FROM orders);

-- Clean up orphaned kitchen_tickets
DELETE FROM kitchen_tickets 
WHERE order_id NOT IN (SELECT id FROM orders);

-- Clean up orphaned order_bills
DELETE FROM order_bills 
WHERE order_id NOT IN (SELECT id FROM orders);

-- Analyze tables for query optimization
ANALYZE orders;
ANALYZE order_items;
ANALYZE tables;
ANALYZE kitchen_tickets;
ANALYZE order_bills;
ANALYZE table_assignments;
