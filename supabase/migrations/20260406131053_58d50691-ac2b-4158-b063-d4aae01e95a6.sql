
-- Usage tracking table
CREATE TABLE public.dealer_subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL,
  period_start date NOT NULL,
  leads_used integer NOT NULL DEFAULT 0,
  leads_limit integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dealer_id, period_start)
);

ALTER TABLE public.dealer_subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own usage" ON public.dealer_subscription_usage
  FOR SELECT TO authenticated
  USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Dealers can insert own usage" ON public.dealer_subscription_usage
  FOR INSERT TO authenticated
  WITH CHECK (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Dealers can update own usage" ON public.dealer_subscription_usage
  FOR UPDATE TO authenticated
  USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Admins can manage all usage" ON public.dealer_subscription_usage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add plan snapshot columns to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN plan_id uuid,
  ADD COLUMN leads_per_month integer,
  ADD COLUMN delay_hours integer;
