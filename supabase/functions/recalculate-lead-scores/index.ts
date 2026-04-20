import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

type Op = "gte" | "lte" | "between" | "specific" | "generic" | "true" | "present" | "count_capped";
interface Rule { id: string; label: string; field: string; op: Op; value?: number | number[]; points: number; }
interface Bucket { grade: string; min: number; max: number; }

const DEFAULT_RULES: { base: number; rules: Rule[] } = {
  base: 65,
  rules: [
    { id: "income_high", label: "Income ≥ $5,000", field: "income", op: "gte", value: 5000, points: 15 },
    { id: "income_mid", label: "Income $1,800–$4,999", field: "income", op: "between", value: [1800, 4999], points: 8 },
    { id: "vehicle_specific", label: "Specific vehicle preference", field: "vehicle_preference", op: "specific", points: 10 },
    { id: "vehicle_generic", label: "Generic vehicle preference", field: "vehicle_preference", op: "generic", points: 5 },
    { id: "trade_in", label: "Trade-in available", field: "trade_in", op: "true", points: 5 },
    { id: "appointment", label: "Appointment scheduled", field: "appointment_time", op: "present", points: 5 },
    { id: "bankruptcy", label: "Bankruptcy disclosed", field: "has_bankruptcy", op: "true", points: 3 },
    { id: "email", label: "Email provided", field: "email", op: "present", points: 2 },
    { id: "phone", label: "Phone provided", field: "phone", op: "present", points: 2 },
    { id: "docs", label: "Documents uploaded", field: "document_files", op: "count_capped", value: 3, points: 3 },
  ],
};
const DEFAULT_BUCKETS: { buckets: Bucket[] } = {
  buckets: [
    { grade: "A+", min: 95, max: 100 },
    { grade: "A", min: 88, max: 94 },
    { grade: "B+", min: 82, max: 87 },
    { grade: "B", min: 75, max: 81 },
    { grade: "C+", min: 68, max: 74 },
    { grade: "C", min: 60, max: 67 },
    { grade: "D+", min: 50, max: 59 },
    { grade: "D", min: 0, max: 49 },
  ],
};

function evalRule(rule: Rule, lead: Record<string, unknown>): number {
  const v = lead[rule.field];
  switch (rule.op) {
    case "gte": return (typeof v === "number" ? v : Number(v ?? 0)) >= Number(rule.value ?? 0) ? rule.points : 0;
    case "lte": return (typeof v === "number" ? v : Number(v ?? 0)) <= Number(rule.value ?? 0) ? rule.points : 0;
    case "between": {
      const n = typeof v === "number" ? v : Number(v ?? 0);
      const r = Array.isArray(rule.value) ? rule.value : [0, 0];
      return n >= r[0] && n <= r[1] ? rule.points : 0;
    }
    case "specific": {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      return s && !GENERIC_VEHICLES.includes(s) ? rule.points : 0;
    }
    case "generic": {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      return s && GENERIC_VEHICLES.includes(s) ? rule.points : 0;
    }
    case "true": return v === true ? rule.points : 0;
    case "present": {
      if (v === null || v === undefined) return 0;
      if (typeof v === "string" && v.trim() === "") return 0;
      return rule.points;
    }
    case "count_capped": {
      const cap = Number(rule.value ?? 1);
      const count = Array.isArray(v) ? v.length : (typeof v === "number" ? v : 0);
      return Math.min(count, cap) * rule.points;
    }
    default: return 0;
  }
}

function gradeFor(score: number, buckets: Bucket[]): string {
  const sorted = [...buckets].sort((a, b) => b.min - a.min);
  for (const b of sorted) if (score >= b.min && score <= b.max) return b.grade;
  return sorted[sorted.length - 1]?.grade ?? "D";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // Auth: require admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.claims.sub)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: jsonHeaders });
  }

  // Load grading config
  const { data: settingsRows } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["grading_score_rules", "grading_grade_buckets"]);

  let scoreCfg = DEFAULT_RULES;
  let bucketCfg = DEFAULT_BUCKETS;
  for (const row of settingsRows ?? []) {
    try {
      if (row.key === "grading_score_rules" && row.value) {
        const p = JSON.parse(row.value);
        if (typeof p?.base === "number" && Array.isArray(p?.rules)) scoreCfg = p;
      }
      if (row.key === "grading_grade_buckets" && row.value) {
        const p = JSON.parse(row.value);
        if (Array.isArray(p?.buckets) && p.buckets.length > 0) bucketCfg = p;
      }
    } catch { /* ignore */ }
  }

  // Fetch all leads (paged to avoid 1000-row cap)
  const all: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, income, vehicle_preference, trade_in, has_bankruptcy, appointment_time, email, phone, document_files, documents, ai_score, quality_grade")
      .range(from, from + pageSize - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let updated = 0;
  for (const lead of all) {
    let score = scoreCfg.base;
    for (const r of scoreCfg.rules) score += evalRule(r, lead);
    score = Math.min(100, Math.max(0, Math.round(score)));
    const grade = gradeFor(score, bucketCfg.buckets);
    if (lead.ai_score !== score || lead.quality_grade !== grade) {
      const { error: updErr } = await supabase
        .from("leads")
        .update({ ai_score: score, quality_grade: grade })
        .eq("id", lead.id as string);
      if (!updErr) updated++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, total: all.length, updated }),
    { status: 200, headers: jsonHeaders }
  );
});
