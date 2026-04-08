
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID NOT NULL,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  price_paid NUMERIC NOT NULL,
  original_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all promo usage"
ON public.promo_code_usage FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dealers can view own promo usage"
ON public.promo_code_usage FOR SELECT
TO authenticated
USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE INDEX idx_promo_code_usage_dealer ON public.promo_code_usage(dealer_id);
CREATE INDEX idx_promo_code_usage_promo ON public.promo_code_usage(promo_code_id);
