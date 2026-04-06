CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'pos')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_by UUID,
  handled_by_role VARCHAR(20),
  handled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_restaurant_status
  ON password_reset_requests(restaurant_id, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_requests_pending_user
  ON password_reset_requests(user_id)
  WHERE status = 'pending';
