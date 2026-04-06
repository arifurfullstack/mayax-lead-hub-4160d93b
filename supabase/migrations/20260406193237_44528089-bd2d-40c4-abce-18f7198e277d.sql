
-- Create storage bucket for brand assets (logo, favicon)
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);

-- Public read access
CREATE POLICY "Brand assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');

-- Only admins can upload brand assets
CREATE POLICY "Admins can upload brand assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can update brand assets
CREATE POLICY "Admins can update brand assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can delete brand assets
CREATE POLICY "Admins can delete brand assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'brand-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
