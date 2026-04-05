
DROP POLICY "Authenticated users can insert platform settings" ON public.platform_settings;
DROP POLICY "Authenticated users can update platform settings" ON public.platform_settings;

CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
