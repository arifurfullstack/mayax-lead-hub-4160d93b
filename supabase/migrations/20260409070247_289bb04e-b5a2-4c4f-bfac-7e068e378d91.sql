
ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;

COMMENT ON COLUMN public.promo_codes.discount_type IS 'flat = fixed price per lead, percentage = % off lead price';
COMMENT ON COLUMN public.promo_codes.discount_value IS 'For percentage type: the % discount (e.g. 10 = 10% off). For flat type: unused (flat_price is used instead).';
