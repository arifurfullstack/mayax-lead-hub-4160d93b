CREATE TABLE public.smtp_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL,
  error TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view smtp email log"
  ON public.smtp_email_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role can manage smtp email log"
  ON public.smtp_email_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_smtp_email_log_created_at ON public.smtp_email_log (created_at DESC);
CREATE INDEX idx_smtp_email_log_recipient ON public.smtp_email_log (recipient_email);