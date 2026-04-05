ALTER TABLE public.tables
ALTER COLUMN table_number TYPE TEXT USING table_number::TEXT;
