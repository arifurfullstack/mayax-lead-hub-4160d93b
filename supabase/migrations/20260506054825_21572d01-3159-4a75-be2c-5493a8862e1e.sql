-- Lock down promo data: only admins can read/write promo details and assignments.
-- Dealers can no longer view promo_codes details or apply/remove dealer_promo_codes.

DROP POLICY IF EXISTS "Authenticated users can view active promo codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Dealers can apply promo" ON public.dealer_promo_codes;
DROP POLICY IF EXISTS "Dealers can remove own promo" ON public.dealer_promo_codes;

-- Keep "Admins can manage promo codes" / "Admins can manage all dealer promos" (admin-only access).
-- Keep "Dealers can view own promo" on dealer_promo_codes (only exposes promo_code_id linkage,
-- not promo details — joining to promo_codes is blocked by RLS for non-admins).