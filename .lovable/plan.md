
# Fully Dynamic Subscription System

## Overview
Make subscription purchases deduct from wallet balance, enforce plan limits (leads/month, access delay), and track monthly usage.

## Database Changes

### New table: `dealer_subscription_usage`
Tracks monthly lead usage per dealer to enforce `leads_per_month` limits.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| dealer_id | uuid | NOT NULL | FK-like to dealers |
| period_start | date | NOT NULL | First day of billing month |
| leads_used | integer | 0 | Count of leads purchased this period |
| leads_limit | integer | NOT NULL | From plan's leads_per_month at subscription time |
| created_at | timestamptz | now() | |

- Unique constraint on (dealer_id, period_start)
- RLS: dealers see own, admins see all

### Modify `subscriptions` table
Add columns:
- `plan_id` (uuid, nullable) — FK to subscription_plans, links to the actual plan
- `leads_per_month` (integer) — snapshot of plan limit at purchase time
- `delay_hours` (integer) — snapshot of delay at purchase time

## Edge Function Changes

### Update `purchase-lead/index.ts`
- Instead of hardcoded `tierDelays`, look up the dealer's active subscription → `delay_hours`
- Check `dealer_subscription_usage` for current month — reject if `leads_used >= leads_limit`
- Increment `leads_used` on successful purchase

## Frontend Changes

### Subscription Page (`src/pages/Subscription.tsx`)
- Fetch dealer's wallet balance and show it in the header
- On "Choose Plan" click:
  - Check wallet balance ≥ plan price
  - If insufficient, show toast with link to wallet
  - If sufficient: deduct price from wallet, create wallet_transaction, create/update subscription with plan snapshot, create/reset usage tracking
  - Show confirmation with plan details
- Show remaining leads for current period (e.g., "42/250 leads used this month")
- Upgrade/downgrade logic: prorate or just switch immediately (switch immediately for simplicity)

### Marketplace / Purchase Lead flow
- Show "X/Y leads remaining" in UI
- Block purchase if monthly limit reached

## Implementation Order
1. Database migration (new table + alter subscriptions)
2. Update Subscription.tsx with wallet-based purchase
3. Update purchase-lead edge function with dynamic limits
4. Add usage display to relevant pages
