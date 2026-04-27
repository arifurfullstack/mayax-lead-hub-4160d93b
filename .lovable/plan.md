## Diagnosis — why Jose & Shawn never reached the Marketplace

### What the database shows
- **Shawn Delorey** (`shawndelorey796@gmail.com` / `613 862 0420`): **does not exist** in the `leads` table at all. No record, no duplicate, no merged entry.
- **Jose Chocano** (`jose_chocano@hotmail.com` / `416 418 6379`): the only Jose Chocano in the DB is `MX-2026-4830`, created **April 17**, with a typo email `jose_chocsno@hotmail.com`. Status = **sold** (bought by a dealer on April 18). Today's Make.com send did **not** create or update him either.

### What the edge logs show
Querying `function_edge_logs` for the last 24 hours returns only **3 calls**, all internal cron jobs (`process-expired-leads`, `process-autopay`).
**Zero calls hit `inbound-webhook`** (or `submit-lead` / `update-lead-by-phone`) in the last 24h.

### Conclusion
Make.com is reporting "Operation 1 ✅ success" because the HTTP module itself completed, **but the request never arrived at the MayaX `inbound-webhook` endpoint**. The most common causes:

1. **Wrong URL** in the Make webhook module — pointing at an old URL, a Make-internal URL (`hook.eu2.make.com/...`), or a different project ref. The correct URL is:
   `https://ikusoyppxhubbmrbxzfc.supabase.co/functions/v1/inbound-webhook`
2. **Missing/incorrect `x-webhook-secret` header** — would return 401, but Make often still shows green if it ignores non-2xx. (Check the Make response body — it would say "Invalid webhook secret".)
3. **The Make scenario sends to a different downstream system first** (e.g. a CRM) and the MayaX webhook step is disabled / not connected in the flow.
4. **The "successful" screenshot is from the previous module** (data fetch), not from a downstream MayaX HTTP module.

Even Jose's previous lead reached us with a **typo'd email** (`chocsno`) — meaning the upstream source of truth has data-quality issues independent of MayaX.

---

## Plan — make this debuggable + recover the two leads

### 1. Add payload logging to `inbound-webhook`
Right now `inbound-webhook` doesn't log incoming payloads, so when Make claims success but nothing arrives, we have no audit trail. Add:
- `console.log` of `request method`, headers (excluding secret value, just whether it's present), and a JSON-stringified summary of the parsed body (first_name, last_name, email, phone, reference_code).
- `console.log` of every result row (`created` / `updated` / `merged` / `error`) with the reference code.
- On 401 (bad secret), log the source IP / user-agent so we can confirm Make is reaching us at all.

This makes future "Make says success but nothing in MayaX" cases trivial to diagnose from edge function logs.

### 2. Add an admin-side "Inbound Webhook Activity" panel (optional, small)
On the existing `AdminWebhookSettings` page, add a small section that shows the **last 20 inbound-webhook calls** (timestamp, status code, ref code from result, error if any), pulled from `function_edge_logs` via a new tiny edge function `admin-webhook-activity`. So you can verify from MayaX whether Make is actually reaching us, without needing to open the Cloud logs.

### 3. Manually re-ingest the two missing leads
Provide a one-time admin script (or use the existing `AdminAddLeadDialog`) to insert:
- **Shawn Delorey** — Ottawa, $5,000 income, SUV preference, phone 613 862 0420.
- **Jose Chocano** — already exists as `MX-2026-4830` but is sold. The dedupe trigger will merge any re-send into that record (and update its notes). Since today's payload had richer data (income $7,500, credit 800–900, vehicle "2023 Audi Q4 E-tron Sportback", King City), but the existing record is **sold**, we'll only append the new info to its notes — we won't put it back on the marketplace. If you want it re-listed for sale, we'd use `admin_reset_leads_to_available()`.

### 4. Verify Make.com configuration (you, in Make)
Once logging is live, re-trigger the Make scenario for Shawn and check:
- Edge function logs for an inbound POST (should appear within seconds).
- If nothing appears → the Make module's URL/method is wrong; fix it in Make.
- If 401 appears → fix the `x-webhook-secret` header in Make.
- If 400 appears → Make is sending malformed JSON (e.g. unquoted `$7,500` strings). The webhook already auto-strips grouping commas in numbers, but pure currency strings like `"$7,500"` only work if quoted.

### Files to change
- `supabase/functions/inbound-webhook/index.ts` — add structured logging.
- `supabase/functions/admin-webhook-activity/index.ts` — new (optional panel).
- `src/components/AdminWebhookSettings.tsx` — add "Recent inbound activity" section (optional).

### What you'll see after approval
- Edge logs will show every inbound hit with ref code + status, so you can prove from MayaX whether Make is reaching us.
- The admin panel (if included) will surface the last 20 inbound attempts so you don't have to ask me to check.
- Shawn's lead will be in the marketplace; Jose's new payload will be appended as a note to his existing sold record.

Do you want me to include the admin "Recent inbound activity" panel (step 2), or just the logging + re-ingestion?