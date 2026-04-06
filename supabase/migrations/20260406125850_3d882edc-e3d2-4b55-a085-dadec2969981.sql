
-- payment_gateways table
CREATE TABLE public.payment_gateways (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gateways" ON public.payment_gateways FOR SELECT USING (true);
CREATE POLICY "Admins can insert gateways" ON public.payment_gateways FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update gateways" ON public.payment_gateways FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete gateways" ON public.payment_gateways FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- payment_requests table
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL,
  gateway text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  gateway_reference text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payment requests" ON public.payment_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers can view own payment requests" ON public.payment_requests FOR SELECT TO authenticated USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));
CREATE POLICY "Dealers can insert own payment requests" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

-- Seed default gateways
INSERT INTO public.payment_gateways (id, display_name, enabled, config, sort_order) VALUES
  ('stripe', 'Credit/Debit Card', false, '{}'::jsonb, 1),
  ('paypal', 'PayPal', false, '{"mode": "sandbox"}'::jsonb, 2),
  ('bank_transfer', 'Bank Transfer', false, '{"bank_name": "", "account_name": "", "account_number": "", "routing_number": "", "instructions": ""}'::jsonb, 3);
