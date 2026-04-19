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

  -- Look up by email (case-insensitive) first
  IF new_email_norm <> '' THEN
    SELECT id, reference_code, notes, sold_status
      INTO match_id, match_ref, match_notes, match_sold_status
      FROM public.leads
     WHERE lower(trim(email)) = new_email_norm
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  -- Fallback to phone match (last 10 digits)
  IF match_id IS NULL AND length(new_phone_digits) >= 7 THEN
    SELECT id, reference_code, notes, sold_status
      INTO match_id, match_ref, match_notes, match_sold_status
      FROM public.leads
     WHERE public.normalize_phone_digits(phone) = new_phone_digits
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;

  -- If no match, allow the insert
  IF match_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build appended notes
  IF NEW.notes IS NOT NULL AND length(trim(NEW.notes)) > 0 THEN
    IF match_notes IS NOT NULL AND length(trim(match_notes)) > 0 THEN
      appended_notes := match_notes || E'\n\n[Duplicate insert merged] ' || NEW.notes;
    ELSE
      appended_notes := '[Duplicate insert merged] ' || NEW.notes;
    END IF;
  ELSE
    appended_notes := match_notes;
  END IF;

  -- If existing lead is still available, refresh its info
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

  -- Notify all admins (best-effort; ignore errors so insert never fails)
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

  -- Suppress the duplicate insert
  RETURN NULL;
END;
$function$;