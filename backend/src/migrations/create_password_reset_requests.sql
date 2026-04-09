BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  handled_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_user_id_pending ON password_reset_requests(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_restaurant_id ON password_reset_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_requested_at ON password_reset_requests(requested_at DESC);

COMMIT;
