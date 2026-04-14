
CREATE TABLE public.lead_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  vehicle_type TEXT,
  city TEXT,
  province TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own requests"
  ON public.lead_requests FOR SELECT
  USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Dealers can insert own requests"
  ON public.lead_requests FOR INSERT
  WITH CHECK (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Dealers can update own requests"
  ON public.lead_requests FOR UPDATE
  USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Admins can manage all lead requests"
  ON public.lead_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_lead_requests_updated_at
  BEFORE UPDATE ON public.lead_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
