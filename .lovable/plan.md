# Fix "Failed to create checkout session"

## Root cause
The `create-checkout` edge function fails to boot with:
`SyntaxError: Identifier 'config' has already been declared` (line 168).

In the PayPal branch, `const config = gw.config as Record<string, string>;` is declared **twice** — once before the token fetch and again right after. Because the worker can't boot, **every** checkout call (including Stripe) returns "Failed to create checkout session".

Your Stripe keys saved fine — the failure is unrelated to the keys.

## Fix
Remove the second duplicate `const config` declaration inside the PayPal branch of `supabase/functions/create-checkout/index.ts`. The first declaration above already provides `config` for the `mode` lookup.

No other changes needed. Edge function will redeploy automatically and Stripe checkout (and PayPal) will work.

## Security note
You pasted a **live Stripe secret key** in chat. Treat it as compromised — please rotate it in your Stripe Dashboard → Developers → API keys, then re-enter the new key in Admin → Payments → Stripe → Configure.
