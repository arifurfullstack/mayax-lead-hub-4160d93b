const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

interface LeadInput {
  income?: number | null;
  vehicle_preference?: string | null;
  buyer_type?: string | null;
  notes?: string | null;
  appointment_time?: string | null;
  trade_in?: boolean | null;
  has_bankruptcy?: boolean | null;
  email?: string | null;
  phone?: string | null;
  document_files?: unknown;
  documents?: string[] | null;
}

/* ─── Dynamic Grading Settings ─── */

export type ScoreRuleOp =
  | "gte"
  | "lte"
  | "between"
  | "specific"
  | "generic"
  | "true"
  | "present"
  | "count_capped";

export interface ScoreRule {
  id: string;
  label: string;
  field: string;
  op: ScoreRuleOp;
  value?: number | number[];
  points: number;
}

export interface ScoreRulesConfig {
  base: number;
  rules: ScoreRule[];
}

export interface GradeBucket {
  grade: string;
  min: number;
  max: number;
}

export interface GradeBucketsConfig {
  buckets: GradeBucket[];
}

export interface GradingSettings {
  scoreRules: ScoreRulesConfig;
  gradeBuckets: GradeBucketsConfig;
}

export const DEFAULT_SCORE_RULES: ScoreRulesConfig = {
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
    { id: "docs", label: "Documents uploaded (per file, capped)", field: "document_files", op: "count_capped", value: 3, points: 3 },
  ],
};

export const DEFAULT_GRADE_BUCKETS: GradeBucketsConfig = {
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

export const DEFAULT_GRADING: GradingSettings = {
  scoreRules: DEFAULT_SCORE_RULES,
  gradeBuckets: DEFAULT_GRADE_BUCKETS,
};

/** Parse JSON string from platform_settings into a typed config; falls back to defaults on any error. */
export function parseGradingSettings(raw: Record<string, string>): GradingSettings {
  let scoreRules = DEFAULT_SCORE_RULES;
  let gradeBuckets = DEFAULT_GRADE_BUCKETS;
  try {
    if (raw.grading_score_rules) {
      const parsed = JSON.parse(raw.grading_score_rules);
      if (parsed && typeof parsed.base === "number" && Array.isArray(parsed.rules)) {
        scoreRules = parsed;
      }
    }
  } catch { /* ignore */ }
  try {
    if (raw.grading_grade_buckets) {
      const parsed = JSON.parse(raw.grading_grade_buckets);
      if (parsed && Array.isArray(parsed.buckets) && parsed.buckets.length > 0) {
        gradeBuckets = parsed;
      }
    }
  } catch { /* ignore */ }
  return { scoreRules, gradeBuckets };
}

function getFieldValue(lead: LeadInput, field: string): unknown {
  return (lead as Record<string, unknown>)[field];
}

function evaluateRule(rule: ScoreRule, lead: LeadInput): number {
  const v = getFieldValue(lead, rule.field);
  switch (rule.op) {
    case "gte": {
      const n = typeof v === "number" ? v : Number(v ?? 0);
      return n >= Number(rule.value ?? 0) ? rule.points : 0;
    }
    case "lte": {
      const n = typeof v === "number" ? v : Number(v ?? 0);
      return n <= Number(rule.value ?? 0) ? rule.points : 0;
    }
    case "between": {
      const n = typeof v === "number" ? v : Number(v ?? 0);
      const range = Array.isArray(rule.value) ? rule.value : [0, 0];
      return n >= range[0] && n <= range[1] ? rule.points : 0;
    }
    case "specific": {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      if (!s) return 0;
      return GENERIC_VEHICLES.includes(s) ? 0 : rule.points;
    }
    case "generic": {
      const s = typeof v === "string" ? v.trim().toLowerCase() : "";
      if (!s) return 0;
      return GENERIC_VEHICLES.includes(s) ? rule.points : 0;
    }
    case "true":
      return v === true ? rule.points : 0;
    case "present": {
      if (v === null || v === undefined) return 0;
      if (typeof v === "string" && v.trim() === "") return 0;
      return rule.points;
    }
    case "count_capped": {
      const cap = Number(rule.value ?? 1);
      let count = 0;
      if (Array.isArray(v)) count = v.length;
      else if (typeof v === "number") count = v;
      const capped = Math.min(count, cap);
      return capped * rule.points;
    }
    default:
      return 0;
  }
}

export function gradeFromScore(score: number, buckets: GradeBucketsConfig = DEFAULT_GRADE_BUCKETS): string {
  // Sort by min descending so higher buckets win on overlap
  const sorted = [...buckets.buckets].sort((a, b) => b.min - a.min);
  for (const b of sorted) {
    if (score >= b.min && score <= b.max) return b.grade;
  }
  return sorted[sorted.length - 1]?.grade ?? "D";
}

export function calculateAiScore(
  lead: LeadInput,
  settings: GradingSettings = DEFAULT_GRADING,
): { ai_score: number; quality_grade: string } {
  let score = settings.scoreRules.base;
  for (const rule of settings.scoreRules.rules) {
    score += evaluateRule(rule, lead);
  }
  score = Math.min(100, Math.max(0, Math.round(score)));
  return { ai_score: score, quality_grade: gradeFromScore(score, settings.gradeBuckets) };
}

/** Validate buckets are monotonic (higher grade in list = higher min) and non-overlapping. */
export function validateGradeBuckets(buckets: GradeBucket[]): string | null {
  if (buckets.length === 0) return "At least one grade bucket is required.";
  for (const b of buckets) {
    if (b.min > b.max) return `Grade ${b.grade}: min (${b.min}) cannot exceed max (${b.max}).`;
    if (b.min < 0 || b.max > 100) return `Grade ${b.grade}: range must be within 0–100.`;
  }
  // Ensure listed top-to-bottom is strictly decreasing (top grade has highest min)
  for (let i = 1; i < buckets.length; i++) {
    if (buckets[i].min >= buckets[i - 1].min) {
      return `${buckets[i].grade} cannot have a min ≥ ${buckets[i - 1].grade}'s min. Higher grades must require higher scores.`;
    }
    if (buckets[i].max >= buckets[i - 1].min) {
      return `${buckets[i].grade}'s max (${buckets[i].max}) overlaps with ${buckets[i - 1].grade}'s min (${buckets[i - 1].min}).`;
    }
  }
  return null;
}

/** Auto-price based on grade (legacy — kept for backward compat) */
const GRADE_PRICES: Record<string, number> = {
  "A+": 50,
  A: 40,
  "B+": 30,
  B: 25,
  "C+": 20,
  C: 15,
  "D+": 10,
  D: 5,
};

export function getGradePrice(grade: string): number {
  return GRADE_PRICES[grade] ?? 15;
}

/* ─── Dynamic Pricing (unchanged) ─── */

export interface PricingSettings {
  lead_price_base: number;
  lead_price_income_tier1: number;
  lead_price_income_tier2: number;
  lead_price_vehicle: number;
  lead_price_trade: number;
  lead_price_bankruptcy: number;
  lead_price_appointment: number;
}

export const DEFAULT_PRICING: PricingSettings = {
  lead_price_base: 15,
  lead_price_income_tier1: 5,
  lead_price_income_tier2: 10,
  lead_price_vehicle: 5,
  lead_price_trade: 15,
  lead_price_bankruptcy: 15,
  lead_price_appointment: 10,
};

export function parsePricingSettings(raw: Record<string, string>): PricingSettings {
  const p = { ...DEFAULT_PRICING };
  for (const key of Object.keys(DEFAULT_PRICING) as (keyof PricingSettings)[]) {
    if (raw[key] !== undefined && raw[key] !== "") {
      p[key] = Number(raw[key]);
    }
  }
  return p;
}

export interface DynamicLeadInput {
  income?: number | null;
  vehicle_preference?: string | null;
  trade_in?: boolean | null;
  has_bankruptcy?: boolean | null;
  appointment_time?: string | null;
}

export interface PriceBreakdown {
  base: number;
  income: number;
  vehicle: number;
  trade: number;
  bankruptcy: number;
  appointment: number;
  total: number;
}

export function calculateLeadPrice(lead: DynamicLeadInput, settings: PricingSettings): PriceBreakdown {
  const base = settings.lead_price_base;

  let income = 0;
  const inc = lead.income ?? 0;
  if (inc >= 5000) {
    income = settings.lead_price_income_tier1 + settings.lead_price_income_tier2;
  } else if (inc >= 1800) {
    income = settings.lead_price_income_tier1;
  }

  const veh = (lead.vehicle_preference ?? "").trim();
  const vehicle = veh ? settings.lead_price_vehicle : 0;
  const trade = lead.trade_in ? settings.lead_price_trade : 0;
  const bankruptcy = lead.has_bankruptcy ? settings.lead_price_bankruptcy : 0;
  const appointment = lead.appointment_time ? settings.lead_price_appointment : 0;

  return {
    base,
    income,
    vehicle,
    trade,
    bankruptcy,
    appointment,
    total: base + income + vehicle + trade + bankruptcy + appointment,
  };
}

export function parseNotesFlags(notes: string | null | undefined): {
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
