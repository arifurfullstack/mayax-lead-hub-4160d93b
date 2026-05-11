CREATE TABLE public.payment_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  payment_request_id uuid,
  dealer_id uuid,
  amount numeric,
  balance_after numeric,
  actor_user_id uuid,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_audit_log_created_at ON public.payment_audit_log (created_at DESC);
CREATE INDEX idx_payment_audit_log_payment_request ON public.payment_audit_log (payment_request_id);
CREATE INDEX idx_payment_audit_log_dealer ON public.payment_audit_log (dealer_id);
CREATE INDEX idx_payment_audit_log_event_type ON public.payment_audit_log (event_type);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.payment_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert audit log"
  ON public.payment_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role can manage audit log"
  ON public.payment_audit_log
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');