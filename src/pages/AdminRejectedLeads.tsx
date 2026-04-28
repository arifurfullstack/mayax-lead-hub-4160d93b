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
import { AlertTriangle, RefreshCw, Search, Copy, Trash2, Loader2, RotateCw, CheckCircle2, XCircle, MapPin, Mail, Phone, FileWarning, UserX, Inbox, Filter as FilterIcon } from "lucide-react";
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

// ----------------------------------------------------------------------------
// error_type → human label, icon, and "what to do" tip
// ----------------------------------------------------------------------------
type ErrorTypeMeta = { label: string; tip: string; icon: typeof AlertTriangle; tone: string };

const ERROR_TYPE_META: Record<string, ErrorTypeMeta> = {
  validation: {
    label: "Validation",
    tip: "Generic validation failure — open the row to see the full message and payload.",
    icon: AlertTriangle,
    tone: "text-destructive",
  },
  missing_required_fields: {
    label: "Missing first/last name",
    tip: "Make.com is sending an empty first_name or last_name. Either map the correct variable or enable “Auto-fill missing names” in webhook settings.",
    icon: UserX,
    tone: "text-destructive",
  },
  name_recovery_failed: {
    label: "Name recovery failed",
    tip: "Auto-fill is ON but no usable name could be recovered from email/notes/name fields. Check that the customer's email is real and follows a name pattern (e.g. john.doe@…).",
    icon: UserX,
    tone: "text-warning",
  },
  payload_appears_empty: {
    label: "Empty payload",
    tip: "The HTTP request fired before your Make.com data-prep step finished. Add a Filter module that only continues when first_name AND last_name AND (email OR phone) are non-empty.",
    icon: Inbox,
    tone: "text-destructive",
  },
  city_looks_like_vehicle: {
    label: "Wrong mapping: city ↔ vehicle",
    tip: "The “city” field contains vehicle text (e.g. “Mercedes Benz”). In Make.com, swap the city and vehicle_preference variables in the HTTP module.",
    icon: MapPin,
    tone: "text-warning",
  },
  vehicle_looks_like_city: {
    label: "Vehicle looks like a city",
    tip: "vehicle_preference looks like a city name. Verify the Make.com mapping for both fields.",
    icon: MapPin,
    tone: "text-warning",
  },
  email_invalid: {
    label: "Invalid email",
    tip: "Make.com sent a non-email string in the email field (e.g. “None”, “unknown”). Make sure the email variable is mapped correctly and pass an empty string instead of placeholder text when missing.",
    icon: Mail,
    tone: "text-destructive",
  },
  phone_too_short: {
    label: "Phone too short",
    tip: "Phone has fewer than 7 digits. Check the source variable in Make.com — sometimes only the area code or extension makes it through.",
    icon: Phone,
    tone: "text-destructive",
  },
};

const metaFor = (errorType: string): ErrorTypeMeta =>
  ERROR_TYPE_META[errorType] ?? {
    label: errorType || "unknown",
    tip: "No specific guidance for this error type yet — open the row to inspect the payload.",
    icon: FileWarning,
    tone: "text-muted-foreground",
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
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>("all");
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
      if (errorTypeFilter !== "all" && r.error_type !== errorTypeFilter) return false;
      if (!q) return true;
      const haystack = [
        r.first_name, r.last_name, r.email, r.phone, r.reference_code,
        r.city, r.province, r.error_message, r.request_id,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, statusFilter, errorTypeFilter]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const now = Date.now();
    const last24h = rows.filter((r) => now - new Date(r.created_at).getTime() < 24 * 3600_000).length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const recovered = rows.filter((r) => r.status === "recovered").length;
    return { total: rows.length, last24h, pending, recovered };
  }, [data]);

  // Last-7-day breakdown by error_type (only counts pending+discarded — recovered = resolved)
  const errorHeatmap = useMemo(() => {
    const rows = data ?? [];
    const cutoff = Date.now() - 7 * 24 * 3600_000;
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (new Date(r.created_at).getTime() < cutoff) continue;
      if (r.status === "recovered") continue;
      const k = r.error_type || "unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const allErrorTypes = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => set.add(r.error_type || "unknown"));
    return Array.from(set).sort();
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
        <StatCard label="Pending retry" value={stats.pending} accent="text-warning" />
        <StatCard label="Auto-recovered" value={stats.recovered} accent="text-success" />
      </div>

      {/* Last-7-day error-type heatmap */}
      {errorHeatmap.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Last 7 days · rejections by reason</h2>
            <span className="text-[11px] text-muted-foreground">click a card to filter</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {errorHeatmap.map(([type, count]) => {
              const meta = metaFor(type);
              const Icon = meta.icon;
              const isActive = errorTypeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setErrorTypeFilter(isActive ? "all" : type)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                    <span className="text-xs font-medium truncate">{meta.label}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-xl font-bold ${meta.tone}`}>{count}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{type}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, ref code, error…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={errorTypeFilter}
              onChange={(e) => setErrorTypeFilter(e.target.value)}
              className="text-xs bg-card border border-border rounded px-2 py-1.5 text-foreground"
            >
              <option value="all">All error types</option>
              {allErrorTypes.map((t) => (
                <option key={t} value={t}>{metaFor(t).label} ({t})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 p-1">
            {(["pending", "recovered", "discarded", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            🎉 No rejected inbound leads match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const isPending = row.status === "pending";
                  return (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        {row.status === "recovered" ? (
                          <Badge className="bg-success/15 text-success border border-success/40 gap-1 font-normal">
                            <CheckCircle2 className="h-3 w-3" /> recovered
                          </Badge>
                        ) : row.status === "discarded" ? (
                          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                            <XCircle className="h-3 w-3" /> discarded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40 font-normal">
                            pending
                          </Badge>
                        )}
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
                        {(() => {
                          const meta = metaFor(row.error_type);
                          const Icon = meta.icon;
                          const firstLine = row.error_message.split("\n")[0];
                          return (
                            <div className="flex flex-col gap-1 max-w-[28rem]">
                              <Badge
                                variant="outline"
                                className={`gap-1.5 font-normal w-fit ${meta.tone} border-current/40`}
                              >
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground line-clamp-2">
                                {firstLine}
                              </span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.retry_count > 0 ? (
                          <span>
                            ×{row.retry_count}
                            {row.last_retry_at && (
                              <span className="block text-[10px]">{formatDateTime(row.last_retry_at)}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {isPending && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              disabled={retryingId === row.id}
                              onClick={() => handleRetry(row)}
                            >
                              {retryingId === row.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCw className="h-3 w-3" />
                              )}
                              Retry
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                            View
                          </Button>
                        </div>
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
              {selected.status !== "pending" && (
                <div
                  className={`rounded-md border p-3 text-sm ${
                    selected.status === "recovered"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border/60 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {selected.status === "recovered" ? (
                    <>
                      ✅ Auto-recovered{selected.recovered_at && ` at ${formatDateTime(selected.recovered_at)}`}
                      {selected.recovered_lead_id && (
                        <span className="block text-xs font-mono mt-1 opacity-80">
                          → lead {selected.recovered_lead_id}
                        </span>
                      )}
                    </>
                  ) : (
                    <>🚫 Discarded — retry-merge will skip this record.</>
                  )}
                </div>
              )}
              {selected.retry_count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Retry attempts: <strong>{selected.retry_count}</strong>
                  {selected.last_retry_at && ` · last ${formatDateTime(selected.last_retry_at)}`}
                </p>
              )}

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
            {selected && selected.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={retryingId === selected.id}
                  onClick={() => handleRetry(selected)}
                >
                  {retryingId === selected.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Retry now
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => handleDiscard(selected.id)}>
                  <XCircle className="h-4 w-4" /> Discard
                </Button>
              </>
            )}
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