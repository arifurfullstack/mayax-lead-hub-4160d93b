---
name: Promo Codes
description: Admin-managed promo codes with flat price or percentage discount for dealer lead purchases
type: feature
---
- `promo_codes` table: code, flat_price, discount_type (flat/percentage), discount_value, is_active, max_uses, times_used, expires_at
- `dealer_promo_codes` table: links one promo per dealer (unique on dealer_id)
- Admin manages codes in AdminDashboard > Promo Codes tab (create, edit, activate/deactivate, delete)
- Dealers enter promo code in Settings > Promo Code tab; applied server-side in purchase-lead edge function
- Promo NOT shown in marketplace UI — only in dealer Settings
- Flat type: all leads become fixed price (flat_price field)
- Percentage type: discount_value % off the lead's current dynamic price
- Edge function checks promo validity (active, not expired, not maxed) and calculates final price
- Promo usage tracked in promo_code_usage table with original_price and price_paid
