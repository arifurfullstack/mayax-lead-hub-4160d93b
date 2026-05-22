# Plan: Use Hostinger Business Email (mayax.ca) for All App Emails

## Goal
- Send all outgoing app emails from your Hostinger mailbox (e.g. `noreply@mayax.ca` or `notify@mayax.ca`) instead of the default Lovable sender.
- Notify the **admin** mailbox on key events (new lead purchase, top-ups, etc.).
- Continue notifying **dealers/users** at their own email addresses.

## Approach
Hostinger gives you SMTP credentials (host: `smtp.hostinger.com`, port `465` SSL, username = full email, password = mailbox password). The cleanest fit is:

1. Add a new edge function `send-smtp-email` that delivers via Hostinger SMTP using `denomailer`.
2. Keep the existing template registry (`_shared/transactional-email-templates/*`) — render React Email to HTML and hand it to SMTP.
3. Replace the 6 existing `send-transactional-email` call sites to call the new function (same payload shape).
4. Add an `ADMIN_NOTIFY_EMAIL` so the admin gets a copy/notification on important events.

No Lovable email domain / NS delegation needed — your DNS stays on Hostinger.

## Steps

### 1. Collect secrets (you enter them in a secure form)
- `SMTP_HOST` = `smtp.hostinger.com`
- `SMTP_PORT` = `465`
- `SMTP_USER` = the full Hostinger mailbox (e.g. `noreply@mayax.ca`)
- `SMTP_PASSWORD` = that mailbox's password
- `SMTP_FROM` = display From (e.g. `MayaX <noreply@mayax.ca>`)
- `ADMIN_NOTIFY_EMAIL` = the admin inbox to receive notifications (can be the same mailbox)

### 2. New edge function: `send-smtp-email`
- Inputs: `{ templateName, recipientEmail, templateData, idempotencyKey, cc?, bcc? }` (same shape as today).
- Looks up the template from `_shared/transactional-email-templates/registry.ts`.
- Renders the React Email component to HTML with `@react-email/render`.
- Sends via `denomailer` SMTP over SSL.
- Logs every send into a new `smtp_email_log` table (recipient, template, status, error, message_id, created_at) for the Admin → Emails page.
- Idempotency: skip if a `sent` row already exists for the same `idempotency_key`.

### 3. Admin notification logic
Add a tiny helper inside `send-smtp-email` (or at call sites) that, for these events, also sends to `ADMIN_NOTIFY_EMAIL`:
- Lead purchased (single + bulk) → admin gets a copy of the dealer's lead-purchase email.
- Wallet top-up succeeded / failed → admin notified.
- New dealer signup / pending approval (optional, recommend including).

Implementation: when `templateName` is in an `ADMIN_CC_TEMPLATES` allowlist, also BCC `ADMIN_NOTIFY_EMAIL`.

### 4. Swap call sites (same payload, just new function name)
Update these 6 places from `send-transactional-email` → `send-smtp-email`:
- `supabase/functions/purchase-lead/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/reconcile-stripe-session/index.ts` (2 calls)
- `supabase/functions/cron-reconcile-stripe/index.ts` (2 calls)
- `src/components/AdminPaymentManager.tsx`

### 5. Auth emails (password reset, signup confirm, etc.)
Supabase auth emails are separate. Two options — recommend **Option A** for simplicity:
- **A. Leave auth emails on Lovable defaults** (they still work, just from Lovable's sender). No DNS conflict with Hostinger.
- **B. Configure Supabase Auth SMTP** to use the same Hostinger credentials so password reset / verification also come from `@mayax.ca`. Requires updating Auth settings with SMTP host/port/user/password and a `From` address.

Tell me which you want; B gives a fully unified `@mayax.ca` experience.

### 6. Verification
- Send a test through the new function (lead purchase confirmation template) to a real inbox.
- Confirm the admin BCC arrives.
- Check `smtp_email_log` for a `sent` row.

## Technical details
- Library: `denomailer` (Deno-native SMTP client, no Node polyfills).
- React Email render: `@react-email/render` (already used implicitly by current templates).
- New table:
  ```sql
  create table smtp_email_log (
    id uuid primary key default gen_random_uuid(),
    template_name text not null,
    recipient_email text not null,
    idempotency_key text unique,
    status text not null,  -- 'sent' | 'failed'
    error text,
    created_at timestamptz default now()
  );
  -- RLS: only admins can select
  ```
- The existing Lovable `send-transactional-email` function and templates stay in place but become unused; safe to delete later.

## Out of scope (unless you ask)
- Migrating Supabase Auth emails to Hostinger SMTP (Option B above).
- Building a UI to manage SMTP credentials from the admin panel — secrets stay in env vars.

Confirm:
1. Mailbox to send **from** (e.g. `noreply@mayax.ca`)?
2. Admin notification inbox (`ADMIN_NOTIFY_EMAIL`)?
3. Auth emails — Option A (leave alone) or B (route through Hostinger too)?
