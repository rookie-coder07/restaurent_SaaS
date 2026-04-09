-- Performance: RLS Policy Optimization
-- Drop inefficient policies and create optimized ones with proper indexes

-- Orders table RLS optimization
DROP POLICY IF EXISTS "orders_select" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_delete" ON orders;

CREATE POLICY "orders_select" ON orders FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "orders_insert" ON orders FOR INSERT
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "orders_update" ON orders FOR UPDATE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id')
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "orders_delete" ON orders FOR DELETE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Tables RLS optimization
DROP POLICY IF EXISTS "tables_select" ON tables;
DROP POLICY IF EXISTS "tables_insert" ON tables;
DROP POLICY IF EXISTS "tables_update" ON tables;

CREATE POLICY "tables_select" ON tables FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "tables_insert" ON tables FOR INSERT
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "tables_update" ON tables FOR UPDATE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id')
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Order items RLS optimization
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_update" ON order_items;

CREATE POLICY "order_items_select" ON order_items FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "order_items_insert" ON order_items FOR INSERT
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "order_items_update" ON order_items FOR UPDATE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id')
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Users RLS (name lookup only)
DROP POLICY IF EXISTS "users_select_names" ON users;
CREATE POLICY "users_select_names" ON users FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Menu items RLS
DROP POLICY IF EXISTS "menu_items_select" ON menu_items;
CREATE POLICY "menu_items_select" ON menu_items FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Table assignments RLS
DROP POLICY IF EXISTS "table_assignments_select" ON table_assignments;
DROP POLICY IF EXISTS "table_assignments_insert" ON table_assignments;
DROP POLICY IF EXISTS "table_assignments_update" ON table_assignments;

CREATE POLICY "table_assignments_select" ON table_assignments FOR SELECT
USING (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "table_assignments_insert" ON table_assignments FOR INSERT
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

CREATE POLICY "table_assignments_update" ON table_assignments FOR UPDATE
USING (restaurant_id = auth.jwt() ->> 'restaurant_id')
WITH CHECK (restaurant_id = auth.jwt() ->> 'restaurant_id');

-- Ensure all critical indexes exist
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_desc ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table ON orders(restaurant_id, table_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_payment ON orders(restaurant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status ON tables(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_restaurant_active ON table_assignments(restaurant_id, is_active);

-- Clean query stats (vacuum analyze)
ANALYZE orders;
ANALYZE order_items;
ANALYZE tables;
ANALYZE users;
ANALYZE menu_items;
ANALYZE table_assignments;
