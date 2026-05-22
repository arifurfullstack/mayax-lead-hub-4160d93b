import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    if (provider === "stripe") {
      const body = await req.text();
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up Stripe config (secret key + webhook secret) from payment_gateways
      const { data: gw } = await admin
        .from("payment_gateways")
        .select("config")
        .eq("id", "stripe")
        .single();
      const config = (gw?.config ?? {}) as Record<string, string>;
      const stripeKey = config.secret_key || Deno.env.get("STRIPE_SECRET_KEY");
      const webhookSecret = config.webhook_secret || Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (!stripeKey || !webhookSecret) {
        return new Response(JSON.stringify({ error: "Stripe not configured (missing secret_key or webhook_secret)" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        console.error("Stripe signature verification failed:", (err as Error).message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentRequestId = session.metadata?.payment_request_id;
        const dealerId = session.metadata?.dealer_id;

        if (!paymentRequestId || !dealerId) {
          return new Response(JSON.stringify({ error: "Missing metadata" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (session.payment_status !== "paid") {
          await admin.from("payment_requests").update({
            status: "failed",
            error_message: `Stripe checkout did not complete (payment_status=${session.payment_status})`,
          }).eq("id", paymentRequestId).eq("status", "pending");
          return new Response(JSON.stringify({ received: true, note: "Not paid" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get payment request
        const { data: payReq } = await admin
          .from("payment_requests")
          .select("*")
          .eq("id", paymentRequestId)
          .eq("status", "pending")
          .single();

        if (!payReq) {
          return new Response(JSON.stringify({ received: true, note: "Already processed or not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Credit wallet (record any failure on the payment_request for the UI)
        try {
          await creditWallet(admin, dealerId, Number(payReq.amount), paymentRequestId, "stripe");
        } catch (e) {
          const msg = (e as Error).message || "Unknown error crediting wallet";
          await admin.from("payment_requests").update({
            status: "failed",
            error_message: msg,
          }).eq("id", paymentRequestId);
          await admin.from("payment_audit_log").insert({
            event_type: "credit_attempt",
            source: "payment-webhook",
            status: "failed",
            payment_request_id: paymentRequestId,
            dealer_id: dealerId,
            amount: Number(payReq.amount),
            error_message: msg,
            details: { gateway: "stripe", stripe_event: event.type, session_id: session.id },
          });
          throw e;
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
        const obj = event.data.object as any;
        const paymentRequestId = obj?.metadata?.payment_request_id;
        if (paymentRequestId) {
          const reason = obj?.last_payment_error?.message
            || obj?.failure_message
            || (event.type === "checkout.session.expired" ? "Stripe checkout session expired" : "Stripe payment failed");
          await admin.from("payment_requests").update({
            status: "failed",
            error_message: reason,
          }).eq("id", paymentRequestId).eq("status", "pending");
          await admin.from("payment_audit_log").insert({
            event_type: "credit_attempt",
            source: "payment-webhook",
            status: "failed",
            payment_request_id: paymentRequestId,
            error_message: reason,
            details: { gateway: "stripe", stripe_event: event.type },
          });
        }
        return new Response(JSON.stringify({ received: true, recorded: event.type }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Acknowledge other event types so Stripe doesn't retry
      return new Response(JSON.stringify({ received: true, ignored: event.type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "paypal") {
      const body = await req.json();
      const eventType = body.event_type;

      if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
        const orderId = body.resource?.id || body.resource?.supplementary_data?.related_ids?.order_id;

        const { data: payReq } = await admin
          .from("payment_requests")
          .select("*")
          .eq("gateway_reference", orderId)
          .eq("status", "pending")
          .single();

        if (payReq) {
          await creditWallet(admin, payReq.dealer_id, Number(payReq.amount), payReq.id, "paypal");
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function creditWallet(
  admin: ReturnType<typeof createClient>,
  dealerId: string,
  amount: number,
  paymentRequestId: string,
  gateway: string
) {
  // Get current balance + dealer email
  const { data: dealer } = await admin
    .from("dealers")
    .select("wallet_balance, dealership_name, email, notification_email")
    .eq("id", dealerId)
    .single();

  const currentBalance = Number(dealer?.wallet_balance ?? 0);
  const newBalance = currentBalance + amount;

  // Update dealer balance
  await admin
    .from("dealers")
    .update({ wallet_balance: newBalance })
    .eq("id", dealerId);

  // Insert wallet transaction
  await admin.from("wallet_transactions").insert({
    dealer_id: dealerId,
    type: "deposit",
    amount,
    balance_after: newBalance,
    description: `Deposit via ${gateway} - $${amount.toFixed(2)}`,
    reference_id: paymentRequestId,
  });

  // Update payment request
  await admin.from("payment_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", paymentRequestId);

  // Audit: credit succeeded
  await admin.from("payment_audit_log").insert({
    event_type: "credit_attempt",
    source: "payment-webhook",
    status: "success",
    payment_request_id: paymentRequestId,
    dealer_id: dealerId,
    amount,
    balance_after: newBalance,
    details: { gateway, previous_balance: currentBalance },
  });

  // Send confirmation email (non-blocking)
  if (dealer) {
    const recipient = (dealer as any).notification_email || (dealer as any).email;
    if (recipient) {
      try {
        await admin.functions.invoke("send-smtp-email", {
          headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
          body: {
            templateName: "wallet-topup",
            recipientEmail: recipient,
            idempotencyKey: `wallet-topup-${paymentRequestId}`,
            templateData: {
              dealership_name: (dealer as any).dealership_name,
              amount,
              new_balance: newBalance,
              gateway,
              reference: paymentRequestId,
              date: new Date().toLocaleString(),
            },
          },
        });
      } catch (e) {
        console.error("wallet-topup email failed:", e);
      }
    }
  }
}
