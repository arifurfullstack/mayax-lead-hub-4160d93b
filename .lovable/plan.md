

## Marketplace Page Redesign Plan

### Current vs Reference

The current marketplace uses a **dark-themed table layout** with a filter drawer. The reference shows a completely different design:

- **Light/soft background** with subtle gradient (not dark theme)
- **Card grid layout** (3 columns) instead of a table
- **Persistent left sidebar** with filters (not a drawer)
- **Top horizontal navbar** with logo, nav links, wallet balance, "Add Funds" button, profile avatar
- **Lead cards** with credit grade badges (A+/A/B/C), colored left borders, initials avatars, location, document icons, AI score, price, countdown timers, and action buttons
- **Bottom sticky bar** with "Clear Filters", total price, and bulk "BUY LEAD" button
- **Documents section** with checkboxes: Driver License, Paystubs, Bank Statements, Credit Report, Pre-Approval Cert.

### Implementation Plan

#### 1. Redesign MarketplaceFilters — persistent left sidebar

**File: `src/components/MarketplaceFilters.tsx`**

- Export a new `MarketplaceFilterSidebar` component (not a drawer) that renders as a fixed left panel (~280px wide)
- Sections: Credit Range (gradient slider), Income Range (with coin icon + visual pips), Documents Uploaded (5 checkboxes including Credit Report and Pre-Approval Cert.), Location (collapsible dropdown), Vehicle (collapsible dropdown), Lead Age (collapsible dropdown), Clear Filters button at bottom
- Light theme styling: white background, soft borders, clean typography
- Keep the existing `MarketplaceFilterDrawer` for mobile (shown via Sheet on small screens)

#### 2. Create LeadCard component

**File: `src/components/LeadCard.tsx`** (new)

Each card displays:
- **Credit grade badge** (top-left): A+, A, B, C with color coding — green (A+), blue (A), gold (B), gray (C)
- **"A+ Verified" pill badge** next to grade for A+ leads
- **Initials avatar** (colored circle matching grade) + Name + Buyer Type ("Online Buyer" / "In-Store Buyer")
- **Credit score range** (e.g. "684-710") with shield icon
- **Location** (City, Province) with map pin icon
- **Document icons** row (small icons for each uploaded doc)
- **AI Score** display
- **Price** prominently shown
- **Status**: "Available Now" badge (green) or "Unlocks in Xh Xm" countdown
- **Action button**: "BUY LEAD" (green) for available, "Upgrade to Unlock" (green outline) for locked/lower tier
- Card has a **colored left border** matching the grade color
- White/light card background with subtle shadow

#### 3. Redesign Marketplace page layout

**File: `src/pages/Marketplace.tsx`**

- Remove the table layout, stats bar, search bar, and tab buttons
- New layout: `flex` with left sidebar (filters, ~280px) + right content area
- Content area header: "Leads" dropdown/label
- Content area: responsive card grid (3 cols on desktop, 2 on tablet, 1 on mobile)
- Bottom sticky bar: "Clear Filters >" button (left), "Total: $X" + "BUY LEAD" button (right) for cart/bulk purchase
- Keep all existing data fetching, filtering logic, purchase dialog
- Add card selection state for bulk purchases (checkbox or click-to-select)
- Light background styling for the marketplace page specifically

#### 4. Light theme for marketplace page only

Apply a scoped light theme to the marketplace page wrapper using inline CSS variables or a light-mode class, overriding the global dark theme for this page only:
- Background: soft white/light gray gradient
- Cards: white with subtle shadows
- Text: dark gray/navy
- Accent colors remain (green, blue, gold for grades)

#### 5. Update document filter options

Add "Credit Report" and "Pre-Approval Cert." to the document options in `MarketplaceFilters.tsx` to match reference (currently only has license, paystub, bank_statement).

### Files to modify
- `src/components/MarketplaceFilters.tsx` — add sidebar variant + new doc options
- `src/components/LeadCard.tsx` — new card component
- `src/pages/Marketplace.tsx` — full layout redesign

### Technical notes
- No database changes needed — same lead data fields are used
- Purchase flow (dialog + edge function) remains unchanged
- Filter logic (`applyFilters`, `countActiveFilters`) remains unchanged
- Mobile: sidebar collapses to a Sheet drawer; cards stack single-column

