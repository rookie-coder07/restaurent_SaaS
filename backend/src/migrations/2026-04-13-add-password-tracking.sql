-- Migration: Add password update tracking for security
-- Purpose: Track when passwords change to invalidate old sessions
-- Date: 2026-04-13

-- Add password_updated_at column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS password_hash_cleared BOOLEAN DEFAULT false;

-- Add password_updated_at column to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS password_hash_cleared BOOLEAN DEFAULT false;

-- Create index for password tracking queries
CREATE INDEX IF NOT EXISTS idx_users_password_updated_at 
ON users(id, password_updated_at);

CREATE INDEX IF NOT EXISTS idx_restaurants_password_updated_at 
ON restaurants(id, password_updated_at);

-- Update existing records to mark password_hash as cleared for security
UPDATE users 
SET password_hash_cleared = true, password_updated_at = now() 
WHERE password_hash IS NULL OR password_hash = '';

UPDATE restaurants 
SET password_hash_cleared = true, password_updated_at = now() 
WHERE password_hash IS NULL OR password_hash = '';

-- Log migration completion
DO $$ 
BEGIN
  RAISE NOTICE 'Migration 2026-04-13-add-password-tracking.sql completed successfully';
  RAISE NOTICE 'Added password_updated_at and password_hash_cleared columns';
  RAISE NOTICE 'These columns track password changes for session invalidation';
END $$;
