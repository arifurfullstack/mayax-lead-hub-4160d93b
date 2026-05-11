import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollText, RotateCw, CheckCircle2, XCircle, MinusCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  event_type: string;
  source: string;
  status: string;
  payment_request_id: string | null;
  dealer_id: string | null;
  amount: number | null;
  balance_after: number | null;
  actor_user_id: string | null;
  error_message: string | null;
  details: any;
  created_at: string;
};

const statusTone = (s: string) =>
  s === "success"
    ? "bg-success/15 text-success border-success/30"
    : s === "failed"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : s === "skipped"
        ? "bg-muted/30 text-muted-foreground border-border"
        : "bg-warning/15 text-warning border-warning/30";

const StatusIcon = ({ s }: { s: string }) =>
  s === "success" ? <CheckCircle2 className="h-3 w-3" />
  : s === "failed" ? <XCircle className="h-3 w-3" />
  : s === "skipped" ? <MinusCircle className="h-3 w-3" />
  : <Clock className="h-3 w-3" />;

const filters = [
  { value: "all", label: "All" },
  { value: "credit_attempt", label: "Credit attempts" },
  { value: "reconciliation_run", label: "Reconciliation runs" },
];

export const PaymentAuditLog = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("payment_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("event_type", filter);
    const { data } = await query;
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" /> Payment Audit Log
          <span className="text-xs text-muted-foreground font-normal">
            (last 100 events)
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-border">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-2.5 py-1 text-xs transition-colors",
                  filter === f.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-muted/30",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-7 gap-1 text-xs">
            <RotateCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          {loading ? "Loading…" : "No audit events recorded yet."}
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/80 backdrop-blur z-10">
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">When</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Event</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Source</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Amount</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Balance after</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <>
                    <tr
                      key={r.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-foreground text-xs">{r.event_type.replace("_", " ")}</td>
                      <td className="p-3 text-muted-foreground text-xs font-mono">{r.source}</td>
                      <td className="p-3">
                        <Badge className={cn("gap-1 border", statusTone(r.status))} variant="outline">
                          <StatusIcon s={r.status} />
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-foreground text-xs">
                        {r.amount != null ? `$${Number(r.amount).toFixed(2)}` : "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground text-xs">
                        {r.balance_after != null ? `$${Number(r.balance_after).toFixed(2)}` : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[260px] truncate">
                        {r.error_message || (r.details?.note ?? "—")}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={r.id + "-d"} className="bg-muted/10">
                        <td colSpan={7} className="p-3">
                          <div className="grid sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <div className="text-muted-foreground mb-1">Payment request</div>
                              <div className="font-mono text-foreground break-all">{r.payment_request_id || "—"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1">Dealer</div>
                              <div className="font-mono text-foreground break-all">{r.dealer_id || "—"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-muted-foreground mb-1">Details</div>
                              <pre className="text-[11px] bg-card/50 border border-border rounded p-2 overflow-x-auto">
{JSON.stringify(r.details ?? {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
};

export default PaymentAuditLog;
