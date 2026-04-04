const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for atomic operations
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const leadIds: string[] = Array.isArray(body.lead_ids) ? body.lead_ids : [body.lead_id];

    if (!leadIds.length || leadIds.some((id) => typeof id !== "string")) {
      return new Response(JSON.stringify({ error: "Invalid lead_id(s)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get dealer
    const { data: dealer, error: dealerErr } = await admin
      .from("dealers")
      .select("id, wallet_balance, subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check tier access delay
    const tierDelays: Record<string, number> = {
      vip: 0,
      elite: 6,
      pro: 12,
      basic: 24,
    };
    const delayHours = tierDelays[dealer.subscription_tier] ?? 24;

    const results: Array<{ lead_id: string; success: boolean; error?: string }> = [];
    let currentBalance = Number(dealer.wallet_balance);

    for (const leadId of leadIds) {
      // Get lead with availability check
      const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("sold_status", "available")
        .single();

      if (leadErr || !lead) {
        results.push({ lead_id: leadId, success: false, error: "Lead unavailable or already sold" });
        continue;
      }

      // Check tier delay
      if (delayHours > 0) {
        const leadAge = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
        if (leadAge < delayHours) {
          results.push({ lead_id: leadId, success: false, error: `Lead locked for ${Math.ceil(delayHours - leadAge)}h (upgrade tier for earlier access)` });
          continue;
        }
      }

      const price = Number(lead.price);
      if (currentBalance < price) {
        results.push({ lead_id: leadId, success: false, error: "Insufficient wallet balance" });
        continue;
      }

      // Atomic: mark lead as sold
      const { error: updateErr } = await admin
        .from("leads")
        .update({
          sold_status: "sold",
          sold_to_dealer_id: dealer.id,
          sold_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("sold_status", "available"); // Optimistic lock

      if (updateErr) {
        results.push({ lead_id: leadId, success: false, error: "Failed to lock lead" });
        continue;
      }

      // Deduct wallet
      currentBalance -= price;
      await admin
        .from("dealers")
        .update({ wallet_balance: currentBalance })
        .eq("id", dealer.id);

      // Record transaction
      await admin.from("wallet_transactions").insert({
        dealer_id: dealer.id,
        type: "purchase",
        amount: -price,
        balance_after: currentBalance,
        description: `Purchased lead ${lead.reference_code}`,
        reference_id: leadId,
      });

      // Record purchase
      await admin.from("purchases").insert({
        dealer_id: dealer.id,
        lead_id: leadId,
        price_paid: price,
        dealer_tier_at_purchase: dealer.subscription_tier,
        delivery_status: "pending",
        delivery_method: "email",
      });

      results.push({ lead_id: leadId, success: true });
    }

    return new Response(
      JSON.stringify({
        results,
        new_balance: currentBalance,
        purchased: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
