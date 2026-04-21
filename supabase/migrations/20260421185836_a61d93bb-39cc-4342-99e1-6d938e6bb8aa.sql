-- Audit log table for admin lead actions
CREATE TABLE public.lead_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID,
  previous_status TEXT,
  new_status TEXT,
  previous_sold_to_dealer_id UUID,
  previous_sold_at TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
ON public.lead_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert audit log"
ON public.lead_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_lead_audit_log_lead_id ON public.lead_audit_log(lead_id);
CREATE INDEX idx_lead_audit_log_created_at ON public.lead_audit_log(created_at DESC);

-- RPC: reset selected leads to available (admin only)
CREATE OR REPLACE FUNCTION public.admin_reset_leads_to_available(_lead_ids UUID[], _reason TEXT DEFAULT NULL)
RETURNS TABLE(reset_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reset INTEGER := 0;
  v_skipped INTEGER := 0;
  r RECORD;
BEGIN
  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can reset leads';
  END IF;

  FOR r IN
    SELECT id, sold_status, sold_to_dealer_id, sold_at
    FROM public.leads
    WHERE id = ANY(_lead_ids)
  LOOP
    IF r.sold_status = 'available' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.lead_audit_log (
      lead_id, action, actor_user_id,
      previous_status, new_status,
      previous_sold_to_dealer_id, previous_sold_at, reason
    ) VALUES (
      r.id, 'reset_to_available', v_actor,
      r.sold_status, 'available',
      r.sold_to_dealer_id, r.sold_at, _reason
    );

    UPDATE public.leads
       SET sold_status = 'available',
           sold_to_dealer_id = NULL,
           sold_at = NULL
     WHERE id = r.id;

    v_reset := v_reset + 1;
  END LOOP;

  RETURN QUERY SELECT v_reset, v_skipped;
END;
$$;