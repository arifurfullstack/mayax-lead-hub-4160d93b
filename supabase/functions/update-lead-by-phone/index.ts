import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 12;

// Normalize phone to last 10 digits for matching
function normalizePhoneDigits(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
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

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any> = {};
    const files: { name: string; data: Uint8Array; type: string }[] = [];

    // Lookup-only mode via GET ?phone=... (no writes)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const phoneParam = url.searchParams.get("phone") || "";
      const lookupDigits = normalizePhoneDigits(phoneParam);
      if (lookupDigits.length < 7) {
        return new Response(JSON.stringify({ matched: false }), { status: 200, headers: jsonHeaders });
      }
      const { data: candidates } = await supabase
        .from("leads")
        .select("reference_code, phone")
        .not("phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      const found = (candidates || []).find((l: any) => normalizePhoneDigits(l.phone || "") === lookupDigits);
      return new Response(
        JSON.stringify({ matched: !!found, reference_code: found?.reference_code || null }),
        { status: 200, headers: jsonHeaders }
      );
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const jsonField = formData.get("data");
      if (jsonField && typeof jsonField === "string") {
        body = JSON.parse(jsonField);
      }

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
              JSON.stringify({ error: `File type "${value.type}" is not allowed.` }),
              { status: 400, headers: jsonHeaders }
            );
          }
          const buf = await value.arrayBuffer();
          files.push({ name: value.name, data: new Uint8Array(buf), type: value.type });
        }
      }
    } else {
      body = await req.json();
    }

    const phoneRaw = (body.phone ?? "").toString().trim().slice(0, 30);
    const vehiclePref = (body.vehicle_preference ?? "").toString().trim().slice(0, 200);
    const city = (body.city ?? "").toString().trim().slice(0, 100);
    const province = (body.province ?? "").toString().trim().slice(0, 50);
    const notes = (body.notes ?? "").toString().trim().slice(0, 2000);
    const documents = Array.isArray(body.documents) ? body.documents.slice(0, 10) : null;

    const phoneDigits = normalizePhoneDigits(phoneRaw);

    // Try to match an existing lead by phone (last 10 digits).
    let matchedLead: any = null;
    if (phoneDigits.length >= 7) {
      const { data: candidates } = await supabase
        .from("leads")
        .select("id, reference_code, phone, notes, documents, document_files, vehicle_preference, city, province, sold_to_dealer_id, first_name, last_name")
        .not("phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      matchedLead = (candidates || []).find((l: any) => {
        const lDigits = normalizePhoneDigits(l.phone || "");
        return lDigits && lDigits === phoneDigits;
      }) || null;
    }

    // Decide reference code (existing lead or new placeholder)
    const refForStorage = matchedLead?.reference_code || generateRefCode();

    // Upload files
    const documentFiles: { name: string; path: string; type: string; size: number }[] = [];
    if (files.length > 0) {
      const folder = `applynow/${refForStorage}`;
      for (const f of files) {
        const ext = f.name.split(".").pop() || "bin";
        const storagePath = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lead-documents")
          .upload(storagePath, f.data, { contentType: f.type, upsert: false });
        if (upErr) {
          console.error("Upload error:", upErr);
          continue;
        }
        documentFiles.push({ name: f.name, path: storagePath, type: f.type, size: f.data.length });
      }
    }

    if (matchedLead) {
      // Merge documents arrays
      const existingDocs: string[] = Array.isArray(matchedLead.documents) ? matchedLead.documents : [];
      const mergedDocs = documents
        ? Array.from(new Set([...existingDocs, ...documents]))
        : existingDocs;

      const existingFiles = Array.isArray(matchedLead.document_files) ? matchedLead.document_files : [];
      const mergedFiles = [...existingFiles, ...documentFiles];

      const appendedNotes = notes
        ? (matchedLead.notes ? `${matchedLead.notes}\n\n[ApplyNow update] ${notes}` : `[ApplyNow update] ${notes}`)
        : matchedLead.notes;

      const { error: updErr } = await supabase
        .from("leads")
        .update({
          vehicle_preference: vehiclePref || matchedLead.vehicle_preference,
          city: city || matchedLead.city,
          province: province || matchedLead.province,
          notes: appendedNotes,
          documents: mergedDocs.length > 0 ? mergedDocs : null,
          document_files: mergedFiles.length > 0 ? mergedFiles : null,
        })
        .eq("id", matchedLead.id);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: jsonHeaders });
      }

      // Notify owning dealer (if lead was sold) about the new ApplyNow update
      if (matchedLead.sold_to_dealer_id) {
        const parts: string[] = [];
        if (documentFiles.length > 0) {
          parts.push(`${documentFiles.length} new document${documentFiles.length === 1 ? "" : "s"} uploaded`);
        }
        if (notes) parts.push("notes added");
        if (vehiclePref && vehiclePref !== matchedLead.vehicle_preference) parts.push("vehicle preference updated");
        if (city && city !== matchedLead.city) parts.push("city updated");
        if (province && province !== matchedLead.province) parts.push("province updated");

        if (parts.length > 0) {
          const leadName = `${matchedLead.first_name || ""} ${matchedLead.last_name || ""}`.trim() || matchedLead.reference_code;
          const { error: notifErr } = await supabase.from("notifications").insert({
            dealer_id: matchedLead.sold_to_dealer_id,
            title: `New ApplyNow update — ${leadName}`,
            message: `${parts.join(", ")} (Ref: ${matchedLead.reference_code})`,
            link: `/orders`,
          });
          if (notifErr) console.error("Notification insert error:", notifErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          matched: true,
          reference_code: matchedLead.reference_code,
          files_uploaded: documentFiles.length,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // No match → create a minimal new lead (phone-only entry) so info isn't lost
    const newRef = refForStorage;
    const { error: insErr } = await supabase.from("leads").insert({
      reference_code: newRef,
      first_name: "Pending",
      last_name: "Applicant",
      phone: phoneRaw || null,
      vehicle_preference: vehiclePref || null,
      city: city || null,
      province: province || null,
      notes: notes || null,
      documents: documents,
      document_files: documentFiles.length > 0 ? documentFiles : null,
      price: 25,
      quality_grade: "C",
      ai_score: 50,
    });

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched: false,
        reference_code: newRef,
        files_uploaded: documentFiles.length,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("update-lead-by-phone error:", err);
    return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400, headers: jsonHeaders });
  }
});
