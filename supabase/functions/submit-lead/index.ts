import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const refCode = generateRefCode();

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
      JSON.stringify({ success: true, message: "Lead submitted successfully!", files_uploaded: documentFiles.length }),
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