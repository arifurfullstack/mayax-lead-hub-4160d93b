const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

interface LeadInput {
  income?: number | null;
  vehicle_preference?: string | null;
  buyer_type?: string | null;
  notes?: string | null;
  appointment_time?: string | null;
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

  // Trade / Refinance
  const combined = `${lead.buyer_type ?? ""} ${lead.notes ?? ""}`.toLowerCase();
  if (/trade|refinanc/i.test(combined)) score += 5;

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
