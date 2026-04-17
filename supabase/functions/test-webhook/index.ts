import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: dealer, error: dealerErr } = await admin
      .from("dealers")
      .select("id, webhook_url, webhook_secret, dealership_name")
      .eq("user_id", user.id)
      .single();

    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = (dealer.webhook_url || "").trim();
    if (!url) {
      return new Response(JSON.stringify({ error: "No webhook URL configured. Save a webhook URL first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      event: "lead.purchased",
      timestamp: new Date().toISOString(),
      test: true,
      data: {
        reference_code: "TEST-0001",
        first_name: "Test",
        last_name: "Lead",
        phone: "416 555 0123",
        email: "test.lead@example.com",
        city: "Toronto",
        province: "Ontario",
        vehicle_preference: "SUV",
        vehicle_price: 35000,
        vehicle_mileage: 25000,
        credit_range: "650-720",
        income: 5500,
        buyer_type: "online",
        quality_grade: "A",
        ai_score: 87,
        trade_in: true,
        has_bankruptcy: false,
        appointment_time: null,
        notes: "This is a TEST payload sent from MayaX webhook settings.",
        documents: [],
        document_files: [],
        price_paid: 25,
      },
    };
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MayaX-Webhook/1.0",
      "X-MayaX-Event": "lead.purchased",
      "X-MayaX-Reference": "TEST-0001",
      "X-MayaX-Test": "true",
    };
    if (dealer.webhook_secret) {
      try {
        headers["X-MayaX-Signature"] = `sha256=${await hmacSha256Hex(dealer.webhook_secret, body)}`;
      } catch (_) { /* ignore */ }
    }

    let success = false;
    let responseCode: number | null = null;
    let errorDetails: string | null = null;
    let responseBody = "";
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(timeout);
      responseCode = res.status;
      success = res.ok;
      responseBody = (await res.text().catch(() => "")).slice(0, 500);
      if (!res.ok) errorDetails = responseBody;
    } catch (err) {
      errorDetails = (err as Error).message?.slice(0, 500) || "Webhook request failed";
    }

    return new Response(
      JSON.stringify({
        success,
        response_code: responseCode,
        endpoint: url,
        response_body: responseBody,
        error: errorDetails,
        signed: !!dealer.webhook_secret,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
