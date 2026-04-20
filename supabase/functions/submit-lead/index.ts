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

async function loadGradingConfig(supabase: ReturnType<typeof createClient>) {
  let scoreCfg = DEFAULT_RULES;
  let bucketCfg = DEFAULT_BUCKETS;
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["grading_score_rules", "grading_grade_buckets"]);
    for (const row of data ?? []) {
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
  } catch { /* ignore */ }
  return { scoreCfg, bucketCfg };
}

function calculateAiScore(
  lead: Record<string, unknown>,
  scoreCfg: { base: number; rules: Rule[] },
  bucketCfg: { buckets: Bucket[] },
): { ai_score: number; quality_grade: string } {
  let score = scoreCfg.base;
  for (const r of scoreCfg.rules) score += evalRule(r, lead);
  score = Math.min(100, Math.max(0, Math.round(score)));
  return { ai_score: score, quality_grade: gradeFor(score, bucketCfg.buckets) };
}

function generateRefCode(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `MX-${year}-${seq}`;
}

// Normalize phone to last 10 digits for matching
function normalizePhoneDigits(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any>;
    let files: { name: string; data: Uint8Array; type: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const jsonField = formData.get("data");
      if (!jsonField || typeof jsonField !== "string") {
        return new Response(JSON.stringify({ error: "Missing form data." }), { status: 400, headers: jsonHeaders });
      }
      body = JSON.parse(jsonField);

      // Collect uploaded files
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("file_") && value instanceof File) {
          if (files.length >= MAX_FILES) break;
          if (value.size > MAX_FILE_SIZE) {
            return new Response(
              JSON.stringify({ error: `File "${value.name}" exceeds 10MB limit.` }),
              { status: 400, headers: jsonHeaders }
            );
          }
          if (!ALLOWED_MIME.includes(value.type)) {
            return new Response(
              JSON.stringify({ error: `File type "${value.type}" is not allowed. Use PDF, JPG, PNG, or DOCX.` }),
              { status: 400, headers: jsonHeaders }
            );
          }
          const arrayBuf = await value.arrayBuffer();
          files.push({ name: value.name, data: new Uint8Array(arrayBuf), type: value.type });
        }
      }
    } else {
      body = await req.json();
    }

    // Validate required fields
    const firstName = (body.first_name ?? "").trim().slice(0, 100);
    const lastName = (body.last_name ?? "").trim().slice(0, 100);
    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: "First name and last name are required." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const email = (body.email ?? "").trim().slice(0, 255);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address." }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const phone = (body.phone ?? "").trim().slice(0, 20);
    const city = (body.city ?? "").trim().slice(0, 100);
    const province = (body.province ?? "").trim().slice(0, 50);
    const buyerType = (body.buyer_type ?? "online").slice(0, 30);
    const vehiclePref = (body.vehicle_preference ?? "").trim().slice(0, 200);
    const vehiclePrice = body.vehicle_price ? Number(body.vehicle_price) : null;
    const vehicleMileage = body.vehicle_mileage ? Number(body.vehicle_mileage) : null;
    const income = body.income ? Number(body.income) : null;
    const creditMin = body.credit_range_min ? Math.min(900, Math.max(300, Number(body.credit_range_min))) : null;
    const creditMax = body.credit_range_max ? Math.min(900, Math.max(300, Number(body.credit_range_max))) : null;
    const tradeIn = !!body.trade_in;
    const notes = (body.notes ?? "").trim().slice(0, 2000);
    const appointmentTime = body.appointment_time || null;
    const documents = Array.isArray(body.documents) ? body.documents.slice(0, 10) : null;

    const { ai_score, quality_grade } = calculateAiScore({
      income,
      vehicle_preference: vehiclePref,
      buyer_type: buyerType,
      trade_in: tradeIn,
      appointment_time: appointmentTime,
    });

    let price = 25;
    if (quality_grade === "A+") price = 75;
    else if (quality_grade === "A") price = 55;
    else if (quality_grade === "B") price = 35;

    // ── Dedup: try matching an existing lead by email or phone (last 10 digits) ──
    const phoneDigits = normalizePhoneDigits(phone);
    let matchedLead: any = null;

    if (email || phoneDigits.length >= 7) {
      // Match by email first (exact, case-insensitive)
      if (email) {
        const { data: byEmail } = await supabase
          .from("leads")
          .select("id, reference_code, phone, email, notes, documents, document_files, sold_to_dealer_id, sold_status, first_name, last_name, vehicle_preference, city, province, income, credit_range_min, credit_range_max, trade_in, appointment_time")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) matchedLead = byEmail;
      }

      // Fallback to phone match
      if (!matchedLead && phoneDigits.length >= 7) {
        const { data: candidates } = await supabase
          .from("leads")
          .select("id, reference_code, phone, email, notes, documents, document_files, sold_to_dealer_id, sold_status, first_name, last_name, vehicle_preference, city, province, income, credit_range_min, credit_range_max, trade_in, appointment_time")
          .not("phone", "is", null)
          .order("created_at", { ascending: false })
          .limit(500);
        matchedLead = (candidates || []).find((l: any) => {
          const lDigits = normalizePhoneDigits(l.phone || "");
          return lDigits && lDigits === phoneDigits;
        }) || null;
      }
    }

    const refCode = matchedLead?.reference_code || generateRefCode();

    // Upload files to storage
    const documentFiles: { name: string; path: string; type: string; size: number }[] = [];
    if (files.length > 0) {
      const folderPath = `public-submissions/${refCode}`;
      for (const file of files) {
        const ext = file.name.split(".").pop() || "bin";
        const storagePath = `${folderPath}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("lead-documents")
          .upload(storagePath, file.data, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }
        documentFiles.push({
          name: file.name,
          path: storagePath,
          type: file.type,
          size: file.data.length,
        });
      }
    }

    if (matchedLead) {
      // Merge documents
      const existingDocs: string[] = Array.isArray(matchedLead.documents) ? matchedLead.documents : [];
      const incomingDocs: string[] = Array.isArray(documents) ? documents : [];
      const mergedDocs = Array.from(new Set([...existingDocs, ...incomingDocs]));

      const existingFiles = Array.isArray(matchedLead.document_files) ? matchedLead.document_files : [];
      const mergedFiles = [...existingFiles, ...documentFiles];

      const appendedNotes = notes
        ? (matchedLead.notes ? `${matchedLead.notes}\n\n[Resubmission] ${notes}` : `[Resubmission] ${notes}`)
        : matchedLead.notes;

      // If lead is still available, refresh full info + recalc score/price.
      // If already sold, only merge new docs/notes (don't change pricing or core info).
      const isAvailable = matchedLead.sold_status === "available";

      const updatePayload: Record<string, any> = {
        notes: appendedNotes,
        documents: mergedDocs.length > 0 ? mergedDocs : null,
        document_files: mergedFiles.length > 0 ? mergedFiles : null,
      };

      if (isAvailable) {
        Object.assign(updatePayload, {
          first_name: firstName,
          last_name: lastName,
          email: email || matchedLead.email,
          phone: phone || matchedLead.phone,
          city: city || matchedLead.city,
          province: province || matchedLead.province,
          buyer_type: buyerType,
          vehicle_preference: vehiclePref || matchedLead.vehicle_preference,
          vehicle_price: vehiclePrice,
          vehicle_mileage: vehicleMileage,
          income: income ?? matchedLead.income,
          credit_range_min: creditMin ?? matchedLead.credit_range_min,
          credit_range_max: creditMax ?? matchedLead.credit_range_max,
          trade_in: tradeIn,
          appointment_time: appointmentTime,
          ai_score,
          quality_grade,
          price,
        });
      }

      const { error: updErr } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", matchedLead.id);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: jsonHeaders });
      }

      // Notify owning dealer if lead was already sold
      if (!isAvailable && matchedLead.sold_to_dealer_id) {
        const leadName = `${matchedLead.first_name || ""} ${matchedLead.last_name || ""}`.trim() || matchedLead.reference_code;
        const parts: string[] = [];
        if (documentFiles.length > 0) parts.push(`${documentFiles.length} new document${documentFiles.length === 1 ? "" : "s"} uploaded`);
        if (notes) parts.push("notes added");
        if (parts.length > 0) {
          await supabase.from("notifications").insert({
            dealer_id: matchedLead.sold_to_dealer_id,
            title: `Lead resubmission — ${leadName}`,
            message: `${parts.join(", ")} (Ref: ${matchedLead.reference_code})`,
            link: `/orders`,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          updated: true,
          reference_code: matchedLead.reference_code,
          message: isAvailable
            ? "We found your existing application and updated it."
            : "Your application has been received and shared with the dealer.",
          files_uploaded: documentFiles.length,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const { error } = await supabase.from("leads").insert({
      reference_code: refCode,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      city: city || null,
      province: province || null,
      buyer_type: buyerType,
      vehicle_preference: vehiclePref || null,
      vehicle_price: vehiclePrice,
      vehicle_mileage: vehicleMileage,
      income,
      credit_range_min: creditMin,
      credit_range_max: creditMax,
      trade_in: tradeIn,
      notes: notes || null,
      appointment_time: appointmentTime,
      documents,
      document_files: documentFiles.length > 0 ? documentFiles : null,
      ai_score,
      quality_grade,
      price,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, matched: false, reference_code: refCode, message: "Lead submitted successfully!", files_uploaded: documentFiles.length }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("submit-lead error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: jsonHeaders }
    );
  }
});