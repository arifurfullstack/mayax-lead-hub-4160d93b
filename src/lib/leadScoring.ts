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

/** Auto-price based on grade */
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
