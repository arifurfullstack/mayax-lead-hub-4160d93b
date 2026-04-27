import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FlaskConical, Copy, AlertTriangle, CheckCircle2, RefreshCw, Wand2, BookOpen, Info, ShieldAlert, ShieldCheck, FileJson, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// --- Schema reference (mirrors supabase/functions/inbound-webhook/index.ts) ---
type FieldDef = {
  name: string;
  type: string;
  required?: boolean;
  notes: string;
  example?: string;
};

const SCHEMA_FIELDS: FieldDef[] = [
  { name: "first_name", type: "string", required: true, notes: "Required. Used together with phone/email for dedupe.", example: '"Jose"' },
  { name: "last_name", type: "string", required: true, notes: "Required.", example: '"Chocano"' },
  { name: "email", type: "string", notes: "Used for dedupe (case-insensitive). Strongly recommended.", example: '"jose@example.com"' },
  { name: "phone", type: "string", notes: "Dedupe falls back to last 10 digits. Any format accepted (spaces, dashes, +1).", example: '"416 418 6379"' },
  { name: "city", type: "string", notes: "Free text.", example: '"King City"' },
  { name: "province", type: "string", notes: "Free text. Any province/state.", example: '"Ontario"' },
  { name: "buyer_type", type: "string", notes: 'Defaults to "online" if omitted.', example: '"online"' },
  { name: "income", type: "number | string", notes: 'Monthly income. Comma-grouped strings ("$5,000") are auto-stripped. ≥ $1,800 adds tier1 pricing; ≥ $5,000 adds tier1+tier2.', example: '5000 or "$5,000"' },
  { name: "credit_range_min", type: "number", notes: "Optional credit score floor.", example: "680" },
  { name: "credit_range_max", type: "number", notes: "Optional credit score ceiling.", example: "720" },
  { name: "vehicle_preference", type: "string", notes: 'Specific vehicles ("2024 Honda CR-V") score higher than generic ("SUV", "truck").', example: '"2023 Audi Q4 e-tron"' },
  { name: "vehicle_mileage", type: "number", notes: "Optional km/mi.", example: "45000" },
  { name: "vehicle_price", type: "number", notes: "Optional asking price.", example: "32000" },
  { name: "trade_in", type: "boolean", notes: 'Adds trade-in pricing. Also auto-detected from notes containing "trade".', example: "true" },
  { name: "appointment_time", type: "string (ISO8601)", notes: "Adds appointment pricing. Auto-set if notes mention an appointment.", example: '"2026-04-28T14:00:00-04:00"' },
  { name: "notes", type: "string", notes: 'Free text. Auto-flags: "trade", "bankrupt", "appointment". Appended on duplicates.', example: '"Wants to trade in 2018 Civic"' },
  { name: "reference_code", type: "string", notes: "Optional. If omitted, generated as MX-YYYY-XXX. Existing match takes precedence.", example: '"MX-2026-123"' },
];

// --- Client-side validation schema (mirrors webhook contract) ---
// Numbers may arrive as plain numbers or comma-grouped strings ($5,000) — server strips them.
const numericLike = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .refine(
    (v) => {
      if (v === undefined || v === null || v === "") return true;
      if (typeof v === "number") return Number.isFinite(v);
      const cleaned = v.replace(/[$£€¥,\s]/g, "");
      if (cleaned === "") return true;
      return !Number.isNaN(Number(cleaned));
    },
    { message: "must be a number or numeric string (e.g. 5000 or \"$5,000\")" },
  );

const isoLike = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .refine(
    (v) => {
      if (v === undefined || v === null || v === "") return true;
      if (typeof v !== "string") return false;
      return !Number.isNaN(Date.parse(v));
    },
    { message: "must be a valid ISO8601 date string" },
  );

const leadSchema = z
  .object({
    first_name: z.string().trim().min(1, { message: "first_name is required" }).max(100),
    last_name: z.string().trim().min(1, { message: "last_name is required" }).max(100),
    email: z.string().trim().email({ message: "must be a valid email" }).max(255).optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    province: z.string().trim().max(100).optional().or(z.literal("")),
    buyer_type: z.string().trim().max(50).optional().or(z.literal("")),
    income: numericLike,
    credit_range_min: numericLike,
    credit_range_max: numericLike,
    vehicle_preference: z.string().trim().max(200).optional().or(z.literal("")),
    vehicle_mileage: numericLike,
    vehicle_price: numericLike,
    trade_in: z.boolean().optional(),
    appointment_time: isoLike,
    notes: z.string().max(5000).optional().or(z.literal("")),
    reference_code: z.string().trim().max(50).optional().or(z.literal("")),
  })
  .passthrough(); // unknown fields allowed (server ignores them)

type ValidationIssue = {
  leadIndex: number | null; // null = top-level (e.g. payload not object/array)
  field: string;
  message: string;
};

// --- Suggested fix engine ---
// Given a validation issue, propose a safe value to drop into the offending field
// so the user can re-run without manual JSON editing.
type FixSuggestion = {
  label: string; // short button label, e.g. `Set "Unknown"`
  description: string; // tooltip / aria description
  apply: (lead: Record<string, unknown>) => void;
};

function suggestFix(issue: ValidationIssue): FixSuggestion | null {
  if (issue.leadIndex === null) return null;
  const field = issue.field;
  const msg = issue.message.toLowerCase();

  // Required string fields
  if (field === "first_name" || field === "last_name") {
    const val = field === "first_name" ? "Unknown" : "Lead";
    return {
      label: `Set "${val}"`,
      description: `Fill ${field} with placeholder "${val}" so the webhook accepts the lead.`,
      apply: (lead) => {
        lead[field] = val;
      },
    };
  }

  // Email — invalid format → drop the field (it's optional)
  if (field === "email") {
    return {
      label: "Clear email",
      description: "Remove the invalid email. Dedupe will fall back to phone.",
      apply: (lead) => {
        delete lead.email;
      },
    };
  }

  // Numeric-like fields → coerce to number or null
  const numericFields = new Set([
    "income",
    "credit_range_min",
    "credit_range_max",
    "vehicle_mileage",
    "vehicle_price",
  ]);
  if (numericFields.has(field) && msg.includes("number")) {
    return {
      label: "Clear value",
      description: `Remove ${field}. The webhook will treat it as not provided.`,
      apply: (lead) => {
        delete lead[field];
      },
    };
  }

  // ISO8601 appointment_time
  if (field === "appointment_time") {
    return {
      label: "Clear appointment",
      description: "Remove the invalid appointment_time so the webhook ignores it.",
      apply: (lead) => {
        delete lead.appointment_time;
      },
    };
  }

  // Length overflow on free-text fields → truncate to 100 chars (safe upper bound)
  if (msg.includes("at most") || msg.includes("characters") || msg.includes("max")) {
    return {
      label: "Truncate",
      description: `Shorten ${field} to a safe length.`,
      apply: (lead) => {
        const v = lead[field];
        if (typeof v === "string") lead[field] = v.slice(0, 100);
      },
    };
  }

  // Lead is not an object → replace with empty stub
  if (issue.field === "(root)" && msg.includes("object")) {
    return {
      label: "Replace with stub",
      description: "Replace this entry with an empty lead object.",
      apply: () => {
        // handled at array level — see applyFix
      },
    };
  }

  return null;
}

type ValidationResult = {
  ok: boolean;
  jsonError: string | null;
  totalLeads: number;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
};

function validatePayload(raw: string): ValidationResult {
  if (!raw.trim()) {
    return { ok: false, jsonError: "Payload is empty", totalLeads: 0, issues: [], warnings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      jsonError: e instanceof Error ? e.message : "Invalid JSON",
      totalLeads: 0,
      issues: [],
      warnings: [],
    };
  }
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      jsonError: null,
      totalLeads: 0,
      issues: [{ leadIndex: null, field: "(root)", message: "must be an object or an array of objects" }],
      warnings: [],
    };
  }
  const leads = Array.isArray(parsed) ? parsed : [parsed];
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  leads.forEach((lead, idx) => {
    if (lead === null || typeof lead !== "object" || Array.isArray(lead)) {
      issues.push({ leadIndex: idx, field: "(root)", message: "each lead must be a JSON object" });
      return;
    }
    const result = leadSchema.safeParse(lead);
    if (!result.success) {
      result.error.issues.forEach((iss) => {
        issues.push({
          leadIndex: idx,
          field: iss.path.join(".") || "(root)",
          message: iss.message,
        });
      });
    }
    // Soft warnings — won't block submit, but very likely to cause downstream issues
    const l = lead as Record<string, unknown>;
    const hasEmail = typeof l.email === "string" && l.email.trim() !== "";
    const hasPhone = typeof l.phone === "string" && l.phone.trim() !== "";
    if (!hasEmail && !hasPhone) {
      warnings.push({
        leadIndex: idx,
        field: "email / phone",
        message: "no email or phone — dedupe will not work, every send creates a new lead",
      });
    }
    if (hasPhone && typeof l.phone === "string") {
      const digits = l.phone.replace(/[^0-9]/g, "");
      if (digits.length < 7) {
        warnings.push({
          leadIndex: idx,
          field: "phone",
          message: `only ${digits.length} digits — dedupe needs at least 7`,
        });
      }
    }
  });

  return {
    ok: issues.length === 0,
    jsonError: null,
    totalLeads: leads.length,
    issues,
    warnings,
  };
}

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

// --- Payload templates ---
// Each template returns a JSON string ready to drop into the editor.
// Designed to exercise different code paths in the inbound webhook
// (single vs. batch, dedupe edge cases, scoring/pricing modifiers).
type PayloadTemplate = {
  id: string;
  label: string;
  description: string;
  group: "single" | "batch";
  build: () => string;
};

const stringify = (obj: unknown) => JSON.stringify(obj, null, 2);

const PAYLOAD_TEMPLATES: PayloadTemplate[] = [
  {
    id: "single-minimal",
    label: "Single — minimal",
    description: "Only first_name + last_name. Tests required-fields path.",
    group: "single",
    build: () =>
      stringify({
        first_name: "Test",
        last_name: "Lead",
      }),
  },
  {
    id: "single-full",
    label: "Single — full lead",
    description: "All fields populated. High AI score + max pricing modifiers.",
    group: "single",
    build: () =>
      stringify({
        first_name: "Alex",
        last_name: "Martin",
        email: "alex.martin@example.com",
        phone: "647 555 0142",
        city: "Toronto",
        province: "Ontario",
        buyer_type: "online",
        income: "$6,800",
        credit_range_min: 720,
        credit_range_max: 780,
        vehicle_preference: "2024 Honda CR-V Hybrid",
        vehicle_mileage: 12000,
        vehicle_price: 38000,
        trade_in: true,
        appointment_time: new Date(Date.now() + 86_400_000).toISOString(),
        notes: "Wants to trade in 2018 Civic. Prefers weekend appointment.",
      }),
  },
  {
    id: "single-appointment",
    label: "Single — with appointment",
    description: "Triggers appointment pricing bonus + AI score boost.",
    group: "single",
    build: () =>
      stringify({
        first_name: "Priya",
        last_name: "Sharma",
        email: "priya.sharma@example.com",
        phone: "905 555 0188",
        city: "Mississauga",
        province: "Ontario",
        income: 5200,
        vehicle_preference: "2023 Toyota RAV4",
        appointment_time: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        notes: "Confirmed phone appointment for Saturday morning.",
      }),
  },
  {
    id: "single-bankruptcy",
    label: "Single — bankruptcy flag",
    description: 'Notes contain "bankrupt" — auto-flags has_bankruptcy.',
    group: "single",
    build: () =>
      stringify({
        first_name: "Jordan",
        last_name: "Reid",
        email: "jordan.reid@example.com",
        phone: "416 555 0199",
        city: "Toronto",
        province: "Ontario",
        income: "$3,200",
        vehicle_preference: "Sedan",
        notes: "Discharged bankruptcy 18 months ago, looking to rebuild credit.",
      }),
  },
  {
    id: "batch-mixed",
    label: "Batch — mixed quality",
    description: "3 leads spanning A+ to D grades. Good for grading sanity check.",
    group: "batch",
    build: () =>
      stringify([
        {
          first_name: "Olivia",
          last_name: "Tremblay",
          email: "olivia.t@example.com",
          phone: "514 555 0123",
          city: "Montreal",
          province: "Quebec",
          income: "$7,500",
          vehicle_preference: "2024 Tesla Model Y",
          trade_in: true,
          appointment_time: new Date(Date.now() + 86_400_000).toISOString(),
          notes: "Cash buyer, trade-in available.",
        },
        {
          first_name: "Marcus",
          last_name: "Bell",
          email: "marcus.bell@example.com",
          phone: "604 555 0177",
          city: "Vancouver",
          province: "British Columbia",
          income: 2400,
          vehicle_preference: "Truck",
          notes: "",
        },
        {
          first_name: "Sara",
          last_name: "Lopez",
          phone: "780 555 0145",
          city: "Edmonton",
          province: "Alberta",
        },
      ]),
  },
  {
    id: "batch-dedupe",
    label: "Batch — dedupe test",
    description: "Two leads sharing email/phone. Second should match the first.",
    group: "batch",
    build: () =>
      stringify([
        {
          first_name: "Daniel",
          last_name: "Kim",
          email: "daniel.kim@example.com",
          phone: "416 555 0210",
          city: "Toronto",
          province: "Ontario",
          income: 4200,
          vehicle_preference: "2022 Mazda CX-5",
          notes: "Initial inquiry.",
        },
        {
          first_name: "Daniel",
          last_name: "Kim",
          email: "DANIEL.KIM@example.com",
          phone: "(416) 555-0210",
          income: 4500,
          notes: "Follow-up — bumped income, wants test drive.",
        },
      ]),
  },
  {
    id: "batch-large",
    label: "Batch — 5 leads",
    description: "Larger batch to exercise the loop and per-lead results UI.",
    group: "batch",
    build: () => {
      const provinces = ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba"];
      const cities = ["Toronto", "Montreal", "Vancouver", "Calgary", "Winnipeg"];
      const vehicles = [
        "2024 Honda CR-V",
        "2023 Ford F-150",
        "SUV",
        "2022 Hyundai Elantra",
        "Minivan",
      ];
      const incomes = ["$6,200", 3800, "$1,900", 5500, 2100];
      const leads = Array.from({ length: 5 }, (_, i) => ({
        first_name: ["Emma", "Liam", "Noah", "Ava", "Mia"][i],
        last_name: ["Brown", "Singh", "Nguyen", "Patel", "Garcia"][i],
        email: `lead${i + 1}@example.com`,
        phone: `416 555 02${String(10 + i).padStart(2, "0")}`,
        city: cities[i],
        province: provinces[i],
        income: incomes[i],
        vehicle_preference: vehicles[i],
        trade_in: i % 2 === 0,
        notes: i === 2 ? "Recent bankruptcy, rebuilding credit." : "",
      }));
      return stringify(leads);
    },
  },
];

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

  const validation = useMemo(() => validatePayload(payload), [payload]);

  // Preview state — when set, the diff dialog is open showing before/after.
  type PendingFix =
    | { kind: "single"; issue: ValidationIssue; fix: FixSuggestion; nextPayload: string; appliedCount: number }
    | { kind: "all"; nextPayload: string; appliedCount: number; skippedCount: number };
  const [pendingFix, setPendingFix] = useState<PendingFix | null>(null);

  // Pure: compute the resulting JSON string for a single fix without mutating state.
  // Returns null if payload is unparseable or the fix can't be located.
  const computeSingleFix = (
    issue: ValidationIssue,
    fix: FixSuggestion,
  ): { nextPayload: string } | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
    const isArray = Array.isArray(parsed);
    const leads = isArray ? (parsed as unknown[]) : [parsed];
    if (issue.leadIndex === null || issue.leadIndex < 0 || issue.leadIndex >= leads.length) {
      return null;
    }
    const target = leads[issue.leadIndex];
    if (target === null || typeof target !== "object" || Array.isArray(target)) {
      leads[issue.leadIndex] = { first_name: "Unknown", last_name: "Lead" };
    } else {
      // Deep-clone the lead so the original `parsed` (and therefore preview) stays intact
      // even though we already re-stringify below — safer if logic evolves.
      fix.apply(target as Record<string, unknown>);
    }
    const next = isArray ? leads : leads[0];
    return { nextPayload: JSON.stringify(next, null, 2) };
  };

  // Pure: compute the resulting JSON for "apply all" without mutating state.
  const computeAllFixes = (): {
    nextPayload: string;
    appliedCount: number;
    skippedCount: number;
  } | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
    const isArray = Array.isArray(parsed);
    const leads = isArray ? (parsed as unknown[]) : [parsed];
    let applied = 0;
    let skipped = 0;
    for (const iss of validation.issues) {
      const fix = suggestFix(iss);
      if (!fix || iss.leadIndex === null) {
        skipped++;
        continue;
      }
      const target = leads[iss.leadIndex];
      if (target === null || typeof target !== "object" || Array.isArray(target)) {
        leads[iss.leadIndex] = { first_name: "Unknown", last_name: "Lead" };
      } else {
        fix.apply(target as Record<string, unknown>);
      }
      applied++;
    }
    if (applied === 0) return null;
    const next = isArray ? leads : leads[0];
    return {
      nextPayload: JSON.stringify(next, null, 2),
      appliedCount: applied,
      skippedCount: skipped,
    };
  };

  // Open the preview dialog for a single suggested fix.
  const previewFix = (issue: ValidationIssue, fix: FixSuggestion) => {
    const computed = computeSingleFix(issue, fix);
    if (!computed) {
      toast.error("Cannot preview fix — JSON is invalid or out of range");
      return;
    }
    setPendingFix({
      kind: "single",
      issue,
      fix,
      nextPayload: computed.nextPayload,
      appliedCount: 1,
    });
  };

  // Open the preview dialog for "apply all suggested fixes".
  const previewAllFixes = () => {
    const computed = computeAllFixes();
    if (!computed) {
      toast.error("No suggested fixes available or JSON is invalid");
      return;
    }
    setPendingFix({ kind: "all", ...computed });
  };

  // Confirm the currently-pending fix: commit it to the editor.
  const confirmPendingFix = () => {
    if (!pendingFix) return;
    setPayload(pendingFix.nextPayload);
    if (pendingFix.kind === "single") {
      toast.success(`Applied: ${pendingFix.fix.label}`);
    } else {
      toast.success(
        `Applied ${pendingFix.appliedCount} fix${pendingFix.appliedCount === 1 ? "" : "es"}` +
          (pendingFix.skippedCount > 0
            ? ` · ${pendingFix.skippedCount} had no suggestion`
            : ""),
      );
    }
    setPendingFix(null);
  };

  // Lightweight per-line diff for the side-by-side preview.
  // Marks a line as "added" if it's only in `next`, "removed" if only in `prev`,
  // and "same" otherwise. Index-aligned for simple visual scanning — not a true LCS diff,
  // but sufficient for the small JSON snippets we're showing.
  type DiffLine = { kind: "same" | "added" | "removed"; text: string };
  const buildDiff = (prev: string, next: string): { left: DiffLine[]; right: DiffLine[] } => {
    const prevLines = prev.split("\n");
    const nextLines = next.split("\n");
    const prevSet = new Set(prevLines);
    const nextSet = new Set(nextLines);
    const left: DiffLine[] = prevLines.map((text) => ({
      kind: nextSet.has(text) ? "same" : "removed",
      text,
    }));
    const right: DiffLine[] = nextLines.map((text) => ({
      kind: prevSet.has(text) ? "same" : "added",
      text,
    }));
    return { left, right };
  };

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
    if (!validation.ok) {
      toast.error(
        validation.jsonError
          ? `JSON error: ${validation.jsonError}`
          : `${validation.issues.length} validation issue${validation.issues.length === 1 ? "" : "s"} — fix before sending`,
      );
      return;
    }
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    setLatencyMs(null);
    setParseError(null);

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
    <TooltipProvider delayDuration={150}>
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

      <Collapsible defaultOpen className="rounded-lg border border-border/60 bg-card/40">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-card/60 transition-colors">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Payload schema reference</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {SCHEMA_FIELDS.filter((f) => f.required).length} required
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">click to toggle</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3">
            <p className="text-xs text-muted-foreground">
              Send a single object or an array of objects. Unknown fields are ignored. Hover any field for details.
            </p>
            <div className="overflow-auto rounded border border-border/50">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Field</th>
                    <th className="text-left font-medium px-3 py-2">Type</th>
                    <th className="text-left font-medium px-3 py-2">Required</th>
                    <th className="text-left font-medium px-3 py-2">Notes</th>
                    <th className="text-left font-medium px-3 py-2">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEMA_FIELDS.map((f) => (
                    <tr key={f.name} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 cursor-help">
                              {f.name}
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="text-xs leading-relaxed">{f.notes}</p>
                            {f.example && (
                              <p className="text-[11px] font-mono text-muted-foreground mt-1">
                                e.g. {f.example}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{f.type}</td>
                      <td className="px-3 py-2">
                        {f.required ? (
                          <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40 text-[10px]">
                            required
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">optional</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{f.notes}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{f.example ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong>Dedupe priority:</strong> email (case-insensitive) → phone (last 10 digits). If a match exists and is{" "}
              <code>available</code>, all fields are refreshed and notes appended. If the match is <code>sold</code>, only notes are appended.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Request payload
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm">
                  <p className="text-xs leading-relaxed">
                    Required: <code>first_name</code>, <code>last_name</code>. Recommended: <code>email</code> and{" "}
                    <code>phone</code> for dedupe. See the schema reference above for all fields.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
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

            {/* --- Live validation summary --- */}
            {(() => {
              if (validation.jsonError) {
                return (
                  <Alert className="border-red-500/40 bg-red-500/10 py-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <AlertTitle className="text-xs">Invalid JSON</AlertTitle>
                    <AlertDescription className="text-xs font-mono">
                      {validation.jsonError}
                    </AlertDescription>
                  </Alert>
                );
              }
              if (validation.issues.length > 0) {
                return (
                  <Alert className="border-red-500/40 bg-red-500/10 py-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <AlertTitle className="text-xs">
                      {validation.issues.length} validation{" "}
                      {validation.issues.length === 1 ? "error" : "errors"} across{" "}
                      {validation.totalLeads} lead{validation.totalLeads === 1 ? "" : "s"}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="text-xs space-y-1.5 mt-2 max-h-56 overflow-auto">
                        {validation.issues.slice(0, 20).map((iss, i) => {
                          const fix = suggestFix(iss);
                          return (
                            <li
                              key={i}
                              className="flex items-start justify-between gap-2 font-mono"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-red-300">
                                  {iss.leadIndex !== null ? `lead[${iss.leadIndex}]` : "root"}
                                  {iss.field !== "(root)" && <>.{iss.field}</>}
                                </span>{" "}
                                <span className="text-muted-foreground">— {iss.message}</span>
                              </div>
                              {fix ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] gap-1 shrink-0 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
                                      onClick={() => previewFix(iss, fix)}
                                    >
                                      <Wand2 className="h-3 w-3" />
                                      Preview fix
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <p className="text-xs font-medium">{fix.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{fix.description}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                                      Opens a side-by-side diff. Nothing is changed until you confirm.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-[10px] text-muted-foreground shrink-0 italic">
                                  no auto-fix
                                </span>
                              )}
                            </li>
                          );
                        })}
                        {validation.issues.length > 20 && (
                          <li className="text-muted-foreground">…and {validation.issues.length - 20} more</li>
                        )}
                      </ul>
                      {validation.issues.some((i) => suggestFix(i)) && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
                            onClick={previewAllFixes}
                          >
                            <Wand2 className="h-3 w-3" />
                            Preview all suggested fixes
                          </Button>
                        </div>
                      )}
                      {validation.warnings.length > 0 && (
                        <p className="text-[11px] text-amber-300 mt-2">
                          + {validation.warnings.length} warning{validation.warnings.length === 1 ? "" : "s"} (see below)
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              }
              return (
                <Alert className="border-emerald-500/40 bg-emerald-500/10 py-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <AlertTitle className="text-xs">
                    Schema OK — {validation.totalLeads} lead{validation.totalLeads === 1 ? "" : "s"} ready to send
                  </AlertTitle>
                  {validation.warnings.length > 0 && (
                    <AlertDescription>
                      <ul className="text-xs space-y-1 mt-2 max-h-32 overflow-auto">
                        {validation.warnings.slice(0, 10).map((w, i) => (
                          <li key={i} className="font-mono">
                            <span className="text-amber-300">
                              lead[{w.leadIndex}].{w.field}
                            </span>{" "}
                            <span className="text-muted-foreground">— {w.message}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  )}
                </Alert>
              );
            })()}

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
              <Button onClick={runDryRun} disabled={loading || !validation.ok} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                {validation.ok ? "Run dry-run" : "Fix errors to run"}
              </Button>
              <Button variant="outline" onClick={formatPayload} disabled={loading} className="gap-2">
                <Wand2 className="h-4 w-4" /> Format JSON
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={loading} className="gap-2">
                    <FileJson className="h-4 w-4" /> Templates
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Single lead
                  </DropdownMenuLabel>
                  {PAYLOAD_TEMPLATES.filter((t) => t.group === "single").map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => {
                        setPayload(t.build());
                        setParseError(null);
                        setResponse(null);
                        setHttpStatus(null);
                        toast.success(`Loaded template: ${t.label}`);
                      }}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-xs font-medium">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {t.description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Multi-lead batch
                  </DropdownMenuLabel>
                  {PAYLOAD_TEMPLATES.filter((t) => t.group === "batch").map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => {
                        setPayload(t.build());
                        setParseError(null);
                        setResponse(null);
                        setHttpStatus(null);
                        toast.success(`Loaded template: ${t.label}`);
                      }}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-xs font-medium">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {t.description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

      {/* --- Suggested fix preview dialog --- */}
      <Dialog open={pendingFix !== null} onOpenChange={(open) => { if (!open) setPendingFix(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-emerald-400" />
              {pendingFix?.kind === "single"
                ? `Preview fix: ${pendingFix.fix.label}`
                : pendingFix?.kind === "all"
                ? `Preview all suggested fixes`
                : "Preview fix"}
            </DialogTitle>
            <DialogDescription>
              {pendingFix?.kind === "single" ? (
                <>
                  Targeting{" "}
                  <code className="text-xs">
                    lead[{pendingFix.issue.leadIndex}]
                    {pendingFix.issue.field !== "(root)" && `.${pendingFix.issue.field}`}
                  </code>{" "}
                  — {pendingFix.fix.description}
                </>
              ) : pendingFix?.kind === "all" ? (
                <>
                  {pendingFix.appliedCount} fix{pendingFix.appliedCount === 1 ? "" : "es"} will be applied
                  {pendingFix.skippedCount > 0 && (
                    <> · {pendingFix.skippedCount} issue{pendingFix.skippedCount === 1 ? "" : "s"} have no auto-fix</>
                  )}
                  . Review the diff below.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {pendingFix && (() => {
            const { left, right } = buildDiff(payload, pendingFix.nextPayload);
            const removedCount = left.filter((l) => l.kind === "removed").length;
            const addedCount = right.filter((l) => l.kind === "added").length;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">
                    − {removedCount} removed
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                    + {addedCount} added
                  </Badge>
                  {removedCount === 0 && addedCount === 0 && (
                    <span className="italic">No textual change — fix may be a no-op.</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Before
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto">
                      {left.map((line, i) => (
                        <div
                          key={i}
                          className={
                            line.kind === "removed"
                              ? "bg-red-500/15 text-red-300 px-3"
                              : "px-3 text-muted-foreground"
                          }
                        >
                          <span className="inline-block w-3 select-none opacity-60">
                            {line.kind === "removed" ? "−" : " "}
                          </span>{" "}
                          {line.text || "\u00A0"}
                        </div>
                      ))}
                    </pre>
                  </div>
                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      After
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto">
                      {right.map((line, i) => (
                        <div
                          key={i}
                          className={
                            line.kind === "added"
                              ? "bg-emerald-500/15 text-emerald-300 px-3"
                              : "px-3 text-muted-foreground"
                          }
                        >
                          <span className="inline-block w-3 select-none opacity-60">
                            {line.kind === "added" ? "+" : " "}
                          </span>{" "}
                          {line.text || "\u00A0"}
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingFix(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPendingFix} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Apply fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default AdminWebhookTester;