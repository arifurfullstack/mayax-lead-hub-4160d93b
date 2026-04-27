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

// --- Dynamic pricing logic ---
interface PricingSettings {
  lead_price_base: number;
  lead_price_income_tier1: number;
  lead_price_income_tier2: number;
  lead_price_vehicle: number;
  lead_price_trade: number;
  lead_price_bankruptcy: number;
  lead_price_appointment: number;
}

function parseNumericInput(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/[$£€¥]/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stripGroupingCommasFromJsonNumbers(raw: string): string {
  return raw.replace(
    /(:\s*)(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)(?=\s*[,}\]])/g,
    (_match, prefix: string, numericValue: string) => `${prefix}${numericValue.replace(/,/g, "")}`,
  );
}

function parseInboundPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Request body is empty");
  }

  try {
    return JSON.parse(trimmed);
  } catch (originalError) {
    const sanitized = stripGroupingCommasFromJsonNumbers(trimmed);
    if (sanitized !== trimmed) {
      return JSON.parse(sanitized);
    }
    throw originalError;
  }
}

const DEFAULT_PRICING: PricingSettings = {
  lead_price_base: 15,
  lead_price_income_tier1: 5,
  lead_price_income_tier2: 10,
  lead_price_vehicle: 5,
  lead_price_trade: 15,
  lead_price_bankruptcy: 15,
  lead_price_appointment: 10,
};

function parsePricingFromRows(rows: { key: string; value: string | null }[]): PricingSettings {
  const p = { ...DEFAULT_PRICING };
  for (const row of rows) {
    if (row.key in p && row.value) {
      (p as any)[row.key] = Number(row.value);
    }
  }
  return p;
}

function calculateDynamicPrice(lead: {
  income?: number | null;
  vehicle_preference?: string | null;
  trade_in?: boolean;
  has_bankruptcy?: boolean;
  appointment_time?: string | null;
}, settings: PricingSettings): number {
  let total = settings.lead_price_base;
  const inc = lead.income ?? 0;
  if (inc >= 5000) total += settings.lead_price_income_tier1 + settings.lead_price_income_tier2;
  else if (inc >= 1800) total += settings.lead_price_income_tier1;
  if ((lead.vehicle_preference ?? "").trim()) total += settings.lead_price_vehicle;
  if (lead.trade_in) total += settings.lead_price_trade;
  if (lead.has_bankruptcy) total += settings.lead_price_bankruptcy;
  if (lead.appointment_time) total += settings.lead_price_appointment;
  return total;
}

function parseNotesFlags(notes: string | null | undefined): {
  trade_in: boolean;
  has_bankruptcy: boolean;
  has_appointment: boolean;
} {
  const text = (notes ?? "").toLowerCase();
  return {
    trade_in: /trade[-\s]?in|trade/.test(text),
    has_bankruptcy: /bankrupt/.test(text),
    has_appointment: /call\s?(me|today|at)|phone\s?appointment/.test(text),
  };
}

function normalizePhoneDigits(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
// --- End pricing logic ---

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

    // --- Inbound observability ---
    const requestId = crypto.randomUUID();
    const sourceIp =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const hasSecretHeader = !!(req.headers.get("x-webhook-secret") ?? "").trim();
    console.log(
      `[inbound-webhook ${requestId}] HIT method=${req.method} ip=${sourceIp} ua="${userAgent}" hasSecret=${hasSecretHeader}`,
    );

    // Fetch all platform_settings (webhook secret + pricing)
    const { data: settingsRows } = await admin
      .from("platform_settings")
      .select("key, value");

    const allSettings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => { allSettings[r.key] = r.value ?? ""; });

    // Check webhook secret if configured
    const configuredSecret = allSettings["inbound_webhook_secret"]?.trim();
    if (configuredSecret) {
      const providedSecret = req.headers.get("x-webhook-secret") ?? "";
      if (providedSecret !== configuredSecret) {
        console.warn(
          `[inbound-webhook ${requestId}] 401 invalid secret hasSecretHeader=${hasSecretHeader} ip=${sourceIp} ua="${userAgent}"`,
        );
        return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse pricing settings
    const pricing = parsePricingFromRows(settingsRows ?? []);

    let body: unknown;
    let rawBytes = 0;
    try {
      const raw = await req.text();
      rawBytes = raw.length;
      body = parseInboundPayload(raw);
    } catch (_error) {
      console.error(
        `[inbound-webhook ${requestId}] 400 invalid JSON bytes=${rawBytes}`,
      );
      return new Response(JSON.stringify({
        error: 'Invalid payload. Send amounts as plain numbers (12345) or quoted strings ("12,345").',
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const leadsInput = Array.isArray(body) ? body : [body];
    console.log(
      `[inbound-webhook ${requestId}] parsed bytes=${rawBytes} count=${leadsInput.length} summary=` +
        JSON.stringify(
          leadsInput.slice(0, 5).map((l: any) => ({
            first_name: l?.first_name ?? null,
            last_name: l?.last_name ?? null,
            email: l?.email ?? null,
            phone: l?.phone ?? null,
            reference_code: l?.reference_code ?? null,
          })),
        ),
    );
    const results: { reference_code: string; status: string; ai_score?: number; quality_grade?: string; price?: number; error?: string }[] = [];

    for (const lead of leadsInput) {
      if (!lead.first_name || !lead.last_name) {
        results.push({
          reference_code: lead.reference_code ?? "unknown",
          status: "error",
          error: "Missing required fields: first_name, last_name",
        });
        continue;
      }

      const inboundEmail = typeof lead.email === "string" ? lead.email.trim() : "";
      const inboundPhone = typeof lead.phone === "string" ? lead.phone.trim() : "";
      const inboundPhoneDigits = normalizePhoneDigits(inboundPhone);

      let matchedLead: {
        id: string;
        reference_code: string;
        phone: string | null;
        email: string | null;
        notes: string | null;
        sold_to_dealer_id: string | null;
        sold_status: string;
      } | null = null;

      if (inboundEmail) {
        const { data: byEmail } = await admin
          .from("leads")
          .select("id, reference_code, phone, email, notes, sold_to_dealer_id, sold_status")
          .ilike("email", inboundEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byEmail) matchedLead = byEmail;
      }

      if (!matchedLead && inboundPhoneDigits.length >= 7) {
        const { data: phoneCandidates } = await admin
          .from("leads")
          .select("id, reference_code, phone, email, notes, sold_to_dealer_id, sold_status")
          .not("phone", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000);

        matchedLead = (phoneCandidates ?? []).find((candidate: { phone: string | null }) => {
          return normalizePhoneDigits(candidate.phone) === inboundPhoneDigits;
        }) ?? null;
      }

      const year = new Date().getFullYear();
      const seq = String(Math.floor(Math.random() * 900) + 100);
      const referenceCode = matchedLead?.reference_code ?? lead.reference_code ?? `MX-${year}-${seq}`;

      // Parse notes for hidden flags
      const notesFlags = parseNotesFlags(lead.notes);
      const trade_in = lead.trade_in === true || notesFlags.trade_in;
      const has_bankruptcy = notesFlags.has_bankruptcy;
      const has_appointment = notesFlags.has_appointment;
      const appointment_time = (lead.appointment_time && lead.appointment_time.trim() !== "") ? lead.appointment_time : (has_appointment ? new Date().toISOString() : null);
      const income = parseNumericInput(lead.income);
      const credit_range_min = parseNumericInput(lead.credit_range_min);
      const credit_range_max = parseNumericInput(lead.credit_range_max);
      const vehicle_mileage = parseNumericInput(lead.vehicle_mileage);
      const vehicle_price = parseNumericInput(lead.vehicle_price);

      // AI score (unchanged)
      const { ai_score, quality_grade } = calculateAiScore({
        income,
        vehicle_preference: lead.vehicle_preference ?? null,
        buyer_type: lead.buyer_type ?? "online",
        notes: lead.notes ?? null,
        appointment_time,
        trade_in,
      });

      // Dynamic price
      const price = calculateDynamicPrice({
        income,
        vehicle_preference: lead.vehicle_preference ?? null,
        trade_in,
        has_bankruptcy,
        appointment_time,
      }, pricing);

      const leadData: Record<string, unknown> = {
        reference_code: referenceCode,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: inboundEmail || null,
        phone: inboundPhone || null,
        city: lead.city ?? null,
        province: lead.province ?? null,
        buyer_type: lead.buyer_type ?? "online",
        credit_range_min,
        credit_range_max,
        income,
        vehicle_preference: lead.vehicle_preference ?? null,
        vehicle_mileage,
        vehicle_price,
        notes: lead.notes ?? null,
        trade_in,
        has_bankruptcy,
        quality_grade,
        ai_score,
        price,
        sold_status: "available",
        appointment_time,
      };

      if (matchedLead) {
        const appendedNotes = lead.notes
          ? (matchedLead.notes ? `${matchedLead.notes}\n\n[Inbound update] ${lead.notes}` : `[Inbound update] ${lead.notes}`)
          : matchedLead.notes;

        const updateData: Record<string, unknown> = {
          notes: appendedNotes,
        };

        if (matchedLead.sold_status === "available") {
          Object.assign(updateData, {
            ...leadData,
            notes: appendedNotes,
          });
        }

        const { error } = await admin.from("leads").update(updateData).eq("id", matchedLead.id);

        if (error) {
          console.error(
            `[inbound-webhook ${requestId}] update error ref=${referenceCode} match_id=${matchedLead.id} sold_status=${matchedLead.sold_status} error="${error.message}"`,
          );
          results.push({ reference_code: referenceCode, status: "error", error: error.message });
        } else {
          const status = matchedLead.sold_status === "available" ? "updated" : "merged";
          console.log(
            `[inbound-webhook ${requestId}] ${status} ref=${referenceCode} match_id=${matchedLead.id} sold_status=${matchedLead.sold_status} price=${price} grade=${quality_grade}`,
          );
          results.push({
            reference_code: referenceCode,
            status,
            ai_score,
            quality_grade,
            price,
          });
        }
        continue;
      }

      const { error } = await admin.from("leads").insert(leadData);

      if (error) {
        console.error(
          `[inbound-webhook ${requestId}] insert error ref=${referenceCode} email=${inboundEmail || "none"} phone=${inboundPhoneDigits || "none"} error="${error.message}"`,
        );
        results.push({ reference_code: referenceCode, status: "error", error: error.message });
      } else {
        console.log(
          `[inbound-webhook ${requestId}] created ref=${referenceCode} email=${inboundEmail || "none"} phone=${inboundPhoneDigits || "none"} price=${price} grade=${quality_grade} ai_score=${ai_score}`,
        );
        results.push({ reference_code: referenceCode, status: "created", ai_score, quality_grade, price });
      }
    }

    console.log(
      `[inbound-webhook ${requestId}] DONE results=` + JSON.stringify(results),
    );
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    console.error("Inbound webhook error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
