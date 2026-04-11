-- Disable email verification requirement
-- Set email_confirmed_at for all existing users to enable immediate login

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Verify the update
SELECT COUNT(*) as users_updated FROM auth.users WHERE email_confirmed_at IS NOT NULL;
