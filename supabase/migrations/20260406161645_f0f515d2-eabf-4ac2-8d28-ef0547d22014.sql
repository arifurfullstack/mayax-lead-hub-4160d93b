
-- Add optional JSONB column for file metadata [{name, path}]
ALTER TABLE public.leads
ADD COLUMN document_files jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', false);

-- Admins can do everything with lead documents
CREATE POLICY "Admins can manage lead documents"
ON storage.objects FOR ALL
USING (bucket_id = 'lead-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Dealers who purchased leads can download their documents
CREATE POLICY "Dealers can download purchased lead documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lead-documents'
  AND EXISTS (
    SELECT 1 FROM public.purchases p
    JOIN public.dealers d ON p.dealer_id = d.id
    WHERE d.user_id = auth.uid()
    AND p.lead_id::text = (storage.foldername(name))[1]
  )
);
