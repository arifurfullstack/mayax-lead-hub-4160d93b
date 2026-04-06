

# Payment Gateway Integration Plan

## Overview
Add Stripe, PayPal, and Bank Transfer (offline) payment methods to the Wallet's "Add Funds" flow. Admin can enable/disable each gateway and configure its settings from the Admin Dashboard.

## Database Changes

### New table: `payment_gateways`
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | text | PK | "stripe", "paypal", "bank_transfer" |
| display_name | text | | e.g. "Credit/Debit Card" |
| enabled | boolean | false | Admin toggle |
| config | jsonb | '{}' | Gateway-specific config (bank details, PayPal mode, etc.) |
| sort_order | integer | 0 | Display order |
| updated_at | timestamptz | now() | |

### New table: `payment_requests`
Tracks pending/completed payment attempts (especially needed for bank transfers which require admin approval).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| dealer_id | uuid | | FK-like to dealers |
| gateway | text | | "stripe", "paypal", "bank_transfer" |
| amount | numeric | | Requested amount |
| status | text | "pending" | pending, completed, failed, cancelled |
| gateway_reference | text | null | Stripe session ID / PayPal order ID / bank ref |
| admin_notes | text | null | For bank transfer approval |
| created_at | timestamptz | now() | |
| completed_at | timestamptz | null | |

### RLS Policies
- `payment_gateways`: SELECT public; INSERT/UPDATE/DELETE admin only
- `payment_requests`: SELECT/INSERT own dealer; UPDATE admin only (for approvals); ALL admin

### Seed data
Insert 3 rows: stripe (disabled), paypal (disabled), bank_transfer (disabled) so admin can enable them.

## Edge Functions

### `create-checkout` (new)
Handles creating payment sessions for each gateway:
- **Stripe**: Creates a Stripe Checkout Session, returns the URL. On success, Stripe webhook credits wallet.
- **PayPal**: Creates a PayPal order, returns approval URL. On capture, credits wallet.
- **Bank Transfer**: Creates a `payment_requests` row with status "pending", returns bank details from config. Admin manually approves.

### `payment-webhook` (new)
Receives Stripe/PayPal webhooks:
- Verifies signature
- Looks up `payment_requests` by `gateway_reference`
- Credits dealer wallet (insert wallet_transaction + update dealer balance)
- Updates payment_request status to "completed"

## Frontend Changes

### 1. Wallet Page (`src/pages/Wallet.tsx`)
Modify the "Add Funds" dialog:
- **Step 1**: Select amount (existing preset grid)
- **Step 2**: Choose payment method — show only admin-enabled gateways, each as a selectable card with icon (CreditCard for Stripe, a PayPal icon, Building2 for Bank)
- **Step 3**: 
  - Stripe: redirect to Stripe Checkout
  - PayPal: redirect to PayPal approval URL
  - Bank Transfer: show bank details from config (account name, number, routing) and a reference code; dealer confirms they've sent the transfer
- Add a "Pending Deposits" section showing bank transfer requests awaiting approval

### 2. Admin Dashboard — New "Payments" tab
- **Gateway list**: 3 cards (Stripe, PayPal, Bank Transfer), each with:
  - Enable/disable toggle (Switch component)
  - Configure button opening a dialog with gateway-specific fields:
    - **Stripe**: No config needed in DB (keys are secrets). Just enable/disable.
    - **PayPal**: Mode (sandbox/live) toggle. Keys are secrets.
    - **Bank Transfer**: Bank name, account name, account number, routing number, instructions text
- **Pending Bank Transfers**: Table of payment_requests where gateway="bank_transfer" and status="pending". Admin can Approve (credits wallet) or Reject each.

### 3. New component: `AdminPaymentManager.tsx`
Extracted component for the Payments tab (same pattern as AdminPlanManager).

## Secrets Required
- `STRIPE_SECRET_KEY` — for Stripe Checkout Sessions (will use Lovable's Stripe integration tool)
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` — for PayPal orders API

## Implementation Order
1. Create database migration (2 tables + RLS + seed data)
2. Enable Stripe integration via Lovable tool
3. Create `create-checkout` edge function
4. Create `payment-webhook` edge function
5. Update Wallet page with multi-step payment flow
6. Create `AdminPaymentManager.tsx` and add "Payments" tab to Admin Dashboard
7. Request PayPal secrets from user

## Technical Details
- Stripe Checkout uses `mode: "payment"` for one-time deposits
- PayPal uses Orders API v2 (`/v2/checkout/orders`)
- Bank transfer is fully manual — admin approval triggers wallet credit via service role client
- Gateway config (bank details) stored as JSONB, parsed on frontend for display
- Payment requests table enables audit trail for all deposit attempts

