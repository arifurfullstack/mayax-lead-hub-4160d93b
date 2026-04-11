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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { gateway, amount } = body;

    if (!gateway || !amount || typeof amount !== "number" || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid gateway or amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get dealer
    const { data: dealer, error: dealerErr } = await admin
      .from("dealers")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (dealerErr || !dealer) {
      return new Response(JSON.stringify({ error: "Dealer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check gateway is enabled
    const { data: gw } = await admin
      .from("payment_gateways")
      .select("*")
      .eq("id", gateway)
      .eq("enabled", true)
      .single();
    if (!gw) {
      return new Response(JSON.stringify({ error: "Payment gateway not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gateway === "stripe") {
      const config = gw.config as Record<string, string>;
      const stripeKey = config?.secret_key || Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return new Response(JSON.stringify({ error: "Stripe not configured. Add your Secret Key in Admin → Payments → Stripe → Configure." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create payment request first
      const { data: payReq } = await admin.from("payment_requests").insert({
        dealer_id: dealer.id,
        gateway: "stripe",
        amount,
        status: "pending",
      }).select("id").single();

      // Create Stripe Checkout Session
      const params = new URLSearchParams();
      params.append("mode", "payment");
      params.append("success_url", `${body.success_url || supabaseUrl}?payment=success`);
      params.append("cancel_url", `${body.cancel_url || supabaseUrl}?payment=cancelled`);
      params.append("line_items[0][price_data][currency]", "usd");
      params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.append("line_items[0][price_data][product_data][name]", `Wallet Deposit - $${amount}`);
      params.append("line_items[0][quantity]", "1");
      params.append("metadata[payment_request_id]", payReq!.id);
      params.append("metadata[dealer_id]", dealer.id);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const session = await stripeRes.json();

      if (!stripeRes.ok) {
        return new Response(JSON.stringify({ error: session.error?.message || "Stripe error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update payment request with stripe session id
      await admin.from("payment_requests").update({
        gateway_reference: session.id,
      }).eq("id", payReq!.id);

      return new Response(JSON.stringify({ url: session.url, payment_request_id: payReq!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gateway === "paypal") {
      const config = gw.config as Record<string, string>;
      const clientId = config?.client_id || Deno.env.get("PAYPAL_CLIENT_ID");
      const clientSecret = config?.client_secret || Deno.env.get("PAYPAL_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "PayPal not configured. Add your Client ID & Secret in Admin → Payments → PayPal → Configure." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = gw.config as Record<string, string>;
      const mode = config?.mode === "live" ? "live" : "sandbox";
      const baseUrl = mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

      // Get access token
      const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const tokenData = await tokenRes.json();

      // Create payment request
      const { data: payReq } = await admin.from("payment_requests").insert({
        dealer_id: dealer.id,
        gateway: "paypal",
        amount,
        status: "pending",
      }).select("id").single();

      // Create PayPal order
      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: "USD", value: amount.toFixed(2) },
            description: `Wallet Deposit - $${amount}`,
            custom_id: payReq!.id,
          }],
          application_context: {
            return_url: body.success_url || supabaseUrl,
            cancel_url: body.cancel_url || supabaseUrl,
          },
        }),
      });
      const order = await orderRes.json();

      if (!orderRes.ok) {
        return new Response(JSON.stringify({ error: "PayPal order creation failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("payment_requests").update({
        gateway_reference: order.id,
      }).eq("id", payReq!.id);

      const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;

      return new Response(JSON.stringify({ url: approveLink, payment_request_id: payReq!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gateway === "bank_transfer") {
      const refCode = `BT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data: payReq } = await admin.from("payment_requests").insert({
        dealer_id: dealer.id,
        gateway: "bank_transfer",
        amount,
        status: "pending",
        gateway_reference: refCode,
      }).select("id").single();

      const config = gw.config as Record<string, string>;

      return new Response(JSON.stringify({
        payment_request_id: payReq!.id,
        reference_code: refCode,
        bank_details: {
          bank_name: config?.bank_name || "",
          account_name: config?.account_name || "",
          account_number: config?.account_number || "",
          routing_number: config?.routing_number || "",
          instructions: config?.instructions || "",
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported gateway" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
