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
    const currentDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todayStr = now.toISOString().split("T")[0];
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Fetch all enabled autopay settings
    const { data: allSettings, error: settingsErr } = await admin
      .from("autopay_settings")
      .select("*")
      .eq("enabled", true);

    if (settingsErr) {
      return new Response(JSON.stringify({ error: settingsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allSettings || allSettings.length === 0) {
      return new Response(JSON.stringify({ message: "No active autopay settings", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all available leads
    const { data: availableLeads, error: leadsErr } = await admin
      .from("leads")
      .select("*")
      .eq("sold_status", "available")
      .order("ai_score", { ascending: false });

    if (leadsErr || !availableLeads) {
      return new Response(JSON.stringify({ error: leadsErr?.message ?? "Failed to fetch leads" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{
      dealer_id: string;
      purchased: number;
      skipped: string;
      errors: string[];
    }> = [];

    for (const ap of allSettings) {
      const dealerResult = { dealer_id: ap.dealer_id, purchased: 0, skipped: "", errors: [] as string[] };

      // Check active days
      const activeDays = (ap.active_days as string[]) ?? [];
      if (activeDays.length > 0 && !activeDays.includes(currentDay)) {
        dealerResult.skipped = "Not an active day";
        results.push(dealerResult);
        continue;
      }

      // Check time window
      const startTime = ap.start_time ?? "00:00";
      const endTime = ap.end_time ?? "23:59";
      if (currentTime < startTime || currentTime > endTime) {
        dealerResult.skipped = "Outside active hours";
        results.push(dealerResult);
        continue;
      }

      // Get dealer info
      const { data: dealer } = await admin
        .from("dealers")
        .select("id, wallet_balance, subscription_tier")
        .eq("id", ap.dealer_id)
        .single();

      if (!dealer) {
        dealerResult.errors.push("Dealer not found");
        results.push(dealerResult);
        continue;
      }

      // Check tier eligibility (elite or vip only)
      // Also check active subscription tier
      const { data: activeSub } = await admin
        .from("subscriptions")
        .select("tier, delay_hours, leads_per_month")
        .eq("dealer_id", dealer.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const effectiveTier = activeSub?.tier ?? dealer.subscription_tier;
      if (effectiveTier !== "elite" && effectiveTier !== "vip") {
        dealerResult.skipped = "Tier not eligible (requires Elite or VIP)";
        results.push(dealerResult);
        continue;
      }

      const delayHours = activeSub?.delay_hours ?? (effectiveTier === "vip" ? 0 : 6);
      const leadsLimit = activeSub?.leads_per_month ?? null;

      // Count today's autopay purchases to enforce leads_per_day
      const maxPerDay = ap.leads_per_day ?? 10;
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.999Z`;

      const { count: todayCount } = await admin
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", dealer.id)
        .eq("delivery_method", "autopay")
        .gte("purchased_at", todayStart)
        .lte("purchased_at", todayEnd);

      const purchasedToday = todayCount ?? 0;
      if (purchasedToday >= maxPerDay) {
        dealerResult.skipped = `Daily limit reached (${purchasedToday}/${maxPerDay})`;
        results.push(dealerResult);
        continue;
      }

      const remaining = maxPerDay - purchasedToday;

      // Check monthly usage
      let currentMonthUsage = 0;
      if (leadsLimit !== null) {
        const { data: usageRow } = await admin
          .from("dealer_subscription_usage")
          .select("leads_used")
          .eq("dealer_id", dealer.id)
          .eq("period_start", periodStart)
          .maybeSingle();
        currentMonthUsage = usageRow?.leads_used ?? 0;
        if (currentMonthUsage >= leadsLimit) {
          dealerResult.skipped = `Monthly limit reached (${currentMonthUsage}/${leadsLimit})`;
          results.push(dealerResult);
          continue;
        }
      }

      // Filter leads matching dealer criteria
      let matchingLeads = availableLeads.filter((lead) => {
        // Already sold check (could be purchased by earlier dealer in this loop)
        if (lead.sold_status !== "available") return false;

        // Delay check
        if (delayHours > 0) {
          const leadAge = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
          if (leadAge < delayHours) return false;
        }

        // Price range filter
        const price = Number(lead.price);
        if (ap.price_range_min != null && price < Number(ap.price_range_min)) return false;
        if (ap.price_range_max != null && price > Number(ap.price_range_max)) return false;

        // Credit score filter
        if (ap.credit_score_min != null && lead.credit_range_min != null && lead.credit_range_min < ap.credit_score_min) return false;
        if (ap.credit_score_max != null && lead.credit_range_max != null && lead.credit_range_max > ap.credit_score_max) return false;

        // Income filter
        const leadIncome = Number(lead.income ?? 0);
        if (ap.income_min != null && leadIncome < Number(ap.income_min)) return false;
        if (ap.income_max != null && leadIncome > Number(ap.income_max)) return false;

        // Province filter
        if (ap.state && lead.province && lead.province !== ap.state) return false;

        // City filter
        if (ap.city && lead.city && !lead.city.toLowerCase().includes(ap.city.toLowerCase())) return false;

        // Vehicle preference / car type filter
        const carTypes = (ap.car_type as string[]) ?? [];
        if (carTypes.length > 0 && lead.vehicle_preference) {
          const pref = lead.vehicle_preference.toLowerCase();
          if (!carTypes.some((t) => pref.includes(t))) return false;
        }

        // Make filter
        if (ap.make && lead.vehicle_preference && !lead.vehicle_preference.toLowerCase().includes(ap.make.toLowerCase())) return false;

        return true;
      });

      // Limit to remaining daily quota & monthly quota
      let maxToBuy = remaining;
      if (leadsLimit !== null) {
        maxToBuy = Math.min(maxToBuy, leadsLimit - currentMonthUsage);
      }
      matchingLeads = matchingLeads.slice(0, maxToBuy);

      let currentBalance = Number(dealer.wallet_balance);
      let purchased = 0;

      for (const lead of matchingLeads) {
        const price = Number(lead.price);
        if (currentBalance < price) {
          dealerResult.errors.push("Insufficient balance");
          break;
        }

        // Atomically mark as sold
        const { error: updateErr } = await admin
          .from("leads")
          .update({
            sold_status: "sold",
            sold_to_dealer_id: dealer.id,
            sold_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("sold_status", "available");

        if (updateErr) continue;

        // Mark in-memory so other dealers don't try to buy it
        lead.sold_status = "sold";

        currentBalance -= price;
        await admin.from("dealers").update({ wallet_balance: currentBalance }).eq("id", dealer.id);

        await admin.from("wallet_transactions").insert({
          dealer_id: dealer.id,
          type: "autopay",
          amount: -price,
          balance_after: currentBalance,
          description: `AutoPay: purchased lead ${lead.reference_code}`,
          reference_id: lead.id,
        });

        await admin.from("purchases").insert({
          dealer_id: dealer.id,
          lead_id: lead.id,
          price_paid: price,
          dealer_tier_at_purchase: effectiveTier,
          delivery_status: "pending",
          delivery_method: "autopay",
        });

        purchased++;
      }

      // Update monthly usage
      if (purchased > 0 && leadsLimit !== null) {
        const { data: existingUsage } = await admin
          .from("dealer_subscription_usage")
          .select("id, leads_used")
          .eq("dealer_id", dealer.id)
          .eq("period_start", periodStart)
          .maybeSingle();

        if (existingUsage) {
          await admin
            .from("dealer_subscription_usage")
            .update({ leads_used: existingUsage.leads_used + purchased })
            .eq("id", existingUsage.id);
        } else if (leadsLimit) {
          await admin.from("dealer_subscription_usage").insert({
            dealer_id: dealer.id,
            period_start: periodStart,
            leads_used: purchased,
            leads_limit: leadsLimit,
          });
        }
      }

      dealerResult.purchased = purchased;
      results.push(dealerResult);
      if (purchased > 0) {
        console.log(`AutoPay: dealer ${dealer.id} purchased ${purchased} leads`);
      }
    }

    const totalPurchased = results.reduce((s, r) => s + r.purchased, 0);
    return new Response(
      JSON.stringify({ processed: allSettings.length, total_purchased: totalPurchased, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-autopay error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
