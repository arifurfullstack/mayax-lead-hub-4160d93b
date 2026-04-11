import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.2/cors";

const GENERIC_VEHICLES = ["car", "suv", "truck", "sedan", "van", "minivan", "coupe", "hatchback", "wagon", "pickup"];

function calculateAiScore(lead: {
  income?: number | null;
  vehicle_preference?: string | null;
  buyer_type?: string | null;
  trade_in?: boolean | null;
  appointment_time?: string | null;
}): { ai_score: number; quality_grade: string } {
  let score = 65;
  const income = lead.income ?? 0;
  if (income >= 5000) score += 10;
  else if (income >= 1800) score += 5;

  const veh = (lead.vehicle_preference ?? "").trim().toLowerCase();
  if (veh) {
    const isGeneric = GENERIC_VEHICLES.some((g) => veh === g);
    score += isGeneric ? 5 : 10;
  }

  if (lead.trade_in) score += 5;
  if (lead.appointment_time) score += 5;

  score = Math.min(100, Math.max(0, score));
  let grade = "C";
  if (score >= 90) grade = "A+";
  else if (score >= 80) grade = "A";
  else if (score >= 70) grade = "B";
  return { ai_score: score, quality_grade: grade };
}

function generateRefCode(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `MX-${year}-${seq}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate required fields
    const firstName = (body.first_name ?? "").trim();
    const lastName = (body.last_name ?? "").trim();
    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: "First name and last name are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = (body.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Default price based on grade
    let price = 25;
    if (quality_grade === "A+") price = 75;
    else if (quality_grade === "A") price = 55;
    else if (quality_grade === "B") price = 35;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("leads").insert({
      reference_code: generateRefCode(),
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
      ai_score,
      quality_grade,
      price,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Lead submitted successfully!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
