import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const paymentRequestId: string | undefined = body.payment_request_id;
    const reconcileAll: boolean = body.all === true;

    // Authorize: dealer or admin
    const { data: dealer } = await admin
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    // Load Stripe key
    const { data: gw } = await admin
      .from("payment_gateways")
      .select("config")
      .eq("id", "stripe")
      .single();
    const stripeKey = (gw?.config as any)?.secret_key || Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe secret key not configured" }, 500);

    // Determine target rows
    let targets: any[] = [];
    if (reconcileAll) {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const { data } = await admin
        .from("payment_requests")
        .select("*")
        .eq("gateway", "stripe")
        .eq("status", "pending")
        .lt("created_at", new Date(Date.now() - 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      targets = data ?? [];
    } else {
      if (!paymentRequestId) return json({ error: "payment_request_id required" }, 400);
      const { data: pr } = await admin
        .from("payment_requests")
        .select("*")
        .eq("id", paymentRequestId)
        .maybeSingle();
      if (!pr) return json({ error: "Payment request not found" }, 404);
      if (!isAdmin && pr.dealer_id !== dealer?.id) {
        return json({ error: "Forbidden" }, 403);
      }
      targets = [pr];
    }

    const results: any[] = [];
    for (const pr of targets) {
      results.push(await reconcileOne(admin, stripeKey, pr));
    }

    if (reconcileAll) {
      const credited = results.filter((r) => r.status === "completed").length;
      const failed = results.filter((r) => r.status === "failed").length;
      const stillPending = results.filter((r) => r.status === "pending").length;
      return json({ checked: results.length, credited, failed, pending: stillPending, results });
    }

    return json(results[0]);
  } catch (err) {
    console.error("reconcile-stripe-session error:", err);
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
  if (pr.status !== "pending") {
    return { id: pr.id, status: pr.status, note: "Already finalized" };
  }
  if (pr.gateway !== "stripe" || !pr.gateway_reference) {
    return { id: pr.id, status: pr.status, note: "Not a stripe session" };
  }

  // Fetch Checkout Session from Stripe
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${pr.gateway_reference}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    return { id: pr.id, status: "pending", error: session?.error?.message || "Stripe API error" };
  }

  if (session.payment_status === "paid") {
    try {
      await creditWallet(admin, pr.dealer_id, Number(pr.amount), pr.id, "stripe");
      return { id: pr.id, status: "completed", session_id: session.id, payment_intent: session.payment_intent };
    } catch (e) {
      const msg = (e as Error).message || "Credit failed";
      await admin.from("payment_requests").update({
        status: "failed",
        error_message: msg,
      }).eq("id", pr.id).eq("status", "pending");
      return { id: pr.id, status: "failed", error: msg };
    }
  }

  // Mark expired/unpaid sessions as failed
  if (session.status === "expired" || session.payment_status === "unpaid" && session.status === "complete") {
    await admin.from("payment_requests").update({
      status: "failed",
      error_message: `Stripe session ${session.status} (payment_status=${session.payment_status})`,
    }).eq("id", pr.id).eq("status", "pending");
    return { id: pr.id, status: "failed", session_status: session.status };
  }

  return {
    id: pr.id,
    status: "pending",
    session_status: session.status,
    payment_status: session.payment_status,
  };
}

async function creditWallet(
  admin: ReturnType<typeof createClient>,
  dealerId: string,
  amount: number,
  paymentRequestId: string,
  gateway: string,
) {
  // Idempotency guard: only proceed if this payment request is still pending
  const { data: pending } = await admin
    .from("payment_requests")
    .select("id")
    .eq("id", paymentRequestId)
    .eq("status", "pending")
    .maybeSingle();
  if (!pending) return; // already credited by webhook or another call

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
    description: `Deposit via ${gateway} - $${amount.toFixed(2)} (reconciled)`,
    reference_id: paymentRequestId,
  });

  await admin.from("payment_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", paymentRequestId);

  // Send receipt email (non-blocking)
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