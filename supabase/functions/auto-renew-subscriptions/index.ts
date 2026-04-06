import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const newPeriodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Find active subscriptions that are due for renewal (end_date <= today and auto_renew = true)
    const { data: subscriptions, error: subErr } = await admin
      .from("subscriptions")
      .select("id, dealer_id, plan_id, tier, price, leads_per_month, delay_hours, auto_renew, end_date")
      .eq("status", "active")
      .eq("auto_renew", true)
      .lte("end_date", today);

    if (subErr) {
      console.error("Failed to fetch subscriptions:", subErr.message);
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions due for renewal", renewed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ dealer_id: string; success: boolean; error?: string }> = [];

    for (const sub of subscriptions) {
      // Get dealer wallet balance
      const { data: dealer, error: dealerErr } = await admin
        .from("dealers")
        .select("id, wallet_balance")
        .eq("id", sub.dealer_id)
        .single();

      if (dealerErr || !dealer) {
        results.push({ dealer_id: sub.dealer_id, success: false, error: "Dealer not found" });
        continue;
      }

      const price = Number(sub.price);
      const currentBalance = Number(dealer.wallet_balance);

      // Insufficient funds — mark subscription as expired
      if (currentBalance < price) {
        await admin
          .from("subscriptions")
          .update({ status: "expired", auto_renew: false })
          .eq("id", sub.id);

        results.push({ dealer_id: sub.dealer_id, success: false, error: `Insufficient balance ($${currentBalance.toFixed(2)} < $${price.toFixed(2)}). Subscription expired.` });
        continue;
      }

      // Deduct wallet
      const newBalance = currentBalance - price;
      await admin
        .from("dealers")
        .update({ wallet_balance: newBalance })
        .eq("id", dealer.id);

      // Record wallet transaction
      await admin.from("wallet_transactions").insert({
        dealer_id: dealer.id,
        type: "renewal",
        amount: -price,
        balance_after: newBalance,
        description: `Auto-renewal: ${sub.tier.toUpperCase()} plan ($${price}/mo)`,
        reference_id: sub.id,
      });

      // Update subscription dates for new period
      await admin
        .from("subscriptions")
        .update({
          start_date: newPeriodStart,
          end_date: newPeriodEnd,
        })
        .eq("id", sub.id);

      // Reset usage for new period (upsert)
      const { data: existingUsage } = await admin
        .from("dealer_subscription_usage")
        .select("id")
        .eq("dealer_id", dealer.id)
        .eq("period_start", newPeriodStart)
        .maybeSingle();

      if (existingUsage) {
        await admin
          .from("dealer_subscription_usage")
          .update({ leads_used: 0, leads_limit: sub.leads_per_month })
          .eq("id", existingUsage.id);
      } else {
        await admin.from("dealer_subscription_usage").insert({
          dealer_id: dealer.id,
          period_start: newPeriodStart,
          leads_used: 0,
          leads_limit: sub.leads_per_month,
        });
      }

      results.push({ dealer_id: sub.dealer_id, success: true });
      console.log(`Renewed ${sub.tier} for dealer ${dealer.id}. New balance: $${newBalance.toFixed(2)}`);
    }

    const renewed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ renewed, failed, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Auto-renew error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
