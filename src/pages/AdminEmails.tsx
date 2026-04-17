import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Mail, CheckCircle2, XCircle, ShieldOff, Clock, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Range = "24h" | "7d" | "30d" | "custom";

const rangeToDates = (r: Range, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  if (r === "24h") start.setHours(start.getHours() - 24);
  else if (r === "7d") start.setDate(start.getDate() - 7);
  else if (r === "30d") start.setDate(start.getDate() - 30);
  else if (r === "custom") {
    if (customStart) start = new Date(customStart);
    if (customEnd) {
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: e.toISOString() };
    }
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

const statusBadge = (status: string) => {
  if (status === "sent") return <Badge className="border-0 bg-success/20 text-success gap-1"><CheckCircle2 className="h-3 w-3" />Sent</Badge>;
  if (["dlq", "failed", "bounced", "complained"].includes(status)) {
    return <Badge className="border-0 bg-destructive/20 text-destructive gap-1"><XCircle className="h-3 w-3" />{status === "dlq" ? "Failed" : status}</Badge>;
  }
  if (status === "suppressed") return <Badge className="border-0 bg-warning/20 text-warning gap-1"><ShieldOff className="h-3 w-3" />Suppressed</Badge>;
  if (status === "pending") return <Badge className="border-0 bg-muted text-muted-foreground gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
  return <Badge className="border-0 bg-muted text-muted-foreground">{status}</Badge>;
};

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="glass-card p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
    <p className={cn("text-2xl font-bold", color)}>{value}</p>
  </div>
);

const AdminEmails = () => {
  const [range, setRange] = useState<Range>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { start, end } = useMemo(
    () => rangeToDates(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-email-log", start, end, template, status],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-email-log", {
        body: {
          start, end,
          template: template === "all" ? undefined : template,
          status,
          limit: 500,
        },
      });
      if (error) throw error;
      return data as {
        rows: any[];
        stats: { total: number; sent: number; failed: number; suppressed: number; pending: number };
        templates: string[];
        total: number;
      };
    },
  });

  const rows = data?.rows ?? [];
  const stats = data?.stats ?? { total: 0, sent: 0, failed: 0, suppressed: 0, pending: 0 };
  const templates = data?.templates ?? [];
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Email History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sensitive data — admin only. Showing transactional & auth email send activity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Range:</span>
          {(["24h", "7d", "30d", "custom"] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => { setRange(r); setPage(0); }}
              className="h-7 text-xs"
            >
              {r === "24h" ? "Last 24h" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "Custom"}
            </Button>
          ))}
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-7 text-xs w-36 bg-background" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-7 text-xs w-36 bg-background" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Template</Label>
            <Select value={template} onValueChange={(v) => { setTemplate(v); setPage(0); }}>
              <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger className="bg-background h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} color="text-foreground" />
        <StatCard label="Sent" value={stats.sent} color="text-success" />
        <StatCard label="Failed" value={stats.failed} color="text-destructive" />
        <StatCard label="Suppressed" value={stats.suppressed} color="text-warning" />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No emails found for the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Timestamp</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Template</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Recipient</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground whitespace-nowrap text-xs font-mono">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-foreground">{r.template_name}</td>
                      <td className="p-3 text-foreground font-mono text-xs">{r.recipient_email}</td>
                      <td className="p-3">{statusBadge(r.status)}</td>
                      <td className="p-3 text-xs text-destructive max-w-md truncate" title={r.error_message ?? ""}>
                        {r.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} · {rows.length} results
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminEmails;
