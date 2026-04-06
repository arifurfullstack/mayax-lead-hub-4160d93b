
-- subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  leads_per_month integer NOT NULL DEFAULT 100,
  delay_hours integer NOT NULL DEFAULT 24,
  glow_color text NOT NULL DEFAULT '0, 210, 210',
  accent_color text NOT NULL DEFAULT '#00d2d2',
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert plans" ON public.subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans" ON public.subscription_plans
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plans" ON public.subscription_plans
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- plan_features table
CREATE TABLE public.plan_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan features" ON public.plan_features
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert plan features" ON public.plan_features
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plan features" ON public.plan_features
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plan features" ON public.plan_features
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed the 4 default plans
INSERT INTO public.subscription_plans (name, price, leads_per_month, delay_hours, glow_color, accent_color, is_popular, sort_order)
VALUES
  ('BASIC', 249, 100, 24, '0, 210, 210', '#00d2d2', false, 1),
  ('PRO', 499, 250, 12, '120, 80, 255', '#a78bfa', false, 2),
  ('ELITE', 999, 500, 6, '0, 180, 255', '#38bdf8', false, 3),
  ('VIP', 1799, 1000, 0, '234, 179, 8', '#fbbf24', true, 4);

-- Seed features
INSERT INTO public.plan_features (plan_id, feature_text, sort_order)
SELECT sp.id, f.feature_text, f.sort_order
FROM public.subscription_plans sp
CROSS JOIN LATERAL (
  VALUES
    (CASE sp.name
      WHEN 'BASIC' THEN 'Normal priority'
      WHEN 'PRO' THEN 'Faster access'
      WHEN 'ELITE' THEN 'Early access'
      WHEN 'VIP' THEN 'Instant access to leads'
    END, 1),
    (CASE sp.name
      WHEN 'BASIC' THEN 'Standard support'
      WHEN 'PRO' THEN 'Priority support'
      WHEN 'ELITE' THEN 'Priority support'
      WHEN 'VIP' THEN 'Priority placement'
    END, 2)
) AS f(feature_text, sort_order);
