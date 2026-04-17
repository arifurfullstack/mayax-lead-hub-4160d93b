import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const startISO: string | undefined = body.start;
    const endISO: string | undefined = body.end;
    const template: string | undefined = body.template;
    const status: string | undefined = body.status;
    const limit = Math.min(Number(body.limit ?? 200), 500);

    // Fetch raw rows in window (cap defensively at 5000), then dedupe in JS
    let q = admin.from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (startISO) q = q.gte("created_at", startISO);
    if (endISO) q = q.lte("created_at", endISO);
    if (template) q = q.eq("template_name", template);

    const { data: rows, error } = await q;
    if (error) throw error;

    // Deduplicate by message_id (keep latest = first since DESC). Rows without message_id stay as-is.
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const r of rows ?? []) {
      const key = r.message_id || `__noid__${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }

    // Stats
    const stats = { total: dedup.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
    for (const r of dedup) {
      if (r.status === "sent") stats.sent++;
      else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced" || r.status === "complained") stats.failed++;
      else if (r.status === "suppressed") stats.suppressed++;
      else if (r.status === "pending") stats.pending++;
    }

    // Apply status filter post-dedup
    let filtered = dedup;
    if (status && status !== "all") {
      if (status === "failed") {
        filtered = dedup.filter((r) => ["dlq", "failed", "bounced", "complained"].includes(r.status));
      } else {
        filtered = dedup.filter((r) => r.status === status);
      }
    }

    const templates = Array.from(new Set((rows ?? []).map((r: any) => r.template_name))).sort();

    return new Response(JSON.stringify({
      rows: filtered.slice(0, limit),
      stats,
      templates,
      total: filtered.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("admin-email-log error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
