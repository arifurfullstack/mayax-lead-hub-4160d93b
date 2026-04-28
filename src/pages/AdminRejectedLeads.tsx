import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, RefreshCw, Search, Copy, Trash2, Loader2, RotateCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type RejectedRow = {
  id: string;
  created_at: string;
  request_id: string | null;
  reference_code: string | null;
  error_message: string;
  error_type: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  payload: Record<string, unknown>;
  source_ip: string | null;
  user_agent: string | null;
  status: "pending" | "recovered" | "discarded";
  recovered_lead_id: string | null;
  recovered_at: string | null;
  retry_count: number;
  last_retry_at: string | null;
};

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const missingFieldsFromError = (err: string): string[] => {
  const m = err.match(/Missing required fields:\s*(.+)/i);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
};

const StatCard = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
  <div className="glass-card p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
    <p className={`text-2xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
  </div>
);

const AdminRejectedLeads = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RejectedRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "recovered" | "discarded">("pending");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-rejected-inbound-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rejected_inbound_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as RejectedRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        r.first_name, r.last_name, r.email, r.phone, r.reference_code,
        r.city, r.province, r.error_message, r.request_id,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, statusFilter]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const now = Date.now();
    const last24h = rows.filter((r) => now - new Date(r.created_at).getTime() < 24 * 3600_000).length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const recovered = rows.filter((r) => r.status === "recovered").length;
    return { total: rows.length, last24h, pending, recovered };
  }, [data]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rejected_inbound_leads").delete().eq("id", id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success("Rejection record removed");
    setSelected(null);
    refetch();
  };

  const handleDiscard = async (id: string) => {
    const { error } = await supabase
      .from("rejected_inbound_leads")
      .update({ status: "discarded" })
      .eq("id", id);
    if (error) {
      toast.error(`Discard failed: ${error.message}`);
      return;
    }
    toast.success("Marked as discarded — retry-merge will skip it");
    refetch();
  };

  const handleRetry = async (row: RejectedRow) => {
    // Manual retry: re-POST the original payload through the inbound webhook.
    // The server's retry-merge logic will pull in any other pending rejections
    // for the same email/phone and re-attempt name recovery.
    setRetryingId(row.id);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
        body: JSON.stringify(row.payload),
      });
      const json = await res.json().catch(() => ({}));
      const result = Array.isArray(json?.results) ? json.results[0] : null;
      if (res.ok && result && result.status !== "error") {
        toast.success(
          `Retry succeeded — lead ${result.status} (ref ${result.reference_code ?? "—"})`,
        );
      } else {
        toast.error(
          `Retry still failed: ${result?.error ?? json?.error ?? `HTTP ${res.status}`}`,
        );
      }
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopyPayload = async (payload: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Payload copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Rejected Inbound Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound webhook payloads that failed validation and never reached the leads table.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total rejected" value={stats.total} />
        <StatCard label="Last 24h" value={stats.last24h} accent="text-destructive" />
        <StatCard label="Missing name fields" value={stats.missingNames} accent="text-warning" />
        <StatCard label="Other errors" value={stats.other} accent="text-foreground" />
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, ref code, error…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            🎉 No rejected inbound leads {search ? "match this search" : "in the last 500 records"}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Missing fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const missing = missingFieldsFromError(row.error_message);
                  return (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {[row.first_name, row.last_name].filter(Boolean).join(" ") || (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{row.email || <span className="text-muted-foreground italic">no email</span>}</span>
                          <span className="text-muted-foreground text-xs">{row.phone || "no phone"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="destructive" className="font-normal">
                          {row.error_message}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {missing.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : missing.map((f) => (
                            <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Rejection details
            </DialogTitle>
            <DialogDescription>
              {selected && formatDateTime(selected.created_at)} · request {selected?.request_id ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-xs uppercase tracking-wide text-destructive mb-1">Validation error</p>
                <p className="text-sm text-foreground font-medium">{selected.error_message}</p>
                {missingFieldsFromError(selected.error_message).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {missingFieldsFromError(selected.error_message).map((f) => (
                      <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">First name</p><p>{selected.first_name || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Last name</p><p>{selected.last_name || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p>{selected.email || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p>{selected.phone || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">City</p><p>{selected.city || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Province</p><p>{selected.province || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Reference code</p><p>{selected.reference_code || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Source IP</p><p className="font-mono text-xs">{selected.source_ip || "—"}</p></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Raw payload</p>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => handleCopyPayload(selected.payload)}>
                    <Copy className="h-3 w-3" /> Copy JSON
                  </Button>
                </div>
                <pre className="bg-muted/40 rounded-md p-3 text-xs overflow-x-auto max-h-72">
{JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>

              {selected.user_agent && (
                <p className="text-xs text-muted-foreground break-all">UA: {selected.user_agent}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {selected && (
              <Button variant="destructive" className="gap-2" onClick={() => handleDelete(selected.id)}>
                <Trash2 className="h-4 w-4" /> Delete record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRejectedLeads;