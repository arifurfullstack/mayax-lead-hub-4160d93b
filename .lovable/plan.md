# Add `has_bankruptcy` + `trade_in_vehicle` as first-class fields

## Why this matters

Right now both fields are half-implemented:

- **`has_bankruptcy`** exists as a DB column AND in the webhook schema, but the UI **never lets anyone set it directly** — it's inferred only by regex-matching the word "bankrupt" in the `notes` field. Forms have no toggle for it.
- **`trade_in_vehicle`** (the description: "2018 Honda Civic, 80k km") doesn't exist at all in the database or webhook. It's only referenced inside the lead-purchased email template, which silently renders blank, and `purchase-lead` reads `lead.trade_in_vehicle` from a column that doesn't exist.

So the client's request — "send `bankruptcy` and `trade_in vehicle` from Make.com" — currently fails for both: bankruptcy is silently ignored unless the word appears in notes, and trade-in vehicle text has nowhere to live.

This plan makes both fields **real, dynamic, and editable everywhere**.

---

## What you'll get

1. A proper **Bankruptcy Yes/No toggle** in: Submit Lead form, Admin Add Lead dialog, Lead Card, Order Detail modal, purchase email.
2. A new **Trade-In Vehicle text field** (e.g. "2018 Honda Civic, 80k km") that appears whenever `trade_in = true`, in the same five places.
3. **Webhook accepts both fields** from Make.com with clean validation, and Make.com guide is updated with the correct keys + examples.
4. **Pricing/scoring** automatically apply the bankruptcy bonus when the toggle is on (currently only triggered by notes regex).
5. **Backfill**: existing leads where notes contain "bankrupt" get `has_bankruptcy = true` set as a one-time data fix.

---

## Plan

### 1. Database — add the missing column

Migration:

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trade_in_vehicle text;

ALTER TABLE public.rejected_inbound_leads
  ADD COLUMN IF NOT EXISTS trade_in_vehicle text;
```

Update the `get_marketplace_leads` RPC to return `trade_in_vehicle` (gated like `notes` — only visible to admin or the buyer).

Update `dedupe_lead_before_insert` trigger to merge `trade_in_vehicle` with `coalesce(NEW.trade_in_vehicle, trade_in_vehicle)`.

**Backfill** (one-shot, via insert tool):
```sql
UPDATE public.leads
SET has_bankruptcy = true
WHERE has_bankruptcy IS DISTINCT FROM true
  AND notes ILIKE '%bankrupt%';
```

### 2. Webhook — accept both fields cleanly

`supabase/functions/inbound-webhook/index.ts`:

- Add `trade_in_vehicle: z.string().trim().max(200).nullish()` to `inboundLeadSchema`.
- Add an alias normalizer so Make.com users who send `"trade_in vehicle"` (with a space — common Make.com mistake) or `"tradein_vehicle"` get auto-mapped to `trade_in_vehicle` before schema validation. Same for `"bankruptcy"` → `has_bankruptcy` (with boolean coercion of `"yes"/"no"/"true"/"false"`).
- Add entries to `FIELD_HINTS` for both fields with example values.
- Pass both into the `leads` insert payload.

### 3. Forms — add UI controls

**`src/pages/SubmitLead.tsx`** (dealer-facing submit form):
- Add a `has_bankruptcy: false` field to form state and a Yes/No `<Switch>` next to the existing Trade-In switch.
- Add a `trade_in_vehicle: ""` text input that **only renders when `form.trade_in === true`**, with placeholder `"e.g. 2018 Honda Civic, 80,000 km"`.
- Send both in the submit payload.

**`src/components/AdminAddLeadDialog.tsx`**:
- Same two controls, same conditional rendering for `trade_in_vehicle`.
- Replace the `effectiveBankruptcy = notesFlags.has_bankruptcy` line with `form.has_bankruptcy || notesFlags.has_bankruptcy` so the toggle wins but notes still infers.
- Include both in the live price preview and the insert payload.

**`supabase/functions/submit-lead/index.ts`** (if it does its own validation): add both fields to the accepted schema and insert.

### 4. Display — show both fields everywhere a lead is shown

**`src/components/LeadCard.tsx`**:
- Add a "Bankruptcy" badge next to the existing Trade-In badge when `lead.has_bankruptcy` is true (admin/buyer only — it's gated server-side).
- When `lead.trade_in === true` AND `lead.trade_in_vehicle` is set, show the vehicle text under the Trade-In badge in a small muted line: `"Trade-in: 2018 Honda Civic"`.

**`src/components/OrderDetailModal.tsx`**:
- Already shows Trade-In Yes/No — add a row immediately below for Trade-In Vehicle when present.
- Add a Bankruptcy row.
- Add both to the PDF export rows (`row("Trade-In Vehicle:", ...)`, `row("Bankruptcy:", ...)`).

**`src/components/AdminLeadTable.tsx`**:
- Add `trade_in_vehicle: string | null` to the typed Lead interface so it flows through.
- Optional column toggle for it (default hidden to keep table compact).

### 5. Marketplace + types

- Regenerate `src/integrations/supabase/types.ts` (automatic after migration).
- Update any `Lead` interfaces that explicitly list columns: `LeadCard`, `OrderDetailModal`, `AdminLeadTable`, marketplace queries.

### 6. Email template — wire up the existing reference

`supabase/functions/_shared/transactional-email-templates/lead-purchased.tsx` already expects `trade_in_vehicle` and `has_bankruptcy`. Just make sure `purchase-lead/index.ts` actually passes them from the now-real DB columns (the field reference exists but reads `undefined` today).

### 7. Make.com guide — document the new keys

`src/pages/AdminMakeComGuide.tsx`:

- Add `has_bankruptcy` and `trade_in_vehicle` to the mapping table with examples.
- Add a "Common mistake" callout: `"bankruptcy"` (no `has_` prefix) and `"trade_in vehicle"` (with a space) are auto-aliased but the canonical keys are `has_bankruptcy` and `trade_in_vehicle`.
- Update the recommended copy-paste JSON example to include both.

### 8. Pricing/scoring — already handled, just verify

`calculateLeadPrice` already adds `lead_price_bankruptcy` when `has_bankruptcy` is true. With the toggle now setting it directly (instead of relying on notes regex), the bankruptcy price kicks in correctly. No code change needed beyond the form wiring in step 3.

---

## Technical details

**Files to edit**
- `supabase/functions/inbound-webhook/index.ts` — schema + alias normalizer + FIELD_HINTS + insert payload
- `supabase/functions/submit-lead/index.ts` — accept both fields
- `supabase/functions/purchase-lead/index.ts` — pass `trade_in_vehicle` from real column (already references it)
- `src/pages/SubmitLead.tsx` — bankruptcy switch + conditional trade-in vehicle input
- `src/components/AdminAddLeadDialog.tsx` — same two controls + price-preview wiring
- `src/components/LeadCard.tsx` — bankruptcy badge + trade-in vehicle line
- `src/components/OrderDetailModal.tsx` — display rows + PDF rows
- `src/components/AdminLeadTable.tsx` — type + optional column
- `src/pages/AdminMakeComGuide.tsx` — mapping table + JSON example
- `src/lib/leadScoring.ts` — extend `LeadInput` type with `trade_in_vehicle`

**Migrations**
1. Add `trade_in_vehicle` column to `leads` and `rejected_inbound_leads`
2. Update `get_marketplace_leads` RPC to return the column (gated)
3. Update `dedupe_lead_before_insert` trigger to merge the new column

**Data update (insert tool, not migration)**
- Backfill `has_bankruptcy = true` where `notes ILIKE '%bankrupt%'`

**No new secrets, no new RLS policies needed** — both fields inherit existing lead-level RLS.

---

## Make.com payload after this change

```json
{
  "first_name": "Alice",
  "last_name": "Johnson",
  "phone": "4165551234",
  "email": "alice@example.com",
  "city": "Toronto",
  "province": "ON",
  "income": 5500,
  "credit_range_min": 650,
  "credit_range_max": 700,
  "vehicle_preference": "Honda Civic",
  "trade_in": true,
  "trade_in_vehicle": "2018 Toyota Corolla, 80,000 km",
  "has_bankruptcy": false,
  "notes": "Wants financing"
}
```

Both `"bankruptcy"` and `"trade_in vehicle"` (with space) will still be accepted as aliases and silently mapped to the canonical keys, so the client's existing Make.com scenario won't break.
