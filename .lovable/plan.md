

# Plan: Theme, Admin Access, Filters, Lead Cards Overhaul

## Summary
Six changes: new lime-green/white light theme, admin-only sidebar link, income slider filter, cascading vehicle filter (type → make → model), smaller lead cards, and revised blur logic (only contact info blurred).

---

## 1. Light Theme — Lime Green & White

**What changes:** Replace the dark color palette in `src/index.css` with a light theme.

- Background: white (`#FFFFFF`) / light gray (`#F8FAF5`)
- Surfaces/cards: white with subtle lime-tinted borders
- Primary color: lime green (`#84CC16` / Tailwind `lime-500`)
- Text: dark gray/charcoal (`#1A1A2E`)
- Muted: gray tones
- Remove `starfield` dark background utilities or restyle them for light
- Update `body` background from `#080c14` to white
- Update glass-card styles to use light glassmorphism (white/lime tint)
- Buttons, badges, and accent colors adjusted to complement lime-green primary

**Files:** `src/index.css`, `tailwind.config.ts`

---

## 2. Admin Link — Hidden for Non-Admins

**What changes:** The "Admin" sidebar link in `AppSidebar.tsx` already checks `isAdmin` state. Verify it only renders when `isAdmin` is true. Ensure `/admin` route's `requireAdmin` guard rejects non-admins with a redirect (already in place via `ProtectedRoute`). No new page needed — just confirm the sidebar hides it properly.

**Files:** `src/components/AppSidebar.tsx` (verify existing logic)

---

## 3. Income Filter — Slider from 0 to Max

**What changes:** Replace the current static income display in `MarketplaceFilters.tsx` with a dual-thumb `Slider` component.

- Compute max income from available leads (pass as prop or default to a high value like 500,000)
- Add `incomeSlider: [number, number]` to `MarketplaceFilters` interface (replace `incomeMin`/`incomeMax` strings)
- Render `<Slider min={0} max={maxIncome} step={1000} />` with formatted labels
- Update `applyFilters` to use the slider values
- Update `countActiveFilters` accordingly

**Files:** `src/components/MarketplaceFilters.tsx`, `src/pages/Marketplace.tsx`

---

## 4. Vehicle Filter — Type → Make → Model Cascade

**What changes:** Replace the single vehicle type checkbox list with a cascading filter:

1. **Step 1:** Choose vehicle type (Car, SUV, Truck, etc.) — checkboxes or select
2. **Step 2:** Once type selected, show available makes (derived from leads data)
3. **Step 3:** Once make selected, optionally show models (derived from leads data)

- Add `vehicleMake` and `vehicleModel` fields to `MarketplaceFilters`
- Extract unique makes/models from leads data (pass as props)
- Update `applyFilters` to filter on make/model
- Reset model when make changes, reset make when type changes

**Files:** `src/components/MarketplaceFilters.tsx`, `src/pages/Marketplace.tsx`

*Note:* The current `leads` table has `vehicle_preference` (text) but no separate make/model columns. The filter will parse `vehicle_preference` for type matching and we'll add `vehicle_make` and `vehicle_model` columns to the `leads` table via migration for proper cascading.

---

## 5. Smaller Lead Cards — Fit More Per Row

**What changes:** In `LeadCard.tsx` and `Marketplace.tsx`:

- Reduce card padding from `p-5` to `p-3` or `p-4`
- Reduce font sizes (headings, labels)
- Tighten vertical spacing (`mb-3` → `mb-1.5`, etc.)
- Change grid from `xl:grid-cols-3` to `xl:grid-cols-4` (and possibly `2xl:grid-cols-5`)
- Reduce icon sizes where appropriate

**Files:** `src/components/LeadCard.tsx`, `src/pages/Marketplace.tsx`

---

## 6. Blur Logic — Only Contact Info Blurred

**What changes:** In `LeadCard.tsx`, remove blur from:
- Location (city, province) — show clearly
- Income — show clearly
- Credit score range — show clearly
- Vehicle preference — show clearly
- Vehicle mileage — show clearly

Keep blur + lock icon **only** on:
- Name (first_name, last_name) — currently not shown, will add blurred
- Phone — not shown on card, but blurred in detail view
- Email — not shown on card, but blurred in detail view

Also update `get_marketplace_leads` DB function: currently it masks name/phone/email for non-purchasers. Location, income, credit, vehicle fields are already returned unmasked — so no DB change needed. The card just needs to stop applying CSS blur on those fields.

**Files:** `src/components/LeadCard.tsx`

---

## Implementation Order

1. Theme (index.css + tailwind.config) — foundational visual change
2. Admin sidebar guard — quick verification/fix
3. Lead card blur changes — simple CSS removals
4. Smaller lead cards — layout tweaks
5. Income slider filter
6. Vehicle cascading filter (+ DB migration for make/model columns)

