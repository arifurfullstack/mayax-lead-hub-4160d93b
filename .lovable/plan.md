## Diagnosis

Stripe charged the card successfully (you saw `pi_3TVw7fBVxKclDxeB...` succeeded in Stripe), but MayaX still shows the top-up as **Pending** because:

1. The `payment-webhook` edge function exists and is correct — it credits the wallet on `checkout.session.completed`.
2. But the Stripe gateway row in our database has **no `webhook_secret`** stored (only `publishable_key` + `secret_key`).
3. Without the signing secret, even if Stripe is sending events, `payment-webhook` rejects every one of them with *"missing webhook_secret"* — so the wallet never gets credited.
4. On top of that, no webhook endpoint has been registered in your Stripe Dashboard yet, so Stripe is almost certainly not sending anything to us in the first place.

We need to fix **both** sides: the one-time Stripe Dashboard setup, **and** a safety net inside MayaX so a paid session can never get stuck "pending" again, even if a webhook is ever missed.

---

## Plan

### Part 1 — One-time Stripe Dashboard setup (you do this, ~2 min)

This is unavoidable — only you can do it because it requires your Stripe login.

1. Open Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL:
   ```
   https://ikusoyppxhubbmrbxzfc.supabase.co/functions/v1/payment-webhook
   ```
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
4. After creating, click **Reveal signing secret** → copy the `whsec_…` value.
5. In MayaX → **Admin → Payment Gateways → Stripe → Webhook Secret** → paste the `whsec_…` → Save.
   (The "Setup guide" modal we already added walks through this with copy buttons.)

Once that's saved, every future Stripe payment will credit the wallet within 1–2 seconds automatically.

### Part 2 — Safety-net: "Verify Payment" / auto-reconcile (we build this)

So that a paid Stripe session is **never** stuck pending again — even if a webhook is missed, delayed, or the secret is wrong — add a server-side reconciler that talks to Stripe directly using the secret key we already have:

1. **New edge function `reconcile-stripe-session`**
   - Input: a `wallet_transactions.id` (or its Stripe `session_id` from `metadata`).
   - Verifies the caller owns that transaction (or is admin).
   - Calls Stripe API: `GET /v1/checkout/sessions/{session_id}` using the stored `secret_key`.
   - If `payment_status === 'paid'` and our row is still `pending`:
     - Mark transaction `completed`, set `gateway_transaction_id` to the PaymentIntent ID.
     - Increment `dealers.wallet_balance` by the amount (idempotent — only if status was pending).
     - Insert success entry into `delivery_logs` / send the existing wallet-topup receipt email.
   - If `payment_status === 'unpaid'` and session is expired → mark `failed`.
   - Returns `{ status: 'completed' | 'pending' | 'failed', balance }`.

2. **Wallet page UI changes (`src/pages/Wallet.tsx`)**
   - On each pending deposit row, add a **"Verify Payment"** button next to the Receipt button.
   - Clicking calls `reconcile-stripe-session` and toasts the result; on success, balance updates via the existing realtime listener.
   - When the post-checkout polling loop times out, the manual-refresh prompt also gets a **"Verify with Stripe"** primary action that hits the same endpoint (instead of just refreshing the page).

3. **Admin safety net (`src/components/AdminPaymentManager.tsx` or a small cron)**
   - Optional but recommended: a small badge/button in Admin → Payment Gateways that runs reconciliation across all `pending` Stripe deposits older than 5 min in one click. (Pure UI + reuse of the same edge function.)

### Why both parts

- **Part 1** is the proper fix — webhooks are real-time and free.
- **Part 2** guarantees that even today's already-stuck deposit (the $10 charge `pi_3TVw7fBVxKclDxeB2Qrm7SLW`) gets credited the moment you click "Verify Payment", without waiting for you to finish the dashboard setup. It also covers any future webhook hiccup.

### Files touched

- **New:** `supabase/functions/reconcile-stripe-session/index.ts`
- **Edited:** `src/pages/Wallet.tsx` (Verify Payment button + replace timeout CTA action)
- **Edited (small):** `src/components/AdminPaymentManager.tsx` (admin "Reconcile pending Stripe deposits" button)
- No DB schema changes required.

### Out of scope

- We will not add the webhook endpoint to Stripe for you (requires your Stripe login).
- We will not change the existing webhook signature verification logic — once you paste `whsec_…`, it works as-is.
