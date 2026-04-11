-- ============================================
-- REFRESH TOKENS TABLE
-- Stores JWT refresh tokens for secure token rotation
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  restaurant_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_family TEXT NOT NULL, -- For detecting token reuse attacks
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  
  -- Foreign key constraints
  CONSTRAINT fk_refresh_tokens_users 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_restaurants 
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id 
  ON refresh_tokens(user_id);
  
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_restaurant_id 
  ON refresh_tokens(restaurant_id);
  
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_family 
  ON refresh_tokens(token_family);
  
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked 
  ON refresh_tokens(is_revoked);
  
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
  ON refresh_tokens(expires_at);

-- Update RLS policies for refresh_tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own refresh tokens
CREATE POLICY refresh_tokens_select_policy 
  ON refresh_tokens 
  FOR SELECT 
  USING (auth.uid()::text = user_id::text OR 
         EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND owner_id = auth.uid()::int));

-- Policy: Users can only update their own refresh tokens
CREATE POLICY refresh_tokens_update_policy 
  ON refresh_tokens 
  FOR UPDATE 
  USING (auth.uid()::text = user_id::text OR 
         EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND owner_id = auth.uid()::int));

-- Policy: Admins can delete expired tokens
CREATE POLICY refresh_tokens_delete_policy 
  ON refresh_tokens 
  FOR DELETE 
  USING (is_revoked = TRUE OR expires_at < CURRENT_TIMESTAMP);

-- Function to clean up expired tokens automatically
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens 
  WHERE expires_at < CURRENT_TIMESTAMP 
    OR (is_revoked = TRUE AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- Schedule token cleanup (requires pg_cron extension if available)
-- SELECT cron.schedule('cleanup_expired_refresh_tokens', '0 3 * * *', 'SELECT cleanup_expired_refresh_tokens()');
