import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Row = {
  id: string;
  dealer_id: string;
  amount: number;
  status: string;
  gateway_reference: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  dealers?: { dealership_name: string | null; email: string | null } | null;
};

const statusBadge = (s: string) => {
  switch (s) {
    case "completed":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
    case "failed":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
};

const AdminStripeSessions = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("payment_requests")
      .select("id,dealer_id,amount,status,gateway_reference,error_message,created_at,completed_at,dealers(dealership_name,email)")
      .eq("gateway", "stripe")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setRows(data as unknown as Row[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const errors = rows.filter((r) => r.status === "failed" || r.error_message);
  const counts = {
    total: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    pending: rows.filter((r) => r.status === "pending").length,
    failed: errors.length,
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-card rounded-xl" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Stripe Checkout Sessions</h2>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total (last 50)", value: counts.total, color: "text-foreground" },
          { label: "Completed", value: counts.completed, color: "text-emerald-400" },
          { label: "Pending", value: counts.pending, color: "text-amber-400" },
          { label: "Errors", value: counts.failed, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="glass-card p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <h3 className="font-semibold text-foreground">Recent errors</h3>
          </div>
          <div className="space-y-2">
            {errors.slice(0, 10).map((r) => (
              <div key={r.id} className="text-xs bg-red-500/5 border border-red-500/20 rounded-md p-3">
                <div className="flex justify-between gap-3 text-muted-foreground">
                  <span>{r.dealers?.dealership_name ?? r.dealer_id.slice(0, 8)} • ${Number(r.amount).toFixed(2)}</span>
                  <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                </div>
                <div className="text-red-300 mt-1 font-mono break-words">
                  {r.error_message || "(no error message recorded)"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Dealer</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Stripe Session</th>
                <th className="text-left p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No Stripe sessions yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-background/30">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="p-3">
                    <div className="text-foreground">{r.dealers?.dealership_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.dealers?.email ?? r.dealer_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-3 text-right font-mono text-foreground">${Number(r.amount).toFixed(2)}</td>
                  <td className="p-3">{statusBadge(r.status)}</td>
                  <td className="p-3">
                    {r.gateway_reference ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${r.gateway_reference}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                      >
                        {r.gateway_reference.slice(0, 18)}…
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-red-300 max-w-[280px] truncate" title={r.error_message ?? ""}>
                    {r.error_message ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminStripeSessions;
