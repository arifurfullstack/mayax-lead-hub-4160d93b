
-- Add appointment_time to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS appointment_time timestamp with time zone NULL;

-- Add webhook/expiry settings to platform_settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('lead_expiry_hours', '24'),
  ('expiry_webhook_url', ''),
  ('appointment_webhook_url', ''),
  ('appointment_pre_send_minutes', '20'),
  ('inbound_webhook_secret', '')
ON CONFLICT (key) DO NOTHING;
