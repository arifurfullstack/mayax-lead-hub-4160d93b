import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// --- Inline scoring logic (must match src/lib/leadScoring.ts) ---
const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

function calculateAiScore(lead: {
  income?: number | null;
  vehicle_preference?: string | null;
  buyer_type?: string | null;
  notes?: string | null;
  appointment_time?: string | null;
  trade_in?: boolean | null;
}): { ai_score: number; quality_grade: string } {
  let score = 65;
  const income = lead.income ?? 0;
  if (income >= 5000) score += 10;
  else if (income >= 1800) score += 5;

  const veh = (lead.vehicle_preference ?? "").trim().toLowerCase();
  if (veh) {
    score += GENERIC_VEHICLES.some((g) => veh === g) ? 5 : 10;
  }

  const combined = `${lead.buyer_type ?? ""} ${lead.notes ?? ""}`.toLowerCase();
  if (lead.trade_in || /trade|refinanc/.test(combined)) score += 5;
  if (/bankrupt/.test(lead.notes ?? "")) score += 5;
  if (lead.appointment_time) score += 5;
  if ((lead.income ?? 0) > 0 && veh) score += 5;

  score = Math.min(score, 100);

  let quality_grade: string;
  if (score >= 97) quality_grade = "A+";
  else if (score >= 93) quality_grade = "A";
  else if (score >= 89) quality_grade = "B+";
  else if (score >= 85) quality_grade = "B";
  else if (score >= 81) quality_grade = "C+";
  else if (score >= 77) quality_grade = "C";
  else if (score >= 73) quality_grade = "D+";
  else quality_grade = "D";

  return { ai_score: score, quality_grade };
}

const GRADE_PRICES: Record<string, number> = {
  "A+": 50, A: 40, "B+": 30, B: 25, "C+": 20, C: 15, "D+": 10, D: 5,
};

function getGradePrice(grade: string): number {
  return GRADE_PRICES[grade] ?? 15;
}
// --- End scoring logic ---

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
    const results: { reference_code: string; status: string; ai_score?: number; quality_grade?: string; price?: number; error?: string }[] = [];

    for (const lead of leadsInput) {
      // Validate required fields — price is NO LONGER required from input
      if (!lead.first_name || !lead.last_name) {
        results.push({
          reference_code: lead.reference_code ?? "unknown",
          status: "error",
          error: "Missing required fields: first_name, last_name",
        });
        continue;
      }

      // Generate reference code if not provided
      const referenceCode =
        lead.reference_code ?? `INB-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      // Auto-compute AI score, grade, and price
      const { ai_score, quality_grade } = calculateAiScore({
        income: lead.income != null ? Number(lead.income) : null,
        vehicle_preference: lead.vehicle_preference ?? null,
        buyer_type: lead.buyer_type ?? "online",
        notes: lead.notes ?? null,
        appointment_time: lead.appointment_time ?? null,
        trade_in: lead.trade_in === true,
      });

      const price = getGradePrice(quality_grade);

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
        notes: lead.notes ?? null,
        trade_in: lead.trade_in === true,
        quality_grade,
        ai_score,
        price,
        sold_status: "available",
        appointment_time: lead.appointment_time ?? null,
      };

      const { error } = await admin.from("leads").insert(insertData);

      if (error) {
        results.push({ reference_code: referenceCode, status: "error", error: error.message });
      } else {
        results.push({ reference_code: referenceCode, status: "created", ai_score, quality_grade, price });
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
