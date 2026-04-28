import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

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

// --- Name recovery helpers ---
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[\s\-']+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function looksLikeName(s: string): boolean {
  return /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(s);
}

function recoverNamesFromPayload(lead: any): {
  first_name: string | null;
  last_name: string | null;
  source: string | null;
} {
  let first: string | null = (typeof lead.first_name === "string" && lead.first_name.trim()) || null;
  let last: string | null = (typeof lead.last_name === "string" && lead.last_name.trim()) || null;
  let source: string | null = null;

  // 1) Try a combined "name" / "full_name" / "customer_name" field
  const combined =
    (typeof lead.name === "string" && lead.name.trim()) ||
    (typeof lead.full_name === "string" && lead.full_name.trim()) ||
    (typeof lead.customer_name === "string" && lead.customer_name.trim()) ||
    "";
  if ((!first || !last) && combined) {
    const parts = combined.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      if (!first) first = titleCase(parts[0]);
      if (!last) last = titleCase(parts.slice(1).join(" "));
      source = "name_field";
    } else if (parts.length === 1 && !first) {
      first = titleCase(parts[0]);
      source = "name_field";
    }
  }

  // 2) Try email local part: john.doe@..., john_doe@..., jdoe@...
  const email = typeof lead.email === "string" ? lead.email.trim() : "";
  if ((!first || !last) && email.includes("@")) {
    const local = email.split("@")[0].replace(/\+.*$/, "");
    const parts = local.split(/[._\-]+/).filter(Boolean);
    if (parts.length >= 2 && looksLikeName(parts[0]) && looksLikeName(parts[1])) {
      if (!first) first = titleCase(parts[0]);
      if (!last) last = titleCase(parts[1]);
      source = source ?? "email";
    }
  }

  // 3) Try notes: "Name: John Doe" / "Customer: John Doe"
  const notes = typeof lead.notes === "string" ? lead.notes : "";
  if ((!first || !last) && notes) {
    const m = notes.match(/(?:name|customer|client|lead)\s*[:\-]\s*([A-Za-zÀ-ÿ'’\-]+)\s+([A-Za-zÀ-ÿ'’\-]+)/i);
    if (m) {
      if (!first) first = titleCase(m[1]);
      if (!last) last = titleCase(m[2]);
      source = source ?? "notes";
    }
  }

  return { first_name: first, last_name: last, source };
}

function buildSuggestedFix(lead: any): string {
  const hints: string[] = [];
  const email = typeof lead?.email === "string" ? lead.email.trim() : "";
  const phone = typeof lead?.phone === "string" ? lead.phone.trim() : "";
  if (email) hints.push(`email "${email}"`);
  if (phone) hints.push(`phone "${phone}"`);
  const ctx = hints.length ? ` (received ${hints.join(", ")})` : "";
  return (
    `Add "first_name" and "last_name" as non-empty strings to the JSON body${ctx}. ` +
    `Example: {"first_name":"John","last_name":"Doe"}. ` +
    `Tip: if your source only has a single "name" field, send it as "name":"John Doe" and enable ` +
    `"Auto-fill missing names" in MayaX webhook settings.`
  );
}

// ============================================================================
// Inbound payload normalization & field-shape heuristics
// ----------------------------------------------------------------------------
// These run BEFORE validation so that common Make.com / no-code automation
// quirks (literal "None" strings, "0" placeholders, vehicle text mapped into
// the `city` slot, etc.) get cleaned up or surfaced with a clear error.
// ============================================================================

const EMPTY_LITERALS = new Set([
  "", "none", "n/a", "na", "null", "undefined", "nil", "-", "—", "false", "no",
  "not provided", "not specified", "not available", "not working", "unknown",
]);

const STATUS_WORDS_IN_NAME = new Set([
  "planning", "pending", "unknown", "none", "n/a", "test", "lead", "customer",
  "client", "buyer", "applicant", "anonymous", "tbd", "todo",
]);

const VEHICLE_BRAND_REGEX =
  /\b(honda|toyota|ford|bmw|mercedes(-?benz)?|tesla|audi|lexus|hyundai|kia|nissan|mazda|subaru|volkswagen|vw|chevrolet|chevy|gmc|ram|jeep|dodge|chrysler|porsche|volvo|acura|infiniti|cadillac|buick|lincoln|mitsubishi|jaguar|land\s?rover|range\s?rover|mini|fiat|alfa\s?romeo|genesis|polestar|rivian|lucid)\b/i;

const GENERIC_VEHICLE_REGEX = /\b(suv|sedan|truck|coupe|hatchback|wagon|van|minivan|pickup|crossover)\b/i;

const YEAR_REGEX = /\b(19|20)\d{2}\b/;

// Loose city allowlist — used only to demote vehicle_preference values that
// look more like a city than a vehicle. Not exhaustive on purpose.
const COMMON_CA_CITIES = new Set([
  "toronto", "mississauga", "brampton", "scarborough", "etobicoke", "north york",
  "vaughan", "markham", "richmond hill", "oshawa", "ajax", "pickering", "whitby",
  "burlington", "hamilton", "kitchener", "waterloo", "guelph", "london",
  "windsor", "barrie", "kingston", "ottawa", "montreal", "laval", "quebec",
  "vancouver", "burnaby", "surrey", "richmond", "calgary", "edmonton",
  "winnipeg", "halifax", "regina", "saskatoon",
]);

function isEmptyish(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return false;
  if (typeof value === "boolean") return false;
  if (typeof value !== "string") return false;
  return EMPTY_LITERALS.has(value.trim().toLowerCase());
}

function nullIfEmptyish(value: unknown): unknown {
  return isEmptyish(value) ? null : value;
}

function looksLikeStatusWord(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (STATUS_WORDS_IN_NAME.has(v)) return true;
  // Names with digits or @ are almost always wrong mappings
  if (/[\d@]/.test(v)) return true;
  return false;
}

function looksLikeVehicleText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (VEHICLE_BRAND_REGEX.test(v)) return true;
  if (YEAR_REGEX.test(v) && (GENERIC_VEHICLE_REGEX.test(v) || /\b(model|edition|trim|hybrid|sport|premium|xle|lx|ex)\b/i.test(v))) return true;
  return false;
}

function looksLikeCity(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  if (!v || v.length > 30) return false;
  return COMMON_CA_CITIES.has(v);
}

function looksLikeValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  // Permissive email regex — only catches obvious garbage like "None", "asdf"
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/**
 * Normalize a raw inbound lead payload in place: convert empty-literals to
 * null, coerce numeric strings, and clean up status-word names. Mutates and
 * returns the same object for convenience.
 */
function normalizeInboundLead(lead: any): any {
  if (!lead || typeof lead !== "object") return lead;

  // String fields → null when empty-ish
  for (const k of [
    "first_name", "last_name", "email", "phone", "city", "province",
    "buyer_type", "vehicle_preference", "notes", "appointment_time",
    "reference_code",
  ]) {
    if (k in lead) lead[k] = nullIfEmptyish(lead[k]);
  }

  // Strip status-word names so recovery can run
  if (looksLikeStatusWord(lead.first_name)) lead.first_name = null;
  if (looksLikeStatusWord(lead.last_name)) lead.last_name = null;

  // Numeric fields: 0 → null, NaN strings → null
  for (const k of ["income", "credit_range_min", "credit_range_max", "vehicle_mileage", "vehicle_price"]) {
    if (!(k in lead)) continue;
    const raw = lead[k];
    if (raw === null || raw === undefined || raw === "") {
      lead[k] = null;
      continue;
    }
    const n = parseNumericInput(raw);
    if (n === null || n === 0) {
      if (n === null && raw !== 0 && raw !== "0") {
        console.warn(`[inbound-webhook] dropping non-numeric "${k}"="${raw}"`);
      }
      lead[k] = null;
    } else {
      lead[k] = n;
    }
  }

  // Boolean coercion for trade_in
  if ("trade_in" in lead) {
    const v = lead.trade_in;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "yes", "y", "1"].includes(s)) lead.trade_in = true;
      else if (["false", "no", "n", "0", ""].includes(s)) lead.trade_in = false;
    }
  }

  // appointment_time: invalid date → null
  if (lead.appointment_time && typeof lead.appointment_time === "string") {
    const ts = Date.parse(lead.appointment_time);
    if (Number.isNaN(ts)) {
      console.warn(`[inbound-webhook] dropping invalid appointment_time "${lead.appointment_time}"`);
      lead.appointment_time = null;
    }
  }

  return lead;
}

type FieldDiagnostic = {
  field: string;
  code: string;
  message: string;
  value?: unknown;
};

/**
 * Inspect a normalized lead for "looks-wrong" field mappings — vehicle text in
 * the city slot, garbage emails, payloads where everything except phone is
 * empty, etc. Returns an array of diagnostics; empty array = looks fine.
 */
function detectFieldShapeIssues(lead: any): FieldDiagnostic[] {
  const issues: FieldDiagnostic[] = [];
  if (!lead || typeof lead !== "object") return issues;

  // city looks like a vehicle
  if (lead.city && looksLikeVehicleText(lead.city)) {
    issues.push({
      field: "city",
      code: "city_looks_like_vehicle",
      message: `"city" field contains vehicle text ("${lead.city}"). Check your Make.com mapping — the location/city variable is likely mapped to the wrong slot.`,
      value: lead.city,
    });
  }

  // vehicle_preference looks like a city (warn-only, doesn't reject)
  if (lead.vehicle_preference && looksLikeCity(lead.vehicle_preference)) {
    issues.push({
      field: "vehicle_preference",
      code: "vehicle_looks_like_city",
      message: `"vehicle_preference" looks like a city name ("${lead.vehicle_preference}"). Verify your Make.com mapping.`,
      value: lead.vehicle_preference,
    });
  }

  // email present but not a valid format
  if (lead.email && !looksLikeValidEmail(lead.email)) {
    issues.push({
      field: "email",
      code: "email_invalid",
      message: `"email" is not a valid email address ("${lead.email}"). Make.com is sending a literal string instead of the customer's email.`,
      value: lead.email,
    });
  }

  // phone too short
  if (lead.phone) {
    const digits = (typeof lead.phone === "string" ? lead.phone : String(lead.phone)).replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 7) {
      issues.push({
        field: "phone",
        code: "phone_too_short",
        message: `"phone" has only ${digits.length} digit(s) ("${lead.phone}"). Expected at least 7.`,
        value: lead.phone,
      });
    }
  }

  return issues;
}

/** Returns true when the only non-empty field is `phone` (or nothing at all). */
function isPayloadEffectivelyEmpty(lead: any): boolean {
  if (!lead || typeof lead !== "object") return true;
  const meaningful = [
    "first_name", "last_name", "email", "city", "province", "income",
    "vehicle_preference", "notes", "credit_range_min", "credit_range_max",
    "vehicle_mileage", "vehicle_price", "appointment_time",
  ];
  return meaningful.every((k) => lead[k] === null || lead[k] === undefined || lead[k] === "");
}

// =============================================================
// JSON Schema validation (Zod)
// Runs AFTER normalizeInboundLead so empty-literals are already
// nulled out. Validates field SHAPES (types, lengths, formats)
// and returns ALL errors at once with a per-field suggested fix —
// designed to give Make.com users a single clear list of what to
// remap rather than fixing one error at a time.
// =============================================================

const ISO_PROVINCE_RE = /^[A-Za-z]{2}$/;

const inboundLeadSchema = z.object({
  // Identity — at least one of first/last is required (checked via superRefine)
  first_name: z.string().trim().min(1).max(80).nullish(),
  last_name: z.string().trim().min(1).max(80).nullish(),

  // Contact — at least one of email/phone is required (superRefine)
  email: z.string().trim().email("must be a valid email address").max(254).nullish(),
  phone: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? String(v) : v))
    .pipe(z.string().trim().max(40))
    .nullish(),

  // Location
  city: z.string().trim().min(1).max(80).nullish(),
  province: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .refine(
      (v) => v == null || v.length === 0 || ISO_PROVINCE_RE.test(v) || v.length >= 3,
      { message: "must be a 2-letter code (e.g. ON, QC) or full province name" },
    ),

  // Buyer / vehicle
  buyer_type: z.enum(["online", "walk_in", "phone", "referral"]).nullish().catch(null),
  vehicle_preference: z.string().trim().max(120).nullish(),
  vehicle_mileage: z.number().int().nonnegative().max(2_000_000).nullish(),
  vehicle_price: z.number().nonnegative().max(10_000_000).nullish(),

  // Financial — credit score range 300–900 (CA bureaus)
  income: z.number().nonnegative().max(100_000_000).nullish(),
  credit_range_min: z.number().int().min(300).max(900).nullish(),
  credit_range_max: z.number().int().min(300).max(900).nullish(),

  // Booleans
  trade_in: z.boolean().nullish(),
  has_bankruptcy: z.boolean().nullish(),

  // Misc
  notes: z.string().max(4000).nullish(),
  reference_code: z.string().trim().max(60).nullish(),
  appointment_time: z.string().nullish().refine(
    (v) => v == null || v === "" || !Number.isNaN(Date.parse(v)),
    { message: "must be a valid ISO 8601 date/time (e.g. 2026-05-01T14:30:00Z)" },
  ),
}).passthrough().superRefine((data, ctx) => {
  // At least one name
  if (!data.first_name && !data.last_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["first_name"],
      message: "first_name or last_name is required (both were empty/null)",
    });
  }
  // At least one contact channel
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "email or phone is required (both were empty/null)",
    });
  }
  // Credit range coherence
  if (
    typeof data.credit_range_min === "number" &&
    typeof data.credit_range_max === "number" &&
    data.credit_range_min > data.credit_range_max
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["credit_range_min"],
      message: "credit_range_min cannot be greater than credit_range_max",
    });
  }
});

type SchemaError = {
  field: string;
  message: string;
  received: unknown;
  suggested_fix: string;
};

const FIELD_HINTS: Record<string, string> = {
  first_name: 'Map the customer\'s given name. Example: "first_name": "Alice"',
  last_name: 'Map the customer\'s family name. Example: "last_name": "Johnson"',
  email: 'Send a real email address or omit the key entirely. Example: "email": "alice@example.com"',
  phone: 'Send digits only or E.164. Example: "phone": "4165551234"',
  city: 'Send the customer city, not vehicle/brand text. Example: "city": "Toronto"',
  province: 'Use a 2-letter Canadian code. Example: "province": "ON"',
  buyer_type: 'Use one of: online, walk_in, phone, referral. Or omit the key.',
  vehicle_preference: 'Send the vehicle the customer wants. Example: "vehicle_preference": "Honda Civic"',
  vehicle_mileage: 'Send a positive integer (km). Example: "vehicle_mileage": 45000',
  vehicle_price: 'Send a number. Example: "vehicle_price": 28500',
  income: 'Send a number (annual or monthly $). Example: "income": 65000',
  credit_range_min: 'Send an integer between 300 and 900. Example: "credit_range_min": 650',
  credit_range_max: 'Send an integer between 300 and 900. Example: "credit_range_max": 720',
  trade_in: 'Send true or false (boolean). Example: "trade_in": true',
  has_bankruptcy: 'Send true or false (boolean). Example: "has_bankruptcy": false',
  notes: 'Send a string up to 4000 chars, or omit the key.',
  reference_code: 'Send a short string (≤60 chars) or omit the key.',
  appointment_time: 'Send ISO 8601. Example: "appointment_time": "2026-05-01T14:30:00Z"',
};

function buildSchemaErrors(parseError: z.ZodError, lead: any): SchemaError[] {
  return parseError.issues.map((issue) => {
    const field = (issue.path[0] as string) ?? "(root)";
    return {
      field,
      message: issue.message,
      received: lead?.[field] ?? null,
      suggested_fix: FIELD_HINTS[field] ??
        `Verify your Make.com mapping for "${field}".`,
    };
  });
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

    // --- Dry-run / test mode ---
    // Triggered by ?dry_run=1 (or true/yes) OR header `x-dry-run: 1`.
    // Validates payload, computes price/grade/ai_score, looks up duplicates,
    // and returns the same per-lead `status` (created / updated / merged / error)
    // WITHOUT writing anything to the leads table.
    const url = new URL(req.url);
    const dryRunQuery = (url.searchParams.get("dry_run") ?? "").toLowerCase();
    const dryRunHeader = (req.headers.get("x-dry-run") ?? "").toLowerCase();
    const dryRun =
      dryRunQuery === "1" || dryRunQuery === "true" || dryRunQuery === "yes" ||
      dryRunHeader === "1" || dryRunHeader === "true" || dryRunHeader === "yes";

    // --- Strict mode (?strict=1 or x-strict header) ---
    // When enabled, payloads with field-shape issues (vehicle text in city,
    // garbage emails, etc.) are rejected outright instead of stored with a
    // warning. Useful for debugging Make.com mappings end-to-end.
    const strictQuery = (url.searchParams.get("strict") ?? "").toLowerCase();
    const strictHeader = (req.headers.get("x-strict") ?? "").toLowerCase();
    const strictMode =
      strictQuery === "1" || strictQuery === "true" || strictQuery === "yes" ||
      strictHeader === "1" || strictHeader === "true" || strictHeader === "yes";

    console.log(
      `[inbound-webhook ${requestId}] HIT method=${req.method} ip=${sourceIp} ua="${userAgent}" hasSecret=${hasSecretHeader} dryRun=${dryRun}`,
    );

    // Fetch all platform_settings (webhook secret + pricing)
    const { data: settingsRows } = await admin
      .from("platform_settings")
      .select("key, value");

    const allSettings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => { allSettings[r.key] = r.value ?? ""; });

    const autofillNames = (allSettings["inbound_webhook_autofill_names"] ?? "").toLowerCase() === "true";
    const retryRejected = (allSettings["inbound_webhook_retry_rejected"] ?? "").toLowerCase() === "true";
    // Default ON: empty pings (only `phone` populated) are rejected at the door.
    const rejectEmptyPayloads = (allSettings["inbound_webhook_reject_empty_payloads"] ?? "true").toLowerCase() !== "false";

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
    const results: {
      reference_code: string;
      status: string;
      ai_score?: number;
      quality_grade?: string;
      price?: number;
      error?: string;
      dry_run?: boolean;
      matched?: { id: string; reference_code: string; sold_status: string } | null;
      computed?: Record<string, unknown>;
    }[] = [];

    for (const lead of leadsInput) {
      // --- 0. Normalize payload (empty-literals → null, numeric coercion) ---
      normalizeInboundLead(lead);

      // --- 0a. Reject obviously-empty pings ("Make.com fired too early") ---
      if (rejectEmptyPayloads && isPayloadEffectivelyEmpty(lead)) {
        const phoneOnly = lead?.phone ? ` (only "phone" was populated: "${lead.phone}")` : "";
        const rejectionError =
          `Payload appears empty${phoneOnly}. ` +
          `Suggested fix: in your Make.com scenario, add a Filter module BEFORE the HTTP request that ` +
          `only continues when at least first_name, last_name, and email or phone are non-empty. ` +
          `This usually means the HTTP module is firing before your data-prep step has finished filling its variables.`;
        if (!dryRun) {
          try {
            await admin.from("rejected_inbound_leads").insert({
              request_id: requestId,
              reference_code: lead?.reference_code ?? null,
              error_message: rejectionError,
              error_type: "payload_appears_empty",
              first_name: null, last_name: null, email: null,
              phone: typeof lead?.phone === "string" ? lead.phone : null,
              city: null, province: null,
              payload: lead ?? {},
              source_ip: sourceIp, user_agent: userAgent,
            });
          } catch (e) {
            console.error(`[inbound-webhook ${requestId}] failed to log empty-payload rejection`, e);
          }
        }
        console.warn(`[inbound-webhook ${requestId}] rejected empty payload phone="${lead?.phone ?? ""}"`);
        results.push({
          reference_code: lead?.reference_code ?? "unknown",
          status: "error",
          error: rejectionError,
          ...(dryRun ? { dry_run: true } : {}),
        });
        continue;
      }

      // --- 0b. Field-shape sanity checks ---
      // In strict mode, any issue rejects. Otherwise, only hard-broken email
      // (where the field is present but invalid) and phone_too_short reject;
      // city/vehicle confusion is logged but allowed through.
      const shapeIssues = detectFieldShapeIssues(lead);
      const hardIssues = shapeIssues.filter(
        (i) => i.code === "email_invalid" || i.code === "phone_too_short" || i.code === "city_looks_like_vehicle",
      );
      const issuesToReject = strictMode ? shapeIssues : hardIssues;
      if (issuesToReject.length > 0) {
        const primary = issuesToReject[0];
        const allMessages = issuesToReject.map((i) => `• ${i.message}`).join("\n");
        const rejectionError =
          `Field-shape validation failed${strictMode ? " (strict mode)" : ""}:\n${allMessages}\n\n` +
          `Suggested fix: open your Make.com HTTP module and verify each variable is mapped to the correct JSON key. ` +
          `See the Make.com Integration Guide in MayaX admin for the full mapping table.`;
        if (!dryRun) {
          try {
            await admin.from("rejected_inbound_leads").insert({
              request_id: requestId,
              reference_code: lead?.reference_code ?? null,
              error_message: rejectionError,
              error_type: primary.code,
              first_name: lead?.first_name ?? null,
              last_name: lead?.last_name ?? null,
              email: typeof lead?.email === "string" ? lead.email : null,
              phone: typeof lead?.phone === "string" ? lead.phone : null,
              city: lead?.city ?? null,
              province: lead?.province ?? null,
              payload: lead ?? {},
              source_ip: sourceIp, user_agent: userAgent,
            });
          } catch (e) {
            console.error(`[inbound-webhook ${requestId}] failed to log shape rejection`, e);
          }
        }
        console.warn(
          `[inbound-webhook ${requestId}] rejected for shape issues: ${issuesToReject.map((i) => i.code).join(",")}`,
        );
        results.push({
          reference_code: lead?.reference_code ?? "unknown",
          status: "error",
          error: rejectionError,
          ...(dryRun ? { dry_run: true } : {}),
        });
        continue;
      } else if (shapeIssues.length > 0) {
        // Soft warnings — don't block, but surface in logs and response.
        console.warn(
          `[inbound-webhook ${requestId}] soft warnings: ${shapeIssues.map((i) => i.code).join(",")}`,
        );
      }

      // --- Retry merge: pull data from prior pending rejections (same email/phone) ---
      // When enabled, an inbound payload that re-uses a known email/phone will be merged
      // with the most recent prior rejection for that contact. This lets a sender fix a
      // missing first/last name on a follow-up call without losing earlier fields.
      let mergedRejectionIds: string[] = [];
      if (retryRejected) {
        const inboundEmailRaw = typeof lead?.email === "string" ? lead.email.trim().toLowerCase() : "";
        const inboundPhoneRaw = typeof lead?.phone === "string" ? lead.phone.trim() : "";
        const inboundPhoneDigitsRaw = normalizePhoneDigits(inboundPhoneRaw);
        const orFilters: string[] = [];
        if (inboundEmailRaw) orFilters.push(`normalized_email.eq.${inboundEmailRaw}`);
        if (inboundPhoneDigitsRaw && inboundPhoneDigitsRaw.length >= 7) {
          orFilters.push(`normalized_phone.eq.${inboundPhoneDigitsRaw}`);
        }
        if (orFilters.length > 0) {
          const { data: priorRejections } = await admin
            .from("rejected_inbound_leads")
            .select("id, payload, retry_count")
            .eq("status", "pending")
            .or(orFilters.join(","))
            .order("created_at", { ascending: false })
            .limit(5);
          if (priorRejections && priorRejections.length > 0) {
            // Merge: current (non-empty) values win over prior; otherwise fill from prior.
            const merged: Record<string, unknown> = {};
            // Apply oldest → newest so newer prior values overwrite older
            const ordered = [...priorRejections].reverse();
            for (const rej of ordered) {
              const p = (rej.payload as Record<string, unknown>) ?? {};
              for (const [k, v] of Object.entries(p)) {
                if (v !== null && v !== undefined && v !== "") merged[k] = v;
              }
            }
            // Current payload wins for any non-empty value
            for (const [k, v] of Object.entries(lead)) {
              if (v !== null && v !== undefined && v !== "") merged[k] = v;
            }
            // Mutate the lead object in-place so the rest of the loop sees merged data
            Object.assign(lead, merged);
            // Re-normalize after merge, since prior payloads may carry raw "None"/"0" values.
            normalizeInboundLead(lead);
            mergedRejectionIds = priorRejections.map((r) => r.id);
            console.log(
              `[inbound-webhook ${requestId}] retry-merge matched ${priorRejections.length} prior rejection(s) email=${inboundEmailRaw || "none"} phone=${inboundPhoneDigitsRaw || "none"}`,
            );
            // Bump retry_count on the matched prior rows (best effort, non-blocking)
            try {
              for (const rej of priorRejections) {
                await admin
                  .from("rejected_inbound_leads")
                  .update({
                    retry_count: (rej.retry_count ?? 0) + 1,
                    last_retry_at: new Date().toISOString(),
                  })
                  .eq("id", rej.id);
              }
            } catch (e) {
              console.error(`[inbound-webhook ${requestId}] failed to bump retry_count`, e);
            }
          }
        }
      }

      // Attempt name recovery if enabled (or if a combined name field is present)
      let nameSource: string | null = null;
      if (autofillNames || lead?.name || lead?.full_name || lead?.customer_name) {
        const recovered = recoverNamesFromPayload(lead);
        if (!lead.first_name && recovered.first_name) {
          lead.first_name = recovered.first_name;
          nameSource = recovered.source;
        }
        if (!lead.last_name && recovered.last_name) {
          lead.last_name = recovered.last_name;
          nameSource = nameSource ?? recovered.source;
        }
      }

      if (!lead.first_name || !lead.last_name) {
        const missing: string[] = [];
        if (!lead.first_name) missing.push("first_name");
        if (!lead.last_name) missing.push("last_name");
        const suggestedFix = buildSuggestedFix(lead);
        const rejectionError =
          `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. ` +
          (autofillNames
            ? `Auto-fill is ON but could not recover a name from email/notes/name fields. `
            : `Auto-fill is OFF — enable "Auto-fill missing names" in webhook settings to attempt recovery from email/notes. `) +
          (retryRejected && mergedRejectionIds.length > 0
            ? `Retry-merge ran against ${mergedRejectionIds.length} prior rejection(s) for this contact but still couldn't recover a name. `
            : "") +
          `Suggested fix: ${suggestedFix}`;
        if (!dryRun) {
          try {
            await admin.from("rejected_inbound_leads").insert({
              request_id: requestId,
              reference_code: lead?.reference_code ?? null,
              error_message: rejectionError,
              error_type: autofillNames ? "name_recovery_failed" : "missing_required_fields",
              first_name: lead?.first_name ?? null,
              last_name: lead?.last_name ?? null,
              email: typeof lead?.email === "string" ? lead.email : null,
              phone: typeof lead?.phone === "string" ? lead.phone : null,
              city: lead?.city ?? null,
              province: lead?.province ?? null,
              payload: lead ?? {},
              source_ip: sourceIp,
              user_agent: userAgent,
            });
          } catch (logErr) {
            console.error(`[inbound-webhook ${requestId}] failed to log rejection`, logErr);
          }
        }
        results.push({
          reference_code: lead.reference_code ?? "unknown",
          status: "error",
          error: rejectionError,
          ...(dryRun ? { dry_run: true } : {}),
        });
        continue;
      }

      if (nameSource) {
        console.log(
          `[inbound-webhook ${requestId}] auto-filled name from ${nameSource} first_name="${lead.first_name}" last_name="${lead.last_name}"`,
        );
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

        if (dryRun) {
          const status = matchedLead.sold_status === "available" ? "updated" : "merged";
          console.log(
            `[inbound-webhook ${requestId}] DRY-RUN ${status} ref=${referenceCode} match_id=${matchedLead.id} sold_status=${matchedLead.sold_status} price=${price} grade=${quality_grade}`,
          );
          results.push({
            reference_code: referenceCode,
            status,
            ai_score,
            quality_grade,
            price,
            dry_run: true,
            matched: {
              id: matchedLead.id,
              reference_code: matchedLead.reference_code,
              sold_status: matchedLead.sold_status,
            },
            computed: {
              email: leadData.email,
              phone: leadData.phone,
              city: leadData.city,
              province: leadData.province,
              income: leadData.income,
              vehicle_preference: leadData.vehicle_preference,
              trade_in,
              has_bankruptcy,
              appointment_time,
              would_update_fields:
                matchedLead.sold_status === "available"
                  ? Object.keys(leadData)
                  : ["notes"],
            },
          });
          continue;
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
          // Retry-merge succeeded — close out any prior pending rejections for this contact
          if (mergedRejectionIds.length > 0) {
            try {
              await admin
                .from("rejected_inbound_leads")
                .update({
                  status: "recovered",
                  recovered_lead_id: matchedLead.id,
                  recovered_at: new Date().toISOString(),
                })
                .in("id", mergedRejectionIds);
              console.log(
                `[inbound-webhook ${requestId}] marked ${mergedRejectionIds.length} prior rejection(s) as recovered → lead ${matchedLead.id}`,
              );
            } catch (e) {
              console.error(`[inbound-webhook ${requestId}] failed to mark rejections recovered`, e);
            }
          }
          results.push({
            reference_code: referenceCode,
            status,
            ai_score,
            quality_grade,
            price,
            ...(mergedRejectionIds.length > 0
              ? { recovered_rejection_ids: mergedRejectionIds }
              : {}),
          });
        }
        continue;
      }

      if (dryRun) {
        console.log(
          `[inbound-webhook ${requestId}] DRY-RUN created ref=${referenceCode} email=${inboundEmail || "none"} phone=${inboundPhoneDigits || "none"} price=${price} grade=${quality_grade} ai_score=${ai_score}`,
        );
        results.push({
          reference_code: referenceCode,
          status: "created",
          ai_score,
          quality_grade,
          price,
          dry_run: true,
          matched: null,
          computed: {
            email: leadData.email,
            phone: leadData.phone,
            city: leadData.city,
            province: leadData.province,
            income: leadData.income,
            vehicle_preference: leadData.vehicle_preference,
            trade_in,
            has_bankruptcy,
            appointment_time,
          },
        });
        continue;
      }

      const { data: insertedRows, error } = await admin
        .from("leads")
        .insert(leadData)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          `[inbound-webhook ${requestId}] insert error ref=${referenceCode} email=${inboundEmail || "none"} phone=${inboundPhoneDigits || "none"} error="${error.message}"`,
        );
        results.push({ reference_code: referenceCode, status: "error", error: error.message });
      } else {
        console.log(
          `[inbound-webhook ${requestId}] created ref=${referenceCode} email=${inboundEmail || "none"} phone=${inboundPhoneDigits || "none"} price=${price} grade=${quality_grade} ai_score=${ai_score}`,
        );
        // Retry-merge succeeded — close out any prior pending rejections for this contact
        if (mergedRejectionIds.length > 0) {
          try {
            await admin
              .from("rejected_inbound_leads")
              .update({
                status: "recovered",
                recovered_lead_id: insertedRows?.id ?? null,
                recovered_at: new Date().toISOString(),
              })
              .in("id", mergedRejectionIds);
            console.log(
              `[inbound-webhook ${requestId}] marked ${mergedRejectionIds.length} prior rejection(s) as recovered → lead ${insertedRows?.id ?? "unknown"}`,
            );
          } catch (e) {
            console.error(`[inbound-webhook ${requestId}] failed to mark rejections recovered`, e);
          }
        }
        results.push({
          reference_code: referenceCode,
          status: "created",
          ai_score,
          quality_grade,
          price,
          ...(mergedRejectionIds.length > 0
            ? { recovered_rejection_ids: mergedRejectionIds }
            : {}),
        });
      }
    }

    console.log(
      `[inbound-webhook ${requestId}] DONE dryRun=${dryRun} results=` + JSON.stringify(results),
    );
    return new Response(
      JSON.stringify({ success: true, dry_run: dryRun, results }),
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
