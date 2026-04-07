
DROP FUNCTION IF EXISTS public.get_marketplace_leads(uuid);

CREATE OR REPLACE FUNCTION public.get_marketplace_leads(requesting_dealer_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(
   id uuid, reference_code text, buyer_type text, first_name text, last_name text,
   phone text, email text, credit_range_min integer, credit_range_max integer,
   income numeric, city text, province text, vehicle_preference text,
   vehicle_mileage integer, vehicle_price numeric, documents text[],
   ai_score integer, quality_grade text, price numeric, sold_status text,
   sold_to_dealer_id uuid, created_at timestamp with time zone,
   sold_at timestamp with time zone, vehicle_make text, vehicle_model text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.reference_code, l.buyer_type,
    CASE WHEN l.sold_to_dealer_id = requesting_dealer_id THEN l.first_name ELSE '***' END,
    CASE WHEN l.sold_to_dealer_id = requesting_dealer_id THEN l.last_name ELSE '***' END,
    CASE WHEN l.sold_to_dealer_id = requesting_dealer_id THEN l.phone ELSE '+XX-XXX-XXXX' END,
    CASE WHEN l.sold_to_dealer_id = requesting_dealer_id THEN l.email ELSE 'xxx@xxxx.com' END,
    l.credit_range_min, l.credit_range_max, l.income, l.city, l.province,
    l.vehicle_preference, l.vehicle_mileage, l.vehicle_price, l.documents,
    l.ai_score, l.quality_grade, l.price, l.sold_status, l.sold_to_dealer_id,
    l.created_at, l.sold_at, l.vehicle_make, l.vehicle_model
  FROM public.leads l;
END;
$function$;
