import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fireDealerWebhook(
  admin: any,
  dealer: { id: string; webhook_url: string | null; webhook_secret: string | null; dealership_name: string },
  lead: any,
  purchaseId: string,
  pricePaid: number,
) {
  const url = (dealer.webhook_url || "").trim();
  if (!url) return;

  const payload = {
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    city: lead.city ?? "",
    province: lead.province ?? "",
    income: lead.income ?? "",
    credit_range_min: lead.credit_range_min ?? "",
    credit_range_max: lead.credit_range_max ?? "",
    vehicle_preference: lead.vehicle_preference ?? "",
    trade_in: !!lead.trade_in,
    "trade_in vehicle": lead.trade_in_vehicle ?? "",
    bankruptcy: lead.has_bankruptcy ? "yes" : "",
    notes: lead.notes ?? "",
  };
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "MayaX-Webhook/1.0",
    "X-MayaX-Event": "lead.purchased",
    "X-MayaX-Reference": lead.reference_code,
  };
  if (dealer.webhook_secret) {
    try {
      headers["X-MayaX-Signature"] = `sha256=${await hmacSha256Hex(dealer.webhook_secret, body)}`;
    } catch (_) { /* ignore signing errors */ }
  }

  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [0, 1000, 2000]; // wait before attempts 1, 2, 3 (exponential: 0, 1s, 2s after prior 1s = total 1s, 3s)

  let success = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt - 1] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }

    let responseCode: number | null = null;
    let errorDetails: string | null = null;
    let attemptSuccess = false;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(timeout);
      responseCode = res.status;
      attemptSuccess = res.ok;
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        errorDetails = txt.slice(0, 500);
      }
    } catch (err) {
      errorDetails = (err as Error).message?.slice(0, 500) || "Webhook request failed";
    }

    // (response info captured in delivery_logs above)

    const summary = `lead.purchased ${lead.reference_code} (attempt ${attempt}/${MAX_ATTEMPTS})`;
    await admin.from("delivery_logs").insert({
      purchase_id: purchaseId,
      channel: "webhook",
      endpoint: url,
      success: attemptSuccess,
      response_code: responseCode,
      error_details: errorDetails,
      payload_summary: summary,
    });

    if (attemptSuccess) {
      success = true;
      break;
    }
  }

  if (!success) {
    await admin.from("purchases").update({ delivery_status: "failed" }).eq("id", purchaseId);
  }
}

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

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const leadIds: string[] = Array.isArray(body.lead_ids) ? body.lead_ids : [body.lead_id];
    const targetDealerId: string | undefined = typeof body.target_dealer_id === "string" ? body.target_dealer_id : undefined;
    const giftMode: boolean = body.gift === true;

    if (!leadIds.length || leadIds.some((id) => typeof id !== "string")) {
      return new Response(JSON.stringify({ error: "Invalid lead_id(s)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin
    const { data: adminRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    // If admin requests buying on behalf of a target dealer, allow it.
    // Otherwise (or for non-admins), use the caller's own dealer record.
    let dealerQuery = admin
      .from("dealers")
      .select("id, wallet_balance, subscription_tier, webhook_url, webhook_secret, dealership_name, email, notification_email");

    if (isAdmin && targetDealerId) {
      dealerQuery = dealerQuery.eq("id", targetDealerId);
    } else {
      if (!isAdmin && (targetDealerId || giftMode)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      dealerQuery = dealerQuery.eq("user_id", user.id);
    }

    const { data: dealer, error: dealerErr } = await dealerQuery.single();

    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins may use gift mode
    const isGift = isAdmin && giftMode;

    // Check if dealer has an active promo code
    let promoInfo: { id: string; type: string; flat_price: number; discount_value: number } | null = null;
    const { data: dealerPromo } = await admin
      .from("dealer_promo_codes")
      .select("promo_code_id")
      .eq("dealer_id", dealer.id)
      .maybeSingle();

    if (dealerPromo) {
      const { data: promo } = await admin
        .from("promo_codes")
        .select("id, flat_price, discount_type, discount_value, is_active, max_uses, times_used, expires_at")
        .eq("id", dealerPromo.promo_code_id)
        .single();

      if (promo && promo.is_active) {
        const notExpired = !promo.expires_at || new Date(promo.expires_at) > new Date();
        const notMaxed = promo.max_uses === null || promo.times_used < promo.max_uses;
        if (notExpired && notMaxed) {
          promoInfo = {
            id: promo.id,
            type: promo.discount_type || "flat",
            flat_price: Number(promo.flat_price),
            discount_value: Number(promo.discount_value || 0),
          };
        }
      }
    }

    const { data: activeSub } = await admin
      .from("subscriptions")
      .select("delay_hours, leads_per_month, plan_id")
      .eq("dealer_id", dealer.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fallbackDelays: Record<string, number> = { vip: 0, elite: 6, pro: 12, basic: 24 };
    const delayHours = activeSub?.delay_hours ?? fallbackDelays[dealer.subscription_tier] ?? 24;
    const leadsLimit = activeSub?.leads_per_month ?? null;

    const now = new Date();
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    let currentUsage = 0;
    if (leadsLimit !== null) {
      const { data: usageRow } = await admin
        .from("dealer_subscription_usage")
        .select("leads_used")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStart)
        .maybeSingle();

      currentUsage = usageRow?.leads_used ?? 0;

      if (currentUsage + leadIds.length > leadsLimit) {
        return new Response(JSON.stringify({
          error: `Monthly lead limit reached (${currentUsage}/${leadsLimit}). Upgrade your plan for more leads.`,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const results: Array<{ lead_id: string; success: boolean; error?: string }> = [];
    const successfulPurchases: Array<{ lead: any; price: number; purchaseId: string }> = [];
    let currentBalance = Number(dealer.wallet_balance);
    let purchasedCount = 0;

    for (const leadId of leadIds) {
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

      // Check tier delay (admins bypass when buying on behalf or gifting)
      if (delayHours > 0 && !isAdmin) {
        const leadAge = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
        if (leadAge < delayHours) {
          results.push({ lead_id: leadId, success: false, error: `Lead locked for ${Math.ceil(delayHours - leadAge)}h (upgrade tier for earlier access)` });
          continue;
        }
      }

      // Calculate price based on promo type
      const originalPrice = Number(lead.price);
      let price = originalPrice;
      if (promoInfo) {
        if (promoInfo.type === "percentage") {
          price = Math.max(0, originalPrice * (1 - promoInfo.discount_value / 100));
          price = Math.round(price * 100) / 100; // round to cents
        } else {
          price = promoInfo.flat_price;
        }
      }

      // Gift mode: assign at $0 with no wallet deduction
      const effectivePrice = isGift ? 0 : price;

      if (!isGift && currentBalance < price) {
        results.push({ lead_id: leadId, success: false, error: "Insufficient wallet balance" });
        continue;
      }

      if (leadsLimit !== null && currentUsage + purchasedCount + 1 > leadsLimit) {
        results.push({ lead_id: leadId, success: false, error: "Monthly lead limit reached" });
        continue;
      }

      // Mark lead as sold
      const { error: updateErr } = await admin
        .from("leads")
        .update({
          sold_status: "sold",
          sold_to_dealer_id: dealer.id,
          sold_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("sold_status", "available");

      if (updateErr) {
        results.push({ lead_id: leadId, success: false, error: "Failed to lock lead" });
        continue;
      }

      // Deduct wallet (skip for gifts)
      if (!isGift) {
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
          description: `Purchased lead ${lead.reference_code}${promoInfo ? " (promo)" : ""}`,
          reference_id: leadId,
        });
      } else {
        // Log a $0 admin gift for audit trail
        await admin.from("wallet_transactions").insert({
          dealer_id: dealer.id,
          type: "admin_gift",
          amount: 0,
          balance_after: currentBalance,
          description: `Admin gifted lead ${lead.reference_code}`,
          reference_id: leadId,
        });
      }

      // Record purchase
      const { data: purchaseRow } = await admin.from("purchases").insert({
        dealer_id: dealer.id,
        lead_id: leadId,
        price_paid: effectivePrice,
        dealer_tier_at_purchase: dealer.subscription_tier,
        delivery_status: "delivered",
        delivery_method: dealer.webhook_url ? "webhook" : "email",
      }).select("id").single();

      // Fire dealer webhook (if configured) — non-blocking for the response status
      if (purchaseRow?.id && dealer.webhook_url) {
        await fireDealerWebhook(admin, dealer, lead, purchaseRow.id, effectivePrice);
      }

      // Collect for combined email (sent once after the loop)
      if (purchaseRow?.id) {
        successfulPurchases.push({ lead, price: effectivePrice, purchaseId: purchaseRow.id });
      }


      // Increment promo usage and log it if applicable
      if (promoInfo && dealerPromo) {
        const { data: currentPromo } = await admin.from("promo_codes").select("times_used").eq("id", dealerPromo.promo_code_id).single();
        await admin
          .from("promo_codes")
          .update({ times_used: (currentPromo?.times_used ?? 0) + 1 })
          .eq("id", dealerPromo.promo_code_id);

        await admin.from("promo_code_usage").insert({
          dealer_id: dealer.id,
          promo_code_id: dealerPromo.promo_code_id,
          lead_id: leadId,
          price_paid: price,
          original_price: originalPrice,
        });
      }

      purchasedCount++;
      results.push({ lead_id: leadId, success: true });
    }

    // Send a SINGLE confirmation email covering all successful purchases
    const recipientEmail = dealer.notification_email || dealer.email;
    const sendEmail = async (payload: Record<string, unknown>) => {
      const url = `${supabaseUrl}/functions/v1/send-transactional-email`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("send-transactional-email failed", { status: res.status, body: txt });
      } else {
        console.log("send-transactional-email queued", { template: payload.templateName, to: payload.recipientEmail });
      }
    };

    if (recipientEmail && successfulPurchases.length > 0) {
      try {
        const totalPaid = successfulPurchases.reduce((sum, p) => sum + p.price, 0);

        if (successfulPurchases.length === 1) {
          const { lead, price, purchaseId } = successfulPurchases[0];
          await sendEmail({
            templateName: "lead-purchased",
            recipientEmail,
            idempotencyKey: `lead-purchased-${purchaseId}`,
            templateData: {
              reference_code: lead.reference_code,
              price_paid: price,
              dealership_name: dealer.dealership_name,
              lead: {
                first_name: lead.first_name ?? "",
                last_name: lead.last_name ?? "",
                email: lead.email ?? "",
                phone: lead.phone ?? "",
                city: lead.city ?? "",
                province: lead.province ?? "",
                income: lead.income ?? "",
                credit_range_min: lead.credit_range_min ?? "",
                credit_range_max: lead.credit_range_max ?? "",
                vehicle_preference: lead.vehicle_preference ?? "",
                trade_in: !!lead.trade_in,
                trade_in_vehicle: lead.trade_in_vehicle ?? "",
                bankruptcy: lead.has_bankruptcy ? "yes" : "",
                notes: lead.notes ?? "",
              },
            },
          });
        } else {
          const purchaseIds = successfulPurchases.map((p) => p.purchaseId).sort().join("-");
          await sendEmail({
            templateName: "leads-purchased-bulk",
            recipientEmail,
            idempotencyKey: `leads-bulk-${purchaseIds}`,
            templateData: {
              dealership_name: dealer.dealership_name,
              total_paid: totalPaid,
              lead_count: successfulPurchases.length,
              leads: successfulPurchases.map(({ lead, price }) => ({
                reference_code: lead.reference_code,
                first_name: lead.first_name ?? "",
                last_name: lead.last_name ?? "",
                email: lead.email ?? "",
                phone: lead.phone ?? "",
                city: lead.city ?? "",
                province: lead.province ?? "",
                vehicle_preference: lead.vehicle_preference ?? "",
                price_paid: price,
              })),
            },
          });
        }
      } catch (emailErr) {
        console.error("Failed to send purchase confirmation email", emailErr);
      }
    }

    // Create in-app notifications for each successful purchase
    if (successfulPurchases.length > 0) {
      try {
        const notifs = successfulPurchases.map(({ lead, price, purchaseId }) => ({
          dealer_id: dealer.id,
          title: isGift
            ? `🎁 Lead gifted — ${lead.first_name} ${lead.last_name}`
            : `New lead purchased — ${lead.first_name} ${lead.last_name}`,
          message: `Reference ${lead.reference_code}${isGift ? "" : ` • $${Number(price).toFixed(2)}`} • ${lead.city ?? ""}${lead.province ? `, ${lead.province}` : ""}`,
          link: `/orders?purchase=${purchaseId}`,
        }));
        const { error: notifErr } = await admin.from("notifications").insert(notifs);
        if (notifErr) console.error("Failed to create purchase notifications", notifErr);
      } catch (notifErr) {
        console.error("Failed to create purchase notifications", notifErr);
      }
    }

    // Update monthly usage
    if (purchasedCount > 0 && leadsLimit !== null) {
      const { data: existingUsage } = await admin
        .from("dealer_subscription_usage")
        .select("id, leads_used")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStart)
        .maybeSingle();

      if (existingUsage) {
        await admin
          .from("dealer_subscription_usage")
          .update({ leads_used: existingUsage.leads_used + purchasedCount })
          .eq("id", existingUsage.id);
      } else {
        await admin.from("dealer_subscription_usage").insert({
          dealer_id: dealer.id,
          period_start: periodStart,
          leads_used: purchasedCount,
          leads_limit: leadsLimit,
        });
      }
    }

    return new Response(
      JSON.stringify({
        results,
        new_balance: currentBalance,
        purchased: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        usage: leadsLimit !== null ? {
          leads_used: currentUsage + purchasedCount,
          leads_limit: leadsLimit,
        } : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
