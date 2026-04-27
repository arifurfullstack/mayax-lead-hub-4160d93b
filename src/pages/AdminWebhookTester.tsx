import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FlaskConical, Copy, AlertTriangle, CheckCircle2, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SAMPLE_PAYLOAD = JSON.stringify(
  [
    {
      first_name: "Jose",
      last_name: "Chocano",
      email: "jose_chocano@hotmail.com",
      phone: "416 418 6379",
      city: "King City",
      province: "Ontario",
      income: "$7,500",
      credit_range_min: 800,
      credit_range_max: 900,
      vehicle_preference: "2023 Audi Q4 E-tron Sportback",
      trade_in: false,
      notes: "",
    },
    {
      first_name: "Shawn",
      last_name: "Delorey",
      email: "shawndelorey796@gmail.com",
      phone: "613 862 0420",
      city: "Ottawa",
      province: "",
      income: "$5,000",
      credit_range_min: 0,
      credit_range_max: 0,
      vehicle_preference: "SUV",
      trade_in: false,
      notes: "Income: $5,000",
    },
  ],
  null,
  2,
);

type LeadResult = {
  reference_code: string;
  status: string;
  ai_score?: number;
  quality_grade?: string;
  price?: number;
  error?: string;
  dry_run?: boolean;
  matched?: { id: string; reference_code: string; sold_status: string } | null;
  computed?: Record<string, unknown>;
};

type ApiResponse =
  | { success: true; dry_run: boolean; results: LeadResult[] }
  | { success?: false; error?: string; [k: string]: unknown };

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    created: { label: "Would create", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
    updated: { label: "Would update", cls: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
    merged: { label: "Would merge (sold)", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
    error: { label: "Error", cls: "bg-red-500/15 text-red-300 border-red-500/40" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function gradeBadge(grade?: string) {
  if (!grade) return null;
  return (
    <Badge variant="outline" className="font-mono">
      {grade}
    </Badge>
  );
}

const AdminWebhookTester = () => {
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const formatPayload = () => {
    try {
      const parsed = JSON.parse(payload);
      setPayload(JSON.stringify(parsed, null, 2));
      setParseError(null);
      toast.success("Payload formatted");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      toast.error("Cannot format — invalid JSON");
    }
  };

  const runDryRun = async () => {
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    setLatencyMs(null);
    setParseError(null);

    // Light client-side JSON sanity check (server still re-parses)
    try {
      JSON.parse(payload);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      setLoading(false);
      toast.error("Payload is not valid JSON");
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    };
    if (secret.trim()) headers["x-webhook-secret"] = secret.trim();

    const t0 = performance.now();
    try {
      const res = await fetch(`${FUNCTIONS_BASE}?dry_run=1`, {
        method: "POST",
        headers,
        body: payload,
      });
      setHttpStatus(res.status);
      setLatencyMs(Math.round(performance.now() - t0));
      const json = (await res.json()) as ApiResponse;
      setResponse(json);
      if (res.ok && (json as { success?: boolean }).success) {
        toast.success("Dry-run completed — no rows written");
      } else {
        toast.error(`Webhook returned ${res.status}`);
      }
    } catch (e) {
      setLatencyMs(Math.round(performance.now() - t0));
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = async () => {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    toast.success("Response copied");
  };

  const results: LeadResult[] | null =
    response && (response as { success?: boolean }).success
      ? (response as { results: LeadResult[] }).results
      : null;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Inbound Webhook Tester
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a Make.com payload and call the inbound webhook in <strong>dry-run mode</strong>.
          Validates parsing, dedupe matching, pricing, and grading without writing to the leads table.
        </p>
      </div>

      <Alert className="border-amber-500/40 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertTitle>Dry-run only</AlertTitle>
        <AlertDescription>
          Requests go to <code className="text-xs">{FUNCTIONS_BASE}?dry_run=1</code>. Nothing is inserted, updated, or deleted.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request payload</CardTitle>
            <CardDescription>
              JSON object or array. Same shape Make.com sends in production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                setParseError(null);
              }}
              placeholder="Paste JSON here…"
              className="font-mono text-xs min-h-[420px]"
              spellCheck={false}
            />
            {parseError && (
              <p className="text-xs text-red-400">JSON error: {parseError}</p>
            )}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                <code>x-webhook-secret</code> (optional — only if configured)
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Leave blank if no secret is set"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={runDryRun} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Run dry-run
              </Button>
              <Button variant="outline" onClick={formatPayload} disabled={loading} className="gap-2">
                <Wand2 className="h-4 w-4" /> Format JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPayload(SAMPLE_PAYLOAD);
                  setParseError(null);
                }}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Reset sample
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Response</CardTitle>
              <CardDescription>
                {httpStatus !== null ? (
                  <span className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={
                        httpStatus >= 200 && httpStatus < 300
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                          : "bg-red-500/15 text-red-300 border-red-500/40"
                      }
                    >
                      HTTP {httpStatus}
                    </Badge>
                    {latencyMs !== null && (
                      <span className="text-xs text-muted-foreground">{latencyMs} ms</span>
                    )}
                  </span>
                ) : (
                  "Awaiting first run"
                )}
              </CardDescription>
            </div>
            {response && (
              <Button variant="ghost" size="sm" onClick={copyResponse} className="gap-2">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!response && !loading && (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Run a dry-run to see per-lead results here.
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {response && !results && (
              <Alert className="border-red-500/40 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertTitle>Webhook rejected the request</AlertTitle>
                <AlertDescription>
                  <pre className="text-xs mt-2 overflow-auto max-h-48 bg-background/60 rounded p-2">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}

            {results && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {results.length} lead{results.length === 1 ? "" : "s"} processed · no rows written
                </div>
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                        <span className="font-mono text-sm">{r.reference_code}</span>
                        {statusBadge(r.status)}
                        {gradeBadge(r.quality_grade)}
                      </div>
                      {typeof r.price === "number" && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Price: </span>
                          <span className="font-semibold text-primary">${r.price}</span>
                          {typeof r.ai_score === "number" && (
                            <span className="text-muted-foreground ml-3">
                              AI {r.ai_score}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {r.error && (
                      <p className="text-xs text-red-400">{r.error}</p>
                    )}

                    {r.matched && (
                      <div className="text-xs text-muted-foreground">
                        Matched existing lead{" "}
                        <span className="font-mono text-foreground">{r.matched.reference_code}</span>{" "}
                        (status:{" "}
                        <span className="font-mono">{r.matched.sold_status}</span>)
                      </div>
                    )}

                    {r.computed && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Computed fields
                        </summary>
                        <pre className="mt-2 overflow-auto max-h-60 bg-background/60 rounded p-2 text-[11px] leading-relaxed">
                          {JSON.stringify(r.computed, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminWebhookTester;