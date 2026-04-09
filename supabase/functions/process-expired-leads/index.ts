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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch settings
    const { data: settings } = await admin.from("platform_settings").select("key, value");
    const cfg: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => { cfg[s.key] = s.value ?? ""; });

    const expiryHours = Number(cfg["lead_expiry_hours"]) || 24;
    const expiryWebhookUrl = cfg["expiry_webhook_url"]?.trim() ?? "";
    const appointmentWebhookUrl = cfg["appointment_webhook_url"]?.trim() ?? "";
    const preSendMinutes = Number(cfg["appointment_pre_send_minutes"]) || 20;
    const expiryEnabled = cfg["lead_expiry_enabled"] === "true";
    const appointmentEnabled = cfg["appointment_presend_enabled"] === "true";

    const now = new Date();
    const results = { expired_sent: 0, expired_deleted: 0, appointment_sent: 0, appointment_deleted: 0, errors: [] as string[] };

    // ─── 1. Process expired leads (only if enabled) ───
    if (expiryEnabled) {
      const expiryThreshold = new Date(now.getTime() - expiryHours * 60 * 60 * 1000).toISOString();

      const { data: expiredLeads, error: fetchErr } = await admin
        .from("leads")
        .select("*")
        .eq("sold_status", "available")
        .lt("created_at", expiryThreshold);

      if (fetchErr) {
        results.errors.push(`Fetch expired: ${fetchErr.message}`);
      } else if (expiredLeads && expiredLeads.length > 0) {
        // Send to webhook if URL configured
        if (expiryWebhookUrl) {
          try {
            const resp = await fetch(expiryWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "expired_leads", leads: expiredLeads }),
            });
            if (!resp.ok) {
              results.errors.push(`Expiry webhook returned ${resp.status}`);
            } else {
              results.expired_sent = expiredLeads.length;
            }
          } catch (e) {
            results.errors.push(`Expiry webhook error: ${e.message}`);
          }
        }
        // Always delete expired leads when feature is enabled
        const ids = expiredLeads.map((l: any) => l.id);
        const { error: delErr } = await admin.from("leads").delete().in("id", ids);
        if (delErr) results.errors.push(`Delete expired: ${delErr.message}`);
        else results.expired_deleted = expiredLeads.length;
      }
    }

    // ─── 2. Process leads with upcoming appointments (only if enabled) ───
    if (appointmentEnabled) {
      const windowStart = now.toISOString();
      const windowEnd = new Date(now.getTime() + preSendMinutes * 60 * 1000).toISOString();

      const { data: appointmentLeads, error: apptErr } = await admin
        .from("leads")
        .select("*")
        .eq("sold_status", "available")
        .gte("appointment_time", windowStart)
        .lte("appointment_time", windowEnd);

      if (apptErr) {
        results.errors.push(`Fetch appointments: ${apptErr.message}`);
      } else if (appointmentLeads && appointmentLeads.length > 0) {
        // Send to webhook if URL configured
        if (appointmentWebhookUrl) {
          try {
            const resp = await fetch(appointmentWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "upcoming_appointments", leads: appointmentLeads }),
            });
            if (!resp.ok) {
              results.errors.push(`Appointment webhook returned ${resp.status}`);
            } else {
              results.appointment_sent = appointmentLeads.length;
            }
          } catch (e) {
            results.errors.push(`Appointment webhook error: ${e.message}`);
          }
        }
        // Always delete appointment leads when feature is enabled
        const ids = appointmentLeads.map((l: any) => l.id);
        const { error: delErr } = await admin.from("leads").delete().in("id", ids);
        if (delErr) results.errors.push(`Delete appointment leads: ${delErr.message}`);
        else results.appointment_deleted = appointmentLeads.length;
      }
    }

    console.log("Process expired leads results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Process expired leads error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
