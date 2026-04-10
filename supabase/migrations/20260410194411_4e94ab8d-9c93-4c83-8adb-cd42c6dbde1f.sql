ALTER TABLE public.autopay_settings
ADD COLUMN income_min numeric DEFAULT NULL,
ADD COLUMN income_max numeric DEFAULT NULL;