ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS default_service_charge NUMERIC(10,2) DEFAULT 0;

UPDATE public.restaurants
SET default_service_charge = COALESCE(default_service_charge, 0)
WHERE default_service_charge IS NULL;
