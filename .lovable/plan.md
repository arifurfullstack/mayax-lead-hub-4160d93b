

## Marketplace Dark Cinematic Redesign

The current marketplace uses a **light theme** (white cards, light background). The reference shows a **dark, cinematic glassmorphism** design matching the rest of the app. Here's the plan:

### Changes

#### 1. LeadCard — dark glassmorphism cards (`src/components/LeadCard.tsx`)
- Replace white `bg-white` cards with `glass-card` dark translucent style
- Card layout per reference: lead type title at top ("Credit/Finance Lead", "Marketplace Lead", "Referral Lead"), buyer type icon + label below, credit score with shield icon, location with pin, document icons row at bottom-left, price at bottom-right, "BUY LEAD >" button or "Unlocks in Xm" countdown
- Remove colored left border — reference cards have uniform rounded glassmorphism borders with subtle glow
- Remove grade badges/pills — reference uses lead type labels instead
- "BUY LEAD >" button styled as dark bordered pill (not green filled), "Available Now" as text label
- AI SCORE shown inline when present

#### 2. MarketplaceFilters — dark sidebar (`src/components/MarketplaceFilters.tsx`)
- Switch from white bg to dark glassmorphism (`glass-card` style)
- Text colors from gray-800 to foreground/muted-foreground
- Checkboxes keep blue accent but on dark background
- Credit range slider uses gradient track (red-yellow-green as in reference)
- Collapsible sections use light text

#### 3. Marketplace page — dark layout (`src/pages/Marketplace.tsx`)
- Remove `marketplace-light` class — use default dark `bg-background`
- Bottom sticky bar: dark glassmorphism with "Clear Filters >" left, "Total: $X" + green-bordered "BUY LEAD" button right
- Purchase dialog: dark themed (`bg-card` instead of `bg-white`)
- "Leads" header with dropdown chevron

#### 4. CSS cleanup (`src/index.css`)
- Remove `.marketplace-light` utility (no longer needed)

### Files to modify
- `src/components/LeadCard.tsx` — dark card redesign matching reference layout
- `src/components/MarketplaceFilters.tsx` — dark theme sidebar
- `src/pages/Marketplace.tsx` — remove light theme, dark bottom bar + dialog
- `src/index.css` — remove marketplace-light class

### What stays the same
- All data fetching, filtering logic, purchase edge function
- Mobile drawer behavior
- Card grid (3 cols desktop, 2 tablet, 1 mobile)

