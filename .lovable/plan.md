

# Dynamic Lead Pricing System

## Overview
Replace the current grade-based pricing with an additive, field-based pricing model. Each lead starts at a base price and gains add-ons based on what data it contains. All pricing values are admin-editable via `platform_settings`.

## Current State
- Pricing is hardcoded in `leadScoring.ts` via `GRADE_PRICES` (grade → fixed price)
- The same logic is duplicated in the `inbound-webhook` edge function
- AI score/grade system remains unchanged — only the **price calculation** changes

## Architecture

```text
Lead arrives (webhook or admin form)
  → Parse notes for keywords (trade, bankruptcy, appointment)
  → Set boolean flags: has_trade_in, has_bankruptcy, has_appointment
  → Calculate price = base + income_addon + vehicle + trade + bankruptcy + appointment
  → AI score/grade still calculated independently (unchanged)
```

## Plan

### 1. Seed default pricing settings in `platform_settings`

Add 7 rows via migration:

| key | value |
|-----|-------|
| `lead_price_base` | `15` |
| `lead_price_income_tier1` | `5` |
| `lead_price_income_tier2` | `10` |
| `lead_price_vehicle` | `5` |
| `lead_price_trade` | `15` |
| `lead_price_bankruptcy` | `15` |
| `lead_price_appointment` | `10` |

### 2. Add `has_bankruptcy` column to `leads` table

Currently `trade_in` and `appointment_time` exist. Add a `has_bankruptcy boolean default false` column so the detected bankruptcy flag is persisted (hidden conditional field).

### 3. Update pricing logic in `src/lib/leadScoring.ts`

- Keep `calculateAiScore` unchanged (score/grade unaffected)
- Replace `getGradePrice` with `calculateLeadPrice(lead, settings)` that:
  - Starts at `settings.lead_price_base` (default 15)
  - Adds income tier add-ons (< 1800 = $0, 1800–4999 = tier1, 5000+ = tier1 + tier2)
  - Adds vehicle price if `vehicle_preference` is non-empty
  - Adds trade price if `trade_in` is true
  - Adds bankruptcy price if `has_bankruptcy` is true
  - Adds appointment price if `appointment_time` is present
- Add `parseNotesFlags(notes)` helper that detects trade/bankruptcy/appointment keywords and returns `{ trade_in, has_bankruptcy, has_appointment }`

### 4. Update `inbound-webhook` edge function

- Fetch pricing settings from `platform_settings` (already fetches settings for webhook secret)
- Use the new additive pricing logic instead of grade-based pricing
- Parse `notes` field for keywords → set `trade_in`, `has_bankruptcy` flags
- Detect appointment keywords in notes → populate `appointment_time` if not already set
- Insert `has_bankruptcy` in the lead record

### 5. Update `AdminAddLeadDialog`

- Use new `calculateLeadPrice` with settings from `usePlatformSettings`
- Show live price preview using additive logic
- Add `has_bankruptcy` detection from notes field
- Auto-detect and show conditional fields (trade-in, bankruptcy, appointment) when keywords found in notes

### 6. Create `AdminLeadPricingSettings` component

New admin panel tab/section with editable fields for all 7 pricing values:
- Base Price, Income Tier 1, Income Tier 2, Vehicle, Trade-In, Bankruptcy, Appointment
- Each field is an `Input type="number"` with a label and description
- Save button upserts to `platform_settings`
- Shows a sample price breakdown preview

### 7. Add "Lead Pricing" tab to `AdminDashboard`

Add a new tab with a `DollarSign` icon between existing tabs, rendering the `AdminLeadPricingSettings` component.

### 8. Update `get_marketplace_leads` DB function

Add `has_bankruptcy` to the returned columns (only visible to the purchasing dealer, like notes).

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `has_bankruptcy` column, seed pricing settings |
| `src/lib/leadScoring.ts` | New `calculateLeadPrice`, `parseNotesFlags` functions |
| `supabase/functions/inbound-webhook/index.ts` | Use dynamic pricing from settings, parse notes |
| `src/components/AdminLeadPricingSettings.tsx` | New component — admin pricing editor |
| `src/pages/AdminDashboard.tsx` | Add Lead Pricing tab |
| `src/components/AdminAddLeadDialog.tsx` | Use new pricing with settings |
| `src/components/OrderDetailModal.tsx` | Show bankruptcy field if present |
| DB function `get_marketplace_leads` | Add `has_bankruptcy` to output |

