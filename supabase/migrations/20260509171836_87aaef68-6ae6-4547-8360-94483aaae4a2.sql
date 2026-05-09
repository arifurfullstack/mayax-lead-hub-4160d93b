ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS idx_payment_requests_gateway_created
  ON public.payment_requests (gateway, created_at DESC);