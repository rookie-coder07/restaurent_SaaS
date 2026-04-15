-- Migration: Add password tracking columns for security
-- Purpose: Track when passwords change to invalidate old sessions
-- Date: 2026-04-15
-- Status: FINAL

-- ===== RESTAURANTS TABLE =====
-- Add password tracking columns to restaurants table
DO $$
BEGIN
  -- Check if password_updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='restaurants' AND column_name='password_updated_at'
  ) THEN
    ALTER TABLE restaurants 
    ADD COLUMN password_updated_at TIMESTAMP DEFAULT now();
    RAISE NOTICE 'Added password_updated_at column to restaurants table';
  END IF;

  -- Check if password_hash_cleared column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='restaurants' AND column_name='password_hash_cleared'
  ) THEN
    ALTER TABLE restaurants 
    ADD COLUMN password_hash_cleared BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added password_hash_cleared column to restaurants table';
  END IF;
END $$;

-- ===== USERS TABLE =====
-- Add password tracking columns to users table
DO $$
BEGIN
  -- Check if password_updated_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='password_updated_at'
  ) THEN
    ALTER TABLE users 
    ADD COLUMN password_updated_at TIMESTAMP DEFAULT now();
    RAISE NOTICE 'Added password_updated_at column to users table';
  END IF;

  -- Check if password_hash_cleared column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='password_hash_cleared'
  ) THEN
    ALTER TABLE users 
    ADD COLUMN password_hash_cleared BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added password_hash_cleared column to users table';
  END IF;
END $$;

-- ===== ADD INDEXES FOR PERFORMANCE =====
-- Create indexes for password tracking queries
CREATE INDEX IF NOT EXISTS idx_restaurants_password_updated_at 
ON restaurants(id, password_updated_at);

CREATE INDEX IF NOT EXISTS idx_users_password_updated_at 
ON users(id, password_updated_at);

-- Update existing records: Mark password_hash as cleared if no hash exists (security baseline)
UPDATE restaurants 
SET password_hash_cleared = true, password_updated_at = now() 
WHERE (password_hash IS NULL OR password_hash = '' OR password_hash = 'null')
AND password_hash_cleared = false;

UPDATE users 
SET password_hash_cleared = true, password_updated_at = now() 
WHERE (password_hash IS NULL OR password_hash = '' OR password_hash = 'null')
AND password_hash_cleared = false;

-- Log migration completion
DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration 011 completed successfully';
  RAISE NOTICE '   - Added password_updated_at column to restaurants and users';
  RAISE NOTICE '   - Added password_hash_cleared column to restaurants and users';
  RAISE NOTICE '   - Created indexes for password tracking queries';
  RAISE NOTICE '   - Updated existing records for security baseline';
END $$;
