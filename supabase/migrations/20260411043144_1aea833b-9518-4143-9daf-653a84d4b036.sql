
CREATE OR REPLACE FUNCTION public.get_lead_preview_data()
RETURNS TABLE(
  reference_code text,
  buyer_type text,
  price numeric,
  income numeric,
  city text,
  province text,
  quality_grade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT l.reference_code, l.buyer_type, l.price, l.income, l.city, l.province, l.quality_grade
  FROM public.leads l
  WHERE l.sold_status = 'available'
  ORDER BY l.created_at DESC
  LIMIT 24;
$$;
