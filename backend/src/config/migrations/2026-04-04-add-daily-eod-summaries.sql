CREATE TABLE IF NOT EXISTS daily_eod_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  average_order_value DECIMAL(12, 2) DEFAULT 0,
  total_discounts DECIMAL(12, 2) DEFAULT 0,
  top_items JSONB DEFAULT '[]'::jsonb,
  low_performing_items JSONB DEFAULT '[]'::jsonb,
  peak_hours JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  summary_message TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (restaurant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_eod_summaries_restaurant_id
  ON daily_eod_summaries(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_daily_eod_summaries_date
  ON daily_eod_summaries(date);
