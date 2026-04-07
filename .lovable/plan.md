

# Plan: MayaX UI Overhaul — 5 Changes

## 1. Admin Sidebar — Already Hidden for Non-Admins (Verify Only)

The `AppSidebar.tsx` already checks `isAdmin` state and conditionally renders the Admin link. The `/admin` route uses `ProtectedRoute` with `requireAdmin`. No code change needed — just verification.

The login page already routes admins to `/admin` and dealers to `/dashboard`. The login view is shared (no separate admin login page). If you want a visually different admin login, clarify — otherwise this is already correct.

---

## 2. Income Filter — Dual-Thumb Slider (0 to Max)

**Files:** `MarketplaceFilters.tsx`, `Marketplace.tsx`

- Change `incomeMin`/`incomeMax` from strings to numbers (`incomeRange: [number, number]`)
- In `Marketplace.tsx`, compute `maxIncome` from leads data and pass it as a prop to the filter components
- Replace the current static income display with a `<Slider>` component (dual-thumb, min=0, max=maxIncome, step=1000)
- Show formatted labels below the slider ($0 — $X,XXX)
- Update `applyFilters` and `countActiveFilters` accordingly

---

## 3. Vehicle Filter — Type → Make → Model Cascade

**Files:** `MarketplaceFilters.tsx`, `Marketplace.tsx`

Current data format: `"SUV - Ford Escape"` (Type - Make Model). No separate DB columns needed — we parse `vehicle_preference` client-side.

- Step 1: User picks vehicle type (SUV, Sedan, Truck, etc.) — existing checkboxes
- Step 2: Once type selected, extract unique makes from leads matching that type and show a make dropdown/select
- Step 3: Once make selected, extract unique models and show model dropdown (optional)
- Add `vehicleMake` and `vehicleModel` string fields to `MarketplaceFilters`
- Reset model when make changes; reset make when type changes
- Update `applyFilters` to match on parsed make/model
- Pass leads data to filter component so it can derive available makes/models

Also fix the `get_marketplace_leads` DB function — it references `l.vehicle_make` and `l.vehicle_model` which don't exist. Remove those columns from the function return.

---

## 4. Smaller Lead Cards — More Per Row

**Files:** `LeadCard.tsx`, `Marketplace.tsx`

- Reduce card padding from `p-5` to `p-3.5`
- Reduce font sizes slightly (credit score from `text-xl` to `text-lg`, price stays prominent)
- Tighten vertical margins (`mb-3` → `mb-2`, `mb-1.5` → `mb-1`)
- Change grid to `xl:grid-cols-4` in `Marketplace.tsx`
- Reduce icon sizes where needed (keep readability)

---

## 5. Blur Logic — Only Contact Info Hidden

**Files:** `LeadCard.tsx`

Remove CSS blur from:
- Credit score range — show clearly
- Location (city, province) — show clearly
- Income — show clearly
- Vehicle preference — show clearly
- Vehicle mileage — show clearly

Add blurred contact fields to card:
- Name (first_name + last_name initial) — blurred with lock icon
- Phone — blurred with lock icon
- Email — blurred with lock icon

After purchase (when `lead.sold_to_dealer_id` matches requesting dealer), these fields are already unmasked by the `get_marketplace_leads` DB function, so the card just checks if the values are real (not `***` / `+XX-XXX-XXXX`) to decide whether to blur.

---

## Implementation Order

1. Fix `get_marketplace_leads` function (remove nonexistent columns) — DB migration
2. Lead card blur changes (step 5)
3. Smaller lead cards (step 4)
4. Income slider filter (step 2)
5. Vehicle cascading filter (step 3)

