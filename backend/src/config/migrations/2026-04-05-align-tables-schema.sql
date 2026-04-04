ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS table_number INT;

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT 'main';

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS reserved_by VARCHAR(120);

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS reservation_time TIMESTAMP;

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);

ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tables'
      AND column_name = 'table_name'
  ) THEN
    EXECUTE '
      UPDATE public.tables
      SET table_number = COALESCE(
        table_number,
        NULLIF(regexp_replace(table_name, ''[^0-9]'', '''', ''g''), '''')::INT
      )
      WHERE table_number IS NULL
    ';
  END IF;
END $$;

UPDATE public.tables
SET location = COALESCE(NULLIF(location, ''), 'main')
WHERE location IS NULL OR location = '';

UPDATE public.tables
SET status = CASE
  WHEN status = 'vacant' THEN 'available'
  ELSE COALESCE(status, 'available')
END
WHERE status IS NULL OR status = 'vacant';

UPDATE public.tables
SET is_active = COALESCE(is_active, true)
WHERE is_active IS NULL;
