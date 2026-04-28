
# Why Make.com leads aren't showing in the marketplace

## TL;DR — The leads ARE being inserted. They're just being bought instantly.

I queried the database directly and the picture is clear:

- **Leads table totals:** 234 total leads, **0 available**, 234 sold.
- **Most recent 15 leads** (including ones from today, ref `MX-2026-456`, `MX-2026-418`, `MX-2026-272`, etc.) all have `sold_status = 'sold'`.
- **Purchases table:** two dealers — `DriveX Canada` and `Ajax Nissan` — bought 9 leads in a single minute window at `14:00:34 UTC` today, and 11 leads in one hour yesterday.
- **Autopay is OFF** for both dealers (`autopay_enabled = false`), so this is **manual rapid-fire buying**, not autopay.
- **Make.com webhook itself is healthy** — there are some rejected payloads in `rejected_inbound_leads`, but they're caused by *missing `last_name`* / city-as-vehicle issues, not by your current JSON format. The leads you sent today went through, got a `reference_code`, then got bought.

So the question "why is the lead not added in marketplace" is actually **"why is it gone from marketplace seconds after being added?"** — answer: a dealer purchased it.

The marketplace is doing exactly what it's coded to do: `get_marketplace_leads` returns only `WHERE sold_status = 'available'`. Once sold, it disappears.

---

## What the plan will do

Two parts: (A) confirm/diagnose this for any future "missing lead" report, and (B) optionally make sold leads still browsable so admins don't think they "vanished".

### Part A — Add a "Lead Lifecycle Inspector" to the Webhook Tester

Right now, when you send a Make.com payload, you have no quick way to see what happened to it after insert. We'll add a card that, given a `reference_code` (or auto-picked from the most recent inbound), shows a **timeline**:

```text
14:53:00  CREATED    via inbound-webhook (Make.com)   sold_status=available
14:53:04  SOLD       to DriveX Canada                  $35.00   wallet -$35
14:53:04  DELIVERED  email + webhook → 200 OK
```

It pulls from `leads`, `purchases`, `delivery_logs`, and `lead_audit_log` and renders a single row per event. This way next time you (or your client) say "the lead didn't appear", one click tells you it appeared *and* who bought it within X seconds.

### Part B — Make the marketplace show "Recently sold" leads (read-only)

Today the marketplace UI is built around a single `get_marketplace_leads` RPC that only returns available leads. We'll:

1. Add a new toggle in `Marketplace.tsx` header: **"Show recently sold (24h)"** (admin-visible by default, dealer-optional).
2. Extend `get_marketplace_leads` to take an optional `_include_sold_hours int default 0` parameter. When > 0, also return leads `WHERE sold_status='sold' AND sold_at > now() - interval '_include_sold_hours hours'`, with PII still gated to admin/buyer only and a `sold_at` timestamp + buyer dealership name shown.
3. In `LeadCard`, when `sold_status='sold'`, render the card grayed-out with a "SOLD to {dealership}" badge instead of the Buy button.

This solves the perception problem: instead of an empty marketplace, you see "12 leads sold in the last 24h, 0 currently available" and immediately know the funnel is working — you just need more inbound or fewer buyers.

### Part C — Optional throttle so leads stay buyable for at least N seconds

Tier delays already exist (`vip=0h, elite=6h, pro=12h, basic=24h`) but VIP/Elite dealers see leads instantly. If two VIP dealers race, one wins in <5s. Add an admin setting `lead_minimum_marketplace_seconds` (default 0, off). When > 0, `purchase-lead` rejects buys where `now() - lead.created_at < lead_minimum_marketplace_seconds`. Lets you guarantee every lead is browsable for, say, 60 seconds before it can be claimed.

---

## Technical details

**Database (migration)**
- Drop & recreate `public.get_marketplace_leads(requesting_dealer_id uuid, include_sold_hours int default 0)`.
  - Same column list as today, **plus** `sold_at` (already returned), `buyer_dealership_name text` (joined from `dealers` when sold).
  - When `include_sold_hours > 0`: union of `available` + `sold AND sold_at > now() - make_interval(hours => include_sold_hours)`.
  - PII gating unchanged.
- Add `platform_settings` row `lead_minimum_marketplace_seconds` (text, default `'0'`).
- Update `purchase-lead` edge function to read this setting and reject early with a clear error: `"Lead must remain in marketplace for X more seconds before purchase."`

**Frontend**
- `src/pages/Marketplace.tsx`
  - Add `includeSoldHours` state (default 0; admins default to 24).
  - Pass it to the RPC call.
  - Add toggle in header next to filters.
  - Render sold leads through `LeadCard` with new prop `readOnly={true}` and a `soldTo` label.
- `src/components/LeadCard.tsx`
  - When `lead.sold_status === 'sold'`: add muted overlay, replace Buy button with `<Badge variant="outline">Sold to {soldTo} · {timeAgo(sold_at)}</Badge>`.
- `src/pages/AdminWebhookTester.tsx`
  - New "Lead Lifecycle" card under the existing Lead Inspector. Inputs: `reference_code` (auto-fills with last inserted from this session). On lookup, query in parallel:
    - `leads` row (created_at, sold_status, sold_at, sold_to_dealer_id, price, quality_grade)
    - `purchases` join `dealers` (purchased_at, dealership_name, price_paid)
    - `delivery_logs` (channel, success, response_code, attempted_at)
    - `lead_audit_log` (action, actor, reason)
  - Merge into a sorted timeline and render with colored event icons.

**No changes needed to the inbound webhook** — it's working correctly. The Make.com JSON format you're using is fine.

---

## Files to edit

- `supabase/migrations/<new>.sql` — extend `get_marketplace_leads`, add `platform_settings` key.
- `supabase/functions/purchase-lead/index.ts` — enforce `lead_minimum_marketplace_seconds`.
- `src/pages/Marketplace.tsx` — sold toggle, pass param to RPC, render sold cards.
- `src/components/LeadCard.tsx` — read-only sold mode with buyer badge.
- `src/pages/AdminWebhookTester.tsx` — new Lead Lifecycle card.

---

## Out of scope (explicitly)

- Changing the Make.com payload schema — it works.
- Reverting any of the 234 already-sold leads back to `available`. (You already have `admin_reset_leads_to_available` for that if you ever want to.)
- Removing the rejected leads in `rejected_inbound_leads` — those are real validation failures (missing `last_name`, vehicle text mapped to `city`) and are handled by the existing Rejected Leads page.

---

## Question before I build

The diagnosis (Part A — Lifecycle Inspector) is clearly useful and low-risk. Parts B and C change buyer behavior. Do you want all three, or only A + B (no purchase throttle)?

Reply **"go"** to build all three, **"A and B only"** to skip the throttle, or **"just A"** if you only want the diagnostic for now.
