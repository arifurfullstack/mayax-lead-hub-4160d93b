---
name: Promo Codes
description: Admin-managed promo codes that give dealers a flat price on all leads
type: feature
---
- `promo_codes` table: code, flat_price, is_active, max_uses, times_used, expires_at
- `dealer_promo_codes` table: links one promo per dealer (unique on dealer_id)
- Admin manages codes in AdminDashboard > Promo Codes tab
- Dealers enter promo code in Marketplace header; applied server-side in purchase-lead edge function
- When promo active: LeadCard shows strikethrough original price + promo price in primary color
- Edge function checks promo validity (active, not expired, not maxed) and uses flat_price instead of lead.price
