import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { gateway, config } = await req.json();

    if (gateway === "stripe") {
      const secretKey = config?.secret_key;
      if (!secretKey) {
        return new Response(JSON.stringify({ success: false, message: "Secret Key is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Test by fetching account info
      const res = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, message: data.error?.message || "Invalid Stripe key" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mode = secretKey.startsWith("sk_test_") ? "Test" : "Live";
      return new Response(JSON.stringify({
        success: true,
        message: `Connected to Stripe (${mode} mode) — Account: ${data.settings?.dashboard?.display_name || data.id}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (gateway === "paypal") {
      const { client_id, client_secret, mode } = config || {};
      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({ success: false, message: "Client ID and Client Secret are required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ success: false, message: tokenData.error_description || "Invalid PayPal credentials" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const modeLabel = mode === "live" ? "Live" : "Sandbox";
      return new Response(JSON.stringify({
        success: true,
        message: `Connected to PayPal (${modeLabel} mode) — Token obtained successfully`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (gateway === "bank_transfer") {
      const { bank_name, account_number } = config || {};
      if (!bank_name || !account_number) {
        return new Response(JSON.stringify({ success: false, message: "Bank Name and Account Number are required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: `Bank transfer configuration looks good — ${bank_name} (****${account_number.slice(-4)})`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, message: "Unknown gateway" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
