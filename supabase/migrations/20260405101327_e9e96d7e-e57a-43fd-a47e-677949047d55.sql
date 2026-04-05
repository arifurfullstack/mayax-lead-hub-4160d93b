
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value text
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (true);
