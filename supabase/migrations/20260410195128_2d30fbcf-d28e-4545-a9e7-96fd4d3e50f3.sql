ALTER TABLE public.autopay_settings
ADD COLUMN vehicle_search text DEFAULT NULL,
DROP COLUMN IF EXISTS make,
DROP COLUMN IF EXISTS model;