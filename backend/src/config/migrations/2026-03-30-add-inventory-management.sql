CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  quantity DECIMAL(12, 4) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  threshold DECIMAL(12, 4) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT now(),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  quantity_before DECIMAL(12, 4) DEFAULT 0,
  quantity_change DECIMAL(12, 4) DEFAULT 0,
  quantity_after DECIMAL(12, 4) DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  reason TEXT,
  source VARCHAR(100) DEFAULT 'manual',
  reference_id VARCHAR(120),
  created_by UUID,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_recipes_menu_item_id ON menu_item_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_restaurant_id ON inventory_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_item_id ON inventory_history(inventory_item_id);
