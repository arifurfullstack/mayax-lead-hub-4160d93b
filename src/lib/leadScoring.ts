const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

interface LeadInput {
  income?: number | null;
  vehicle_preference?: string | null;
  buyer_type?: string | null;
  notes?: string | null;
  appointment_time?: string | null;
  trade_in?: boolean | null;
}

export function calculateAiScore(lead: LeadInput): { ai_score: number; quality_grade: string } {
  let score = 65;

  // Income
  const income = lead.income ?? 0;
  if (income >= 5000) score += 10;
  else if (income >= 1800) score += 5;

  // Vehicle
  const veh = (lead.vehicle_preference ?? "").trim().toLowerCase();
  if (veh) {
    const isGeneric = GENERIC_VEHICLES.some((g) => veh === g);
    score += isGeneric ? 5 : 10;
  }

  // Trade / Refinance — from trade_in flag, buyer_type, or notes
  const combined = `${lead.buyer_type ?? ""} ${lead.notes ?? ""}`.toLowerCase();
  if (lead.trade_in || /trade|refinanc/i.test(combined)) score += 5;

  // Bankruptcy
  if (/bankrupt/i.test(lead.notes ?? "")) score += 5;

  // Appointment
  if (lead.appointment_time) score += 5;

  // Completeness bonus
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

/* ─── Dynamic Pricing ─── */

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

/** Build PricingSettings from a platform_settings key/value map */
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

  // Income tiers: <1800 = $0, 1800-4999 = tier1, 5000+ = tier1+tier2
  let income = 0;
  const inc = lead.income ?? 0;
  if (inc >= 5000) {
    income = settings.lead_price_income_tier1 + settings.lead_price_income_tier2;
  } else if (inc >= 1800) {
    income = settings.lead_price_income_tier1;
  }

  // Vehicle
  const veh = (lead.vehicle_preference ?? "").trim();
  const vehicle = veh ? settings.lead_price_vehicle : 0;

  // Trade-in
  const trade = lead.trade_in ? settings.lead_price_trade : 0;

  // Bankruptcy
  const bankruptcy = lead.has_bankruptcy ? settings.lead_price_bankruptcy : 0;

  // Appointment
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

/** Parse notes for trade/bankruptcy/appointment keywords */
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
