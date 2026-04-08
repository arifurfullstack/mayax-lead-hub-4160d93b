
-- Promo codes table
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  flat_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_uses integer,
  times_used integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promo codes" ON public.promo_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view active promo codes" ON public.promo_codes FOR SELECT TO authenticated USING (is_active = true);

CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Track which dealer has an active promo code
CREATE TABLE public.dealer_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL,
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(dealer_id)
);

ALTER TABLE public.dealer_promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own promo" ON public.dealer_promo_codes FOR SELECT TO authenticated USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Dealers can apply promo" ON public.dealer_promo_codes FOR INSERT TO authenticated WITH CHECK (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Dealers can remove own promo" ON public.dealer_promo_codes FOR DELETE TO authenticated USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all dealer promos" ON public.dealer_promo_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
