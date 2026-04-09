import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Check webhook secret if configured
    const { data: secretSetting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "inbound_webhook_secret")
      .single();

    const configuredSecret = secretSetting?.value?.trim();
    if (configuredSecret) {
      const providedSecret = req.headers.get("x-webhook-secret") ?? "";
      if (providedSecret !== configuredSecret) {
        return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();

    // Support single lead or array of leads
    const leadsInput = Array.isArray(body) ? body : [body];
    const results: { reference_code: string; status: string; error?: string }[] = [];

    for (const lead of leadsInput) {
      // Validate required fields
      if (!lead.first_name || !lead.last_name || lead.price == null) {
        results.push({
          reference_code: lead.reference_code ?? "unknown",
          status: "error",
          error: "Missing required fields: first_name, last_name, price",
        });
        continue;
      }

      // Generate reference code if not provided
      const referenceCode =
        lead.reference_code ?? `INB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const insertData: Record<string, unknown> = {
        reference_code: referenceCode,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        city: lead.city ?? null,
        province: lead.province ?? null,
        buyer_type: lead.buyer_type ?? "online",
        credit_range_min: lead.credit_range_min ?? null,
        credit_range_max: lead.credit_range_max ?? null,
        income: lead.income ?? null,
        vehicle_preference: lead.vehicle_preference ?? null,
        vehicle_mileage: lead.vehicle_mileage ?? null,
        vehicle_price: lead.vehicle_price ?? null,
        quality_grade: lead.quality_grade ?? "B",
        ai_score: lead.ai_score ?? 0,
        price: Number(lead.price),
        sold_status: "available",
        appointment_time: lead.appointment_time ?? null,
      };

      const { error } = await admin.from("leads").insert(insertData);

      if (error) {
        results.push({ reference_code: referenceCode, status: "error", error: error.message });
      } else {
        results.push({ reference_code: referenceCode, status: "created" });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Inbound webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
