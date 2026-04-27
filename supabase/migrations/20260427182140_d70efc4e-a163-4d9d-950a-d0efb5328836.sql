CREATE TABLE public.rejected_inbound_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_id TEXT,
  reference_code TEXT,
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT 'validation',
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  province TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_ip TEXT,
  user_agent TEXT
);

CREATE INDEX idx_rejected_inbound_leads_created_at ON public.rejected_inbound_leads (created_at DESC);

ALTER TABLE public.rejected_inbound_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rejected inbound leads"
ON public.rejected_inbound_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete rejected inbound leads"
ON public.rejected_inbound_leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role can insert rejected inbound leads"
ON public.rejected_inbound_leads
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');