import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Server-side safety net: every minute, find pending Stripe top-ups
// older than ~30 seconds and reconcile them against Stripe's API.
// Idempotent — relies on the same guards as reconcile-stripe-session.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Stripe secret key — prefer DB-stored gateway config, fall back to env
    const { data: gw } = await admin
      .from("payment_gateways")
      .select("config")
      .eq("id", "stripe")
      .single();
    const stripeKey = (gw?.config as any)?.secret_key || Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe secret key not configured" }, 500);

    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data: targets } = await admin
      .from("payment_requests")
      .select("*")
      .eq("gateway", "stripe")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(200);

    const rows = targets ?? [];
    const results: any[] = [];
    for (const pr of rows) {
      results.push(await reconcileOne(admin, stripeKey, pr));
    }

    const summary = {
      checked: results.length,
      credited: results.filter((r) => r.status === "completed").length,
      failed: results.filter((r) => r.status === "failed").length,
      pending: results.filter((r) => r.status === "pending").length,
    };

    if (rows.length > 0) {
      await admin.from("payment_audit_log").insert({
        event_type: "reconciliation_run",
        source: "cron-reconcile-stripe",
        status: "success",
        details: { mode: "cron", ...summary },
      });
    }

    return json({ ok: true, ...summary });
  } catch (err) {
    console.error("cron-reconcile-stripe error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function reconcileOne(
  admin: ReturnType<typeof createClient>,
  stripeKey: string,
  pr: any,
) {
  if (pr.status !== "pending" || !pr.gateway_reference) {
    return { id: pr.id, status: pr.status };
  }
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${pr.gateway_reference}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    return { id: pr.id, status: "pending", error: session?.error?.message };
  }

  if (session.payment_status === "paid") {
    try {
      await creditWallet(admin, pr.dealer_id, Number(pr.amount), pr.id);
      return { id: pr.id, status: "completed" };
    } catch (e) {
      const msg = (e as Error).message || "Credit failed";
      await admin
        .from("payment_requests")
        .update({ status: "failed", error_message: msg })
        .eq("id", pr.id)
        .eq("status", "pending");
      await sendFailedTopupEmail(admin, pr, msg);
      return { id: pr.id, status: "failed", error: msg };
    }
  }

  if (session.status === "expired" || (session.payment_status === "unpaid" && session.status === "complete")) {
    const reason = `Stripe session ${session.status} (payment_status=${session.payment_status})`;
    await admin
      .from("payment_requests")
      .update({ status: "failed", error_message: reason })
      .eq("id", pr.id)
      .eq("status", "pending");
    await sendFailedTopupEmail(admin, pr, reason);
    return { id: pr.id, status: "failed" };
  }

  return { id: pr.id, status: "pending" };
}

async function creditWallet(
  admin: ReturnType<typeof createClient>,
  dealerId: string,
  amount: number,
  paymentRequestId: string,
) {
  const { data: pending } = await admin
    .from("payment_requests")
    .select("id")
    .eq("id", paymentRequestId)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending) return;

  const { data: dealer } = await admin
    .from("dealers")
    .select("wallet_balance, dealership_name, email, notification_email")
    .eq("id", dealerId)
    .single();

  const currentBalance = Number((dealer as any)?.wallet_balance ?? 0);
  const newBalance = currentBalance + amount;

  await admin.from("dealers").update({ wallet_balance: newBalance }).eq("id", dealerId);

  await admin.from("wallet_transactions").insert({
    dealer_id: dealerId,
    type: "deposit",
    amount,
    balance_after: newBalance,
    description: `Deposit via stripe - $${amount.toFixed(2)} (auto-reconciled)`,
    reference_id: paymentRequestId,
  });

  await admin
    .from("payment_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", paymentRequestId);

  await admin.from("payment_audit_log").insert({
    event_type: "credit_attempt",
    source: "cron-reconcile-stripe",
    status: "success",
    payment_request_id: paymentRequestId,
    dealer_id: dealerId,
    amount,
    balance_after: newBalance,
    details: { gateway: "stripe", previous_balance: currentBalance },
  });

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
              gateway: "stripe",
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

async function sendFailedTopupEmail(
  admin: ReturnType<typeof createClient>,
  pr: any,
  reason: string,
) {
  try {
    const { data: dealer } = await admin
      .from("dealers")
      .select("dealership_name, email, notification_email")
      .eq("id", pr.dealer_id)
      .single();
    const recipient = (dealer as any)?.notification_email || (dealer as any)?.email;
    if (!recipient) return;
    await admin.functions.invoke("send-transactional-email", {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}` },
      body: {
        templateName: "wallet-topup-failed",
        recipientEmail: recipient,
        idempotencyKey: `wallet-topup-failed-${pr.id}`,
        templateData: {
          dealership_name: (dealer as any)?.dealership_name,
          amount: Number(pr.amount),
          gateway: pr.gateway,
          reference: pr.id,
          reason,
          date: new Date().toLocaleString(),
        },
      },
    });
  } catch (e) {
    console.error("wallet-topup-failed email failed:", e);
  }
}
