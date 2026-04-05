ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS assigned_tables UUID[] DEFAULT '{}';
