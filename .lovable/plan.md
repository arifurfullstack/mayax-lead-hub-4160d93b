

# Dynamic Subscription System

## Overview
Replace the hardcoded subscription page with a fully dynamic system where plans are stored in the database and managed by admins. The UI will match the reference image's cinematic glassmorphism style.

## Database Changes

### New table: `subscription_plans`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| name | text | | e.g. "BASIC", "PRO" |
| price | numeric | | Monthly price |
| leads_per_month | integer | | Lead quota |
| delay_hours | integer | 24 | Access delay (0 = instant) |
| glow_color | text | | RGB string e.g. "0, 210, 210" |
| accent_color | text | | Hex e.g. "#00d2d2" |
| is_popular | boolean | false | "Most Popular" badge |
| sort_order | integer | 0 | Display order |
| is_active | boolean | true | Soft delete |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### New table: `plan_features`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| plan_id | uuid | FK to subscription_plans |
| feature_text | text | e.g. "Priority support" |
| sort_order | integer | Display order |

### RLS Policies
- **SELECT** on both tables: public (everyone can read plans)
- **INSERT/UPDATE/DELETE**: admin only via `has_role(auth.uid(), 'admin')`

### Seed data
Insert the 4 current tiers (Basic, Pro, Elite, VIP) with their features so the page works immediately.

## Frontend Changes

### 1. Subscription Page (`src/pages/Subscription.tsx`)
- Fetch plans from `subscription_plans` joined with `plan_features`, ordered by `sort_order`
- Keep the exact same cinematic UI (car lot background, neon streaks, glassmorphism cards, glow effects, hover lift)
- Derive `borderColor` and `delayText` from stored `glow_color`, `accent_color`, and `delay_hours`
- Show loading skeleton while fetching
- Wire CTA buttons to create/update the dealer's subscription (update `dealers.subscription_tier` and insert into `subscriptions` table)
- Highlight the dealer's current plan with a "Current Plan" badge

### 2. Admin Plan Management (new tab in `AdminDashboard.tsx`)
Add a "Plans" tab with:
- **Plan list**: table showing all plans with name, price, leads/mo, delay, status
- **Add Plan** button: opens a dialog form with fields for name, price, leads_per_month, delay_hours, glow_color, accent_color, is_popular, sort_order
- **Edit** button per row: same dialog, pre-filled
- **Delete** button: sets `is_active = false` (soft delete)
- **Feature editor**: within the add/edit dialog, a dynamic list where admin can add/remove feature lines for the plan
- Color picker or preset selector for glow_color and accent_color

## Technical Details

- Use `@tanstack/react-query` for fetching plans (queryKey: `["subscription-plans"]`)
- The `updated_at` trigger (`update_updated_at_column`) will be attached to `subscription_plans`
- Border color derived as `rgba(${glowColor}, 0.6)` from the stored `glow_color` RGB string
- Delay text derived: `delay_hours === 0 ? "Instant access" : "Access leads\nafter ${delay_hours} hours"`
- Delay icon: `Zap` for 0 hours, `Clock` otherwise

## Implementation Order
1. Create database migration (2 tables + RLS + seed data + trigger)
2. Rewrite `Subscription.tsx` to fetch from DB, keep UI identical
3. Add "Plans" tab to `AdminDashboard.tsx` with CRUD + feature management
4. Wire CTA buttons to update dealer subscription

