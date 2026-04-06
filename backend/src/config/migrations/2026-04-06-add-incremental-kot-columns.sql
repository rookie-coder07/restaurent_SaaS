CREATE TABLE IF NOT EXISTS kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  ticket_type VARCHAR(20) NOT NULL DEFAULT 'send',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sent_to_kitchen BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS kot_id UUID REFERENCES kitchen_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_id
  ON kitchen_tickets(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_sent_to_kitchen
  ON order_items(order_id, sent_to_kitchen);
