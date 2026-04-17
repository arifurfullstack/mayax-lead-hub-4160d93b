import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      // In production you'd verify the Stripe signature here
      const event = JSON.parse(body);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const paymentRequestId = session.metadata?.payment_request_id;
        const dealerId = session.metadata?.dealer_id;

        if (!paymentRequestId || !dealerId) {
          return new Response(JSON.stringify({ error: "Missing metadata" }), {
            status: 400,
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

        // Credit wallet
        await creditWallet(admin, dealerId, Number(payReq.amount), paymentRequestId, "stripe");

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

  // Send confirmation email (non-blocking)
  if (dealer) {
    const recipient = (dealer as any).notification_email || (dealer as any).email;
    if (recipient) {
      try {
        await admin.functions.invoke("send-transactional-email", {
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
