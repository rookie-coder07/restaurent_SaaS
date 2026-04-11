-- Migration: Make password_hash nullable (Supabase Auth now manages passwords)
-- Date: 2026-04-10

-- Update restaurants table - make password_hash nullable
ALTER TABLE IF EXISTS restaurants
ALTER COLUMN password_hash DROP NOT NULL;

-- Update restaurants table - set existing password_hash to empty string if null
UPDATE restaurants SET password_hash = '' WHERE password_hash IS NULL;

-- Update users table - make password_hash nullable  
ALTER TABLE IF EXISTS users
ALTER COLUMN password_hash DROP NOT NULL;

-- Update users table - set existing password_hash to empty string if null
UPDATE users SET password_hash = '' WHERE password_hash IS NULL;
