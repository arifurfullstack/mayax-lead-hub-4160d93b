
-- Drop existing function so we can change its signature/return type
DROP FUNCTION IF EXISTS public.get_marketplace_leads(uuid);
DROP FUNCTION IF EXISTS public.get_marketplace_leads(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_marketplace_leads(
  requesting_dealer_id uuid DEFAULT NULL::uuid,
  include_sold_hours integer DEFAULT 0
)
 RETURNS TABLE(
   id uuid, reference_code text, buyer_type text,
   first_name text, last_name text, phone text, email text,
   credit_range_min integer, credit_range_max integer, income numeric,
   city text, province text,
   vehicle_preference text, vehicle_mileage integer, vehicle_price numeric,
   documents text[], ai_score integer, quality_grade text, price numeric,
   sold_status text, sold_to_dealer_id uuid,
   created_at timestamp with time zone, sold_at timestamp with time zone,
   notes text, appointment_time timestamp with time zone,
   trade_in boolean, has_bankruptcy boolean, trade_in_vehicle text,
   buyer_dealership_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  hrs integer := GREATEST(coalesce(include_sold_hours, 0), 0);
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
    CASE WHEN is_admin OR l.sold_to_dealer_id = requesting_dealer_id THEN l.trade_in_vehicle ELSE NULL END,
    CASE WHEN l.sold_status = 'sold' AND is_admin THEN d.dealership_name ELSE NULL END
  FROM public.leads l
  LEFT JOIN public.dealers d ON d.id = l.sold_to_dealer_id
  WHERE l.sold_status = 'available'
     OR (
       hrs > 0
       AND l.sold_status = 'sold'
       AND l.sold_at IS NOT NULL
       AND l.sold_at > now() - make_interval(hours => hrs)
     );
END;
$function$;

-- Seed default platform setting for purchase throttle (0 = disabled)
INSERT INTO public.platform_settings (key, value)
VALUES ('lead_minimum_marketplace_seconds', '0')
ON CONFLICT (key) DO NOTHING;
