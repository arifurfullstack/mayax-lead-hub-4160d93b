---
name: Payment Gateways
description: Stripe, PayPal, Bank Transfer payment methods for wallet deposits with admin management
type: feature
---
Three payment gateways for Add Funds in Wallet page:
- **Stripe**: Redirect to Stripe Checkout, webhook credits wallet
- **PayPal**: Redirect to PayPal approval URL, webhook credits wallet
- **Bank Transfer**: Manual — shows bank details + ref code, admin approves in Admin Dashboard → Payments tab

Tables: payment_gateways (id text PK, enabled, config JSONB), payment_requests (dealer_id, gateway, amount, status, gateway_reference)
Edge functions: create-checkout, payment-webhook
Admin UI: AdminPaymentManager.tsx — toggle gateways, configure bank details, approve/reject pending transfers
Secrets needed: STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
