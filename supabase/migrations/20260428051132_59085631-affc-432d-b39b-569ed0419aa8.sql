-- 1) New tracking columns on rejected_inbound_leads
ALTER TABLE public.rejected_inbound_leads
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recovered_lead_id uuid,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS normalized_email text,
  ADD COLUMN IF NOT EXISTS normalized_phone text;

-- Constrain status to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rejected_inbound_leads_status_check'
  ) THEN
    ALTER TABLE public.rejected_inbound_leads
      ADD CONSTRAINT rejected_inbound_leads_status_check
      CHECK (status IN ('pending', 'recovered', 'discarded'));
  END IF;
END$$;

-- 2) Trigger to auto-maintain normalized email/phone for fast retry lookups
CREATE OR REPLACE FUNCTION public.set_rejected_lead_normalized_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.normalized_email := lower(trim(coalesce(NEW.email, '')));
  IF NEW.normalized_email = '' THEN
    NEW.normalized_email := NULL;
  END IF;
  NEW.normalized_phone := nullif(public.normalize_phone_digits(coalesce(NEW.phone, '')), '');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_rejected_lead_normalized_fields ON public.rejected_inbound_leads;
CREATE TRIGGER trg_set_rejected_lead_normalized_fields
BEFORE INSERT OR UPDATE OF email, phone ON public.rejected_inbound_leads
FOR EACH ROW EXECUTE FUNCTION public.set_rejected_lead_normalized_fields();

-- Backfill normalized values for existing rows
UPDATE public.rejected_inbound_leads
SET email = email, phone = phone
WHERE normalized_email IS NULL AND normalized_phone IS NULL;

-- 3) Indexes for retry lookups + status filtering
CREATE INDEX IF NOT EXISTS idx_rejected_inbound_leads_status
  ON public.rejected_inbound_leads (status);
CREATE INDEX IF NOT EXISTS idx_rejected_inbound_leads_norm_email
  ON public.rejected_inbound_leads (normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rejected_inbound_leads_norm_phone
  ON public.rejected_inbound_leads (normalized_phone)
  WHERE normalized_phone IS NOT NULL;

-- 4) Allow service role to update rejected rows when retries succeed
DROP POLICY IF EXISTS "Service role can update rejected inbound leads"
  ON public.rejected_inbound_leads;
CREATE POLICY "Service role can update rejected inbound leads"
ON public.rejected_inbound_leads
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Allow admins to update too (so the manual retry/discard buttons work via authenticated client)
DROP POLICY IF EXISTS "Admins can update rejected inbound leads"
  ON public.rejected_inbound_leads;
CREATE POLICY "Admins can update rejected inbound leads"
ON public.rejected_inbound_leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));