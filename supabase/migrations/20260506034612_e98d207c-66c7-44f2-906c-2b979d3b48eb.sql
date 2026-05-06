CREATE OR REPLACE FUNCTION public.admin_recalculate_all_lead_prices()
RETURNS TABLE(updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_base numeric;
  v_t1 numeric;
  v_t2 numeric;
  v_veh numeric;
  v_trade numeric;
  v_bk numeric;
  v_appt numeric;
  v_count integer := 0;
  r record;
  v_price numeric;
  v_inc numeric;
BEGIN
  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can recalculate prices';
  END IF;

  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_base'),'15')::numeric INTO v_base;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_income_tier1'),'5')::numeric INTO v_t1;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_income_tier2'),'10')::numeric INTO v_t2;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_vehicle'),'5')::numeric INTO v_veh;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_trade'),'15')::numeric INTO v_trade;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_bankruptcy'),'15')::numeric INTO v_bk;
  SELECT COALESCE((SELECT value FROM platform_settings WHERE key='lead_price_appointment'),'10')::numeric INTO v_appt;

  FOR r IN SELECT id, income, vehicle_preference, trade_in, has_bankruptcy, appointment_time, price
           FROM leads WHERE sold_status = 'available'
  LOOP
    v_price := v_base;
    v_inc := COALESCE(r.income, 0);
    IF v_inc >= 5000 THEN
      v_price := v_price + v_t1 + v_t2;
    ELSIF v_inc >= 1800 THEN
      v_price := v_price + v_t1;
    END IF;
    IF COALESCE(TRIM(r.vehicle_preference), '') <> '' THEN
      v_price := v_price + v_veh;
    END IF;
    IF r.trade_in IS TRUE THEN v_price := v_price + v_trade; END IF;
    IF r.has_bankruptcy IS TRUE THEN v_price := v_price + v_bk; END IF;
    IF r.appointment_time IS NOT NULL THEN v_price := v_price + v_appt; END IF;

    IF r.price IS DISTINCT FROM v_price THEN
      UPDATE leads SET price = v_price WHERE id = r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;