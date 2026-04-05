-- Restaurant Management SaaS - Supabase Schema

-- Create Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  address TEXT,
  gst_number VARCHAR(50),
  logo_url VARCHAR(500),
  cuisine_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  subscription_status VARCHAR(50) DEFAULT 'active',
  subscription_start TIMESTAMP DEFAULT now(),
  subscription_plan VARCHAR(100),
  subscription_renewal TIMESTAMP,
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  currency VARCHAR(10) DEFAULT 'INR',
  enable_gst BOOLEAN DEFAULT true,
  default_gst_percent DECIMAL(5, 2) DEFAULT 5,
  default_cgst_percent DECIMAL(5, 2) DEFAULT 2.5,
  default_sgst_percent DECIMAL(5, 2) DEFAULT 2.5,
  print_provider VARCHAR(50) DEFAULT 'browser',
  print_service_url TEXT,
  receipt_width_mm INTEGER DEFAULT 80,
  auto_print_kot BOOLEAN DEFAULT false,
  auto_print_bill BOOLEAN DEFAULT false,
  bill_printer JSONB DEFAULT '{"name":"","enabled":false}'::jsonb,
  kot_printers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Users Table (for staff)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'staff',
  assigned_tables UUID[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(restaurant_id, email)
);

-- Create Menu Categories Table
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  preparation_time INT,
  tags TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID,
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  total_amount DECIMAL(10, 2),
  display_order_number VARCHAR(50),
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  order_type VARCHAR(50) DEFAULT 'dine-in',
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  item_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Tables Table
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  capacity INT NOT NULL,
  location VARCHAR(100) DEFAULT 'main',
  status VARCHAR(50) DEFAULT 'available',
  reserved_by VARCHAR(120),
  reservation_time TIMESTAMP,
  qr_code VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Analytics Table
CREATE TABLE IF NOT EXISTS daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  total_customers INT DEFAULT 0,
  avg_table_turnover DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

-- Create Sessions Table for JWT tokens
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create Inventory Items Table
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

-- Create Menu Item Recipes Table
CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Inventory History Table
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

-- Create Indexes for Performance
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_display_order_number ON orders(display_order_number);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_daily_analytics_restaurant_id ON daily_analytics(restaurant_id);
CREATE INDEX idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX idx_menu_item_recipes_menu_item_id ON menu_item_recipes(menu_item_id);
CREATE INDEX idx_inventory_history_restaurant_id ON inventory_history(restaurant_id);
CREATE INDEX idx_inventory_history_item_id ON inventory_history(inventory_item_id);
