-- Add explicit auth identity mapping columns for safe reconciliation.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id
ON public.users (supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_restaurants_supabase_user_id
ON public.restaurants (supabase_user_id);

-- Safe backfill only when the database primary key already matches auth.users.id.
UPDATE public.users AS u
SET supabase_user_id = u.id
WHERE u.supabase_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.users AS au
    WHERE au.id = u.id
  );

UPDATE public.restaurants AS r
SET supabase_user_id = r.id
WHERE r.supabase_user_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.users AS au
    WHERE au.id = r.id
  );
