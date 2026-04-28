## What's actually happening

I pulled the last 10 rejected payloads and the last 6 accepted leads. The webhook itself is working — the problem is **Make.com is mapping the wrong source variables to the wrong JSON keys**, and the webhook is too permissive about accepting those bad values.

Examples from production data right now:

| created_at | What Make.com sent | Why it's wrong |
|---|---|---|
| 04:33 | `city: "ex and refinance"`, `vehicle_preference: "I need to confirm who am speaking to"` | Notes/transcript fragments mapped into city + vehicle slots |
| 01:44 | `city: "I Would Say Brampton"` | Conversational answer, not a city |
| 00:00 | `city: "newer model"`, `income: 2025` | Vehicle year landed in income |
| Rejected | `city: "Mercedes Benz"`, `vehicle_preference: "Mercedes-benz"` | Vehicle text mapped to BOTH city and vehicle |
| Rejected | `first_name: "Planning"`, `income: "$2000"` | A status word ended up in first_name |
| Rejected | `email: "None"` (literal string) | Make sent the word "None" instead of empty |
| Rejected (5×) | only `phone` populated, every other field empty/`0` | Make.com module fired before the AI/transcript step finished filling slots |

So the symptom the client describes — "half the data comes in, half doesn't" — is exactly this: Make.com is firing the HTTP module before all the variables are populated, AND in some cases pasting the wrong source variable into the wrong JSON key.

## Root causes (two layers)

1. **Make.com scenario layer** — wrong / out-of-order variable mapping in the HTTP module. The client built one mapping that works for the "happy path" but breaks when the upstream module (transcript, ChatGPT block, Typeform, etc.) returns variables in a different order or leaves fields empty.
2. **Webhook layer** — currently accepts any string for any field. `"Mercedes Benz"` in `city`, `"None"` in `email`, `2025` in `income` are all stored as-is. There's no sanity check that says "this looks like a city, not a vehicle."

We need to fix both.

## Plan

### 1. Server-side input normalization (inbound-webhook edge function)

Add a `normalizeInboundLead()` step that runs before validation:

- **Empty-ish coercion**: convert literal `"None"`, `"none"`, `"N/A"`, `"null"`, `"undefined"`, `""`, `"0"` (in non-numeric fields), and whitespace-only values → `null`.
- **Numeric fields** (`income`, `credit_range_min/max`, `vehicle_mileage`, `vehicle_price`):
  - `0` → `null` (zero is almost never a real value here).
  - Strings like `"Not working"`, `"$2000"`, `"2,500/mo"` → run through existing `parseNumericInput`; if NaN, store `null` AND log a warning.
- **Date fields** (`appointment_time`): empty string → `null`; invalid date → `null` + warning.
- **Boolean fields** (`trade_in`): accept `"true"/"false"/"yes"/"no"/1/0` strings.
- **First/last name**: if either contains digits, ` @`, or is a known status word (`"Planning"`, `"Pending"`, `"Unknown"`, `"None"`), treat as missing and trigger the existing `recoverNamesFromPayload` path.

### 2. Server-side field-shape sanity checks (new)

Add lightweight heuristics that flag (don't reject) suspicious mappings, then route to the rejected-leads table with a clearer error so the client can see *exactly* which mapping is broken:

- **city looks like a vehicle**: matches `/honda|toyota|ford|bmw|mercedes|tesla|audi|.../i` or contains a 4-digit year → reject with `error_type: "city_looks_like_vehicle"` and `suggested_fix: "Check Make.com mapping — 'city' is receiving vehicle text. Map the location/city variable instead."`
- **vehicle_preference looks like a city**: matches a Canadian city list and is < 25 chars → warn (don't reject, just store + flag).
- **email is not a valid email**: reject with `error_type: "email_invalid"` and the actual bad value in the suggested fix.
- **phone has fewer than 7 digits after stripping**: reject with `error_type: "phone_too_short"`.
- **All-fields-empty-except-phone**: reject with `error_type: "payload_appears_empty"` and a suggested fix telling them to check the Make.com module that builds the JSON body — this is the "fired too early" case.

All flagged rejections go into `rejected_inbound_leads` with the full payload so the admin Rejected Leads screen already shows them.

### 3. New `error_type` column usage + admin UI surfacing

`rejected_inbound_leads.error_type` already exists. Populate it with the new structured codes above (`city_looks_like_vehicle`, `email_invalid`, `phone_too_short`, `payload_appears_empty`, `missing_required_fields`, `name_recovery_failed`).

In `src/pages/AdminRejectedLeads.tsx`:
- Add an **error_type filter dropdown** alongside the existing status filter chips.
- Add a per-row **"Suggested fix"** expandable section that shows the human-readable remediation for that error_type.
- Add a small **"Field heatmap"** at the top of the page: count of rejections by error_type over the last 7 days, so the client can immediately see "12 rejections this week, 9 of them are payload_appears_empty → fix your Make.com trigger order."

### 4. Make.com integration guide page (admin-only docs)

Create `src/pages/AdminMakeComGuide.tsx` (route `/admin/makecom-guide`, sidebar link under Admin) with:

- **Scenario screenshot walkthrough** (text-based; no images needed): step-by-step description of the correct HTTP module configuration in Make.com.
- **Required modules in order**: Trigger → Data prep (text parsing / ChatGPT) → **Filter (only continue if first_name AND last_name are non-empty)** → HTTP POST. The missing filter is what's letting half-baked payloads through.
- **Exact mapping table**: each MayaX JSON field on the left, what the Make.com source variable should be on the right, and a "common mistake" column (e.g. "Don't map the transcript variable to `city` — map it to `notes`").
- **Body type setting**: must be `Raw → JSON (application/json)`, not `Form-data`. Form-data sends everything as strings and is a common source of `"None"` literals.
- **Test payload** (the same one already shown in the settings card) with a "Copy" button.
- A **"Test your scenario"** section that links to the existing Webhook Tester so they can paste their Make.com output and see exactly which fields would fail.

### 5. Add a `?strict=true` mode to the webhook

Optional query flag the client can set in their Make.com HTTP module URL: `…/inbound-webhook?strict=true`.

When strict is on:
- All the heuristic warnings in step 2 become hard rejections (instead of warn-and-store).
- Numeric coercion failures reject instead of nulling.
- The response includes `field_diagnostics: { city: "looks_like_vehicle", income: "could_not_parse_'Not working'" }` so Make.com's error handler can show it.

This lets the client turn on strict mode while debugging the scenario, then leave it off (or keep it on) in production.

### 6. Add a settings toggle: "Reject empty-payload pings"

In `AdminWebhookSettings.tsx`, add a switch `inbound_webhook_reject_empty_payloads` (default ON). When on, payloads where everything except `phone` is empty are rejected immediately with a clear error. This kills the "Make.com fired too early" garbage at the door.

## Technical details

**Files to edit:**
- `supabase/functions/inbound-webhook/index.ts` — add `normalizeInboundLead()`, field-shape heuristics, `strict` mode, empty-payload guard, populate `error_type` consistently.
- `src/pages/AdminRejectedLeads.tsx` — error_type filter, suggested-fix UI, 7-day heatmap.
- `src/components/AdminWebhookSettings.tsx` — add `reject_empty_payloads` toggle.
- `src/components/AppSidebar.tsx` + `src/App.tsx` — register the new Make.com guide route.

**Files to create:**
- `src/pages/AdminMakeComGuide.tsx` — the integration walkthrough.

**No DB migration required** — `error_type` column already exists; we're just populating it consistently and reading it in the UI.

**No new secrets required.**

## What this delivers to your client

1. **Today**, when they look at Rejected Leads, they'll see for each broken push: "city is receiving vehicle text — fix Make.com mapping" instead of just "Missing required fields."
2. They get a **step-by-step Make.com guide** matching their exact scenario.
3. The webhook stops accepting obviously broken data (`"None"` emails, empty payloads, vehicle text in city), so the marketplace stops getting polluted.
4. They can flip `?strict=true` on while testing to see every problem at once.
