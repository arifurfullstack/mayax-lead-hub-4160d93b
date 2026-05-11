## Goal

Eliminate the manual "Verify with Stripe" click. Pending Stripe top-ups should self-verify in the background and update to Completed/Failed automatically.

## Approach: Smart client-side auto-poll + server cron safety net

A modern, reliable solution combines two layers — the UI feels instant, and the database stays correct even if no one has the page open.

### Layer 1 — Auto-verify in the Wallet page (the visible win)

When the Wallet page detects a pending Stripe top-up, it silently calls `reconcile-stripe-session` on a smart schedule — no user action required. The existing "Verify with Stripe" button stays as a manual override (renamed/demoted to a small "Check now" link), but in practice the user never needs it.

Polling schedule per pending row (exponential backoff, capped):
```text
t = 0s, 3s, 8s, 15s, 30s, 60s, 120s, 240s ... up to 15 min, then stop
```

Smart triggers that reset the schedule to "check immediately":
- Page becomes visible again (`document.visibilitychange`) — covers "user came back from Stripe tab"
- Window regains focus
- Browser comes back online
- A new pending row appears in realtime

Once a row flips to completed/failed, polling for it stops. The existing realtime listener + receipt toast already handle the UI update — auto-poll just feeds them faster.

### Layer 2 — Server-side cron safety net (the invisible win)

A scheduled job runs every 1 minute and reconciles every Stripe payment_request that is `pending` and older than 30 seconds. This guarantees resolution even if the dealer never opens the Wallet page, and takes load off the browser.

- New scheduled edge function `cron-reconcile-stripe` invokes the existing `reconcile-stripe-session` logic in "all" mode (already supported).
- Configured via `pg_cron` to call the function every minute.
- Only Stripe `pending` rows are touched; the existing idempotency guard prevents double-credits.

### Why this is the right shape

- **Webhook stays the primary path** (instant when Stripe's signing secret is configured).
- **Auto-poll** handles the common case where the user just returned from Stripe Checkout — sub-3-second perceived latency, no clicks.
- **Cron** handles the long tail (closed tab, mobile backgrounded, webhook misconfigured) without ever requiring user interaction.
- No DB schema changes. Reuses the existing `reconcile-stripe-session` function and idempotency guard, so there's zero risk of double-crediting.

## Technical details

**`src/pages/Wallet.tsx`**
- New `useEffect` keyed on `pendingDeposits` that maintains a `Map<id, timeoutId>` of scheduled re-verifications with exponential backoff (3s → 8s → 15s → 30s → 60s → 120s → 240s, max ~15 min).
- Listeners on `visibilitychange`, `focus`, `online` that clear pending timers and re-verify all pending rows immediately.
- Reuse `handleVerifyWithStripe` but add a `silent` flag to skip the phase UI and toasts when auto-triggered (toast only on terminal completed/failed, which already happens via the realtime listener). Manual button keeps full UX.
- Demote "Verify with Stripe" button to a subtle "Check now" link with a small "Auto-verifying…" indicator + animated dot to signal background activity.

**`supabase/functions/cron-reconcile-stripe/index.ts`** (new)
- Service-role-authenticated function that calls the same reconcile logic as `{ all: true }` mode but bypasses the admin check (since it runs as cron).
- Easiest path: extract the targets/loop in `reconcile-stripe-session` into a small shared helper, or have the cron function call `reconcile-stripe-session` with a service-role token and an internal flag.

**Migration:** enable `pg_cron` + `pg_net`, then schedule:
```sql
select cron.schedule(
  'reconcile-stripe-pending',
  '* * * * *',
  $$ select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/cron-reconcile-stripe',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role>')
  ) $$
);
```

## Out of scope

- Changing the webhook flow (already correct when signing secret is configured).
- Schema changes — none needed.
- Replacing the manual button entirely — it stays as a transparent fallback.
