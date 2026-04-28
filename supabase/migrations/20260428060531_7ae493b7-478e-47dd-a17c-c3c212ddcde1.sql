ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trade_in_vehicle text;

ALTER TABLE public.rejected_inbound_leads
  ADD COLUMN IF NOT EXISTS trade_in_vehicle text;

DROP FUNCTION IF EXISTS public.get_marketplace_leads(uuid);

CREATE OR REPLACE FUNCTION public.get_marketplace_leads(requesting_dealer_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, reference_code text, buyer_type text, first_name text, last_name text, phone text, email text, credit_range_min integer, credit_range_max integer, income numeric, city text, province text, vehicle_preference text, vehicle_mileage integer, vehicle_price numeric, documents text[], ai_score integer, quality_grade text, price numeric, sold_status text, sold_to_dealer_id uuid, created_at timestamp with time zone, sold_at timestamp with time zone, notes text, appointment_time timestamp with time zone, trade_in boolean, has_bankruptcy boolean, trade_in_vehicle text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.reference_code, l.buyer_type,
    l.first_name,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.last_name ELSE '***' END,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.phone
         ELSE CASE
           WHEN l.phone IS NULL THEN NULL
           WHEN left(l.phone, 2) = '1 ' THEN left(l.phone, 6) || ' •••-••••'
           WHEN left(l.phone, 1) = '1' THEN left(l.phone, 4) || ' •••-••••'
           ELSE left(l.phone, 3) || ' •••-••••'
         END
    END,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.email ELSE 'xxx@xxxx.com' END,
    l.credit_range_min, l.credit_range_max, l.income, l.city, l.province,
    l.vehicle_preference, l.vehicle_mileage, l.vehicle_price, l.documents,
    l.ai_score, l.quality_grade, l.price, l.sold_status, l.sold_to_dealer_id,
    l.created_at, l.sold_at,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.notes ELSE NULL END,
    l.appointment_time,
    l.trade_in,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.has_bankruptcy ELSE NULL END,
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.trade_in_vehicle ELSE NULL END
  FROM public.leads l
  WHERE l.sold_status = 'available';
END;
$function$;

CREATE OR REPLACE FUNCTION public.dedupe_lead_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  match_id uuid;
  match_ref text;
  match_notes text;
  match_sold_status text;
  new_phone_digits text;
  new_email_norm text;
  appended_notes text;
BEGIN
  new_email_norm := lower(trim(coalesce(NEW.email, '')));
  new_phone_digits := public.normalize_phone_digits(NEW.phone);

  IF new_email_norm <> '' THEN
    SELECT id, reference_code, notes, sold_status
      INTO match_id, match_ref, match_notes, match_sold_status
      FROM public.leads
     WHERE lower(trim(email)) = new_email_norm
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  IF match_id IS NULL AND length(new_phone_digits) >= 7 THEN
    SELECT id, reference_code, notes, sold_status
      INTO match_id, match_ref, match_notes, match_sold_status
      FROM public.leads
     WHERE public.normalize_phone_digits(phone) = new_phone_digits
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  IF match_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.notes IS NOT NULL AND length(trim(NEW.notes)) > 0 THEN
    IF match_notes IS NOT NULL AND length(trim(match_notes)) > 0 THEN
      appended_notes := match_notes || E'\n\n[Duplicate insert merged] ' || NEW.notes;
    ELSE
      appended_notes := '[Duplicate insert merged] ' || NEW.notes;
    END IF;
  ELSE
    appended_notes := match_notes;
  END IF;

  IF match_sold_status = 'available' THEN
    UPDATE public.leads SET
      first_name = coalesce(NEW.first_name, first_name),
      last_name = coalesce(NEW.last_name, last_name),
      email = coalesce(NULLIF(trim(NEW.email), ''), email),
      phone = coalesce(NULLIF(trim(NEW.phone), ''), phone),
      city = coalesce(NEW.city, city),
      province = coalesce(NEW.province, province),
      buyer_type = coalesce(NEW.buyer_type, buyer_type),
      credit_range_min = coalesce(NEW.credit_range_min, credit_range_min),
      credit_range_max = coalesce(NEW.credit_range_max, credit_range_max),
      income = coalesce(NEW.income, income),
      vehicle_preference = coalesce(NEW.vehicle_preference, vehicle_preference),
      vehicle_mileage = coalesce(NEW.vehicle_mileage, vehicle_mileage),
      vehicle_price = coalesce(NEW.vehicle_price, vehicle_price),
      trade_in = coalesce(NEW.trade_in, trade_in),
      trade_in_vehicle = coalesce(NULLIF(trim(NEW.trade_in_vehicle), ''), trade_in_vehicle),
      has_bankruptcy = coalesce(NEW.has_bankruptcy, has_bankruptcy),
      quality_grade = coalesce(NEW.quality_grade, quality_grade),
      ai_score = coalesce(NEW.ai_score, ai_score),
      price = coalesce(NEW.price, price),
      appointment_time = coalesce(NEW.appointment_time, appointment_time),
      notes = appended_notes
    WHERE id = match_id;
  ELSE
    UPDATE public.leads SET
      notes = appended_notes
    WHERE id = match_id;
  END IF;

  BEGIN
    INSERT INTO public.notifications (dealer_id, title, message, link)
    SELECT
      d.id,
      '🔁 Duplicate lead merged',
      'Repeat submission for ' || coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '') ||
        ' (ref ' || coalesce(match_ref, '?') || ', status ' || coalesce(match_sold_status, '?') || ')' ||
        CASE WHEN new_email_norm <> '' THEN ' • ' || new_email_norm ELSE '' END,
      '/admin?lead=' || match_id::text
    FROM public.user_roles ur
    JOIN public.dealers d ON d.user_id = ur.user_id
    WHERE ur.role = 'admin';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NULL;
END;
$function$;

UPDATE public.leads
SET has_bankruptcy = true
WHERE has_bankruptcy IS DISTINCT FROM true
  AND notes ILIKE '%bankrupt%';