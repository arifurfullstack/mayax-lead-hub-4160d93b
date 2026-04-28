import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FlaskConical, Copy, AlertTriangle, CheckCircle2, RefreshCw, Wand2, BookOpen, Info, ShieldAlert, ShieldCheck, FileJson, ChevronDown, UserCheck, UserX, Sparkles, Search } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

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
  { name: "trade_in_vehicle", type: "string", notes: 'Description of the customer\'s trade-in (year, make, model, km). Aliases auto-mapped: "trade_in vehicle" (with space), "tradein_vehicle".', example: '"2018 Honda Civic, 80,000 km"' },
  { name: "has_bankruptcy", type: "boolean", notes: 'Bankruptcy flag. Alias auto-mapped: "bankruptcy". Strings "yes"/"no"/"1"/"0" auto-coerced. Empty string → null (absent).', example: "false" },
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
    trade_in_vehicle: z.string().trim().max(200).optional().or(z.literal("")),
    has_bankruptcy: z.boolean().optional(),
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
    id: "single-aliases",
    label: "Single — Make.com aliases (bankruptcy, trade_in vehicle)",
    description:
      'Sends the wrong-but-common keys "bankruptcy" and "trade_in vehicle" (with a space). Verifies they auto-map to has_bankruptcy and trade_in_vehicle in the computed output.',
    group: "single",
    build: () =>
      stringify({
        first_name: "Mia",
        last_name: "Alvarez",
        email: "mia.alvarez@example.com",
        phone: "416 555 0144",
        city: "Mississauga",
        province: "Ontario",
        income: 4200,
        vehicle_preference: "2022 Honda CR-V",
        trade_in: "yes",
        // Intentional alias keys — server should remap them
        "trade_in vehicle": "2018 Toyota Corolla, 95,000 km",
        bankruptcy: "no",
        notes: "Make.com mapping with legacy key names.",
      } as Record<string, unknown>),
  },
  {
    id: "single-canonical-fields",
    label: "Single — canonical trade_in_vehicle + has_bankruptcy",
    description:
      "Uses the canonical keys directly. Confirms both fields appear populated in the computed result.",
    group: "single",
    build: () =>
      stringify({
        first_name: "Daniel",
        last_name: "Park",
        email: "daniel.park@example.com",
        phone: "647 555 0123",
        city: "Toronto",
        province: "Ontario",
        income: 6800,
        vehicle_preference: "2024 Tesla Model Y",
        trade_in: true,
        trade_in_vehicle: "2019 Mazda CX-5, 60,000 km",
        has_bankruptcy: false,
        notes: "Pre-approved at credit union.",
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
  recovered_rejection_ids?: string[];
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

// --- Client-side mirror of `recoverNamesFromPayload` from the edge function ---
// Keep in sync with supabase/functions/inbound-webhook/index.ts
function _titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[\s\-']+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
function _looksLikeName(s: string): boolean {
  return /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(s);
}
type NameRecoveryPreview = {
  leadIndex: number;
  originalFirst: string | null;
  originalLast: string | null;
  recoveredFirst: string | null;
  recoveredLast: string | null;
  source: "name_field" | "email" | "notes" | null;
  attempted: boolean;
  resolvedFirst: string | null;
  resolvedLast: string | null;
  wouldPass: boolean;
  suggestedFix: string | null;
};

function simulateNameRecovery(lead: any, autofillEnabled: boolean): NameRecoveryPreview {
  const originalFirst =
    typeof lead?.first_name === "string" && lead.first_name.trim() ? lead.first_name.trim() : null;
  const originalLast =
    typeof lead?.last_name === "string" && lead.last_name.trim() ? lead.last_name.trim() : null;

  let first: string | null = originalFirst;
  let last: string | null = originalLast;
  let source: NameRecoveryPreview["source"] = null;

  // Mirror server: try recovery if autofill ON OR a name-like field is provided
  const hasNameField = !!(lead?.name || lead?.full_name || lead?.customer_name);
  const attempted = autofillEnabled || hasNameField;

  if (attempted) {
    const combined =
      (typeof lead?.name === "string" && lead.name.trim()) ||
      (typeof lead?.full_name === "string" && lead.full_name.trim()) ||
      (typeof lead?.customer_name === "string" && lead.customer_name.trim()) ||
      "";
    if ((!first || !last) && combined) {
      const parts = combined.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        if (!first) first = _titleCase(parts[0]);
        if (!last) last = _titleCase(parts.slice(1).join(" "));
        source = "name_field";
      } else if (parts.length === 1 && !first) {
        first = _titleCase(parts[0]);
        source = "name_field";
      }
    }
    const email = typeof lead?.email === "string" ? lead.email.trim() : "";
    if ((!first || !last) && email.includes("@")) {
      const local = email.split("@")[0].replace(/\+.*$/, "");
      const parts = local.split(/[._\-]+/).filter(Boolean);
      if (parts.length >= 2 && _looksLikeName(parts[0]) && _looksLikeName(parts[1])) {
        if (!first) first = _titleCase(parts[0]);
        if (!last) last = _titleCase(parts[1]);
        source = source ?? "email";
      }
    }
    const notes = typeof lead?.notes === "string" ? lead.notes : "";
    if ((!first || !last) && notes) {
      const m = notes.match(
        /(?:name|customer|client|lead)\s*[:\-]\s*([A-Za-zÀ-ÿ'’\-]+)\s+([A-Za-zÀ-ÿ'’\-]+)/i,
      );
      if (m) {
        if (!first) first = _titleCase(m[1]);
        if (!last) last = _titleCase(m[2]);
        source = source ?? "notes";
      }
    }
  }

  const wouldPass = !!(first && last);
  let suggestedFix: string | null = null;
  if (!wouldPass) {
    const missing: string[] = [];
    if (!first) missing.push("first_name");
    if (!last) missing.push("last_name");
    suggestedFix =
      `Add ${missing.join(" and ")} to the JSON. ` +
      (autofillEnabled
        ? `Auto-fill is ON but couldn't recover from name/email/notes — try adding a "name":"John Doe" field, or use an email like "john.doe@example.com".`
        : `Auto-fill is OFF — turn it on in Webhook Settings to attempt recovery from email/notes/name fields.`);
  }

  return {
    leadIndex: 0,
    originalFirst,
    originalLast,
    recoveredFirst:
      attempted && first && first !== originalFirst ? first : null,
    recoveredLast:
      attempted && last && last !== originalLast ? last : null,
    source: attempted && (first !== originalFirst || last !== originalLast) ? source : null,
    attempted,
    resolvedFirst: first,
    resolvedLast: last,
    wouldPass,
    suggestedFix,
  };
}

const AdminWebhookTester = () => {
  const location = useLocation();
  // Allow other admin pages (e.g. Webhook Templates) to seed the editor by
  // navigating with `state: { payload: "<json>" }`.
  const initialPayload =
    (location.state as { payload?: string } | null)?.payload ?? SAMPLE_PAYLOAD;
  const [payload, setPayload] = useState(initialPayload);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  // Simulate the server-side `inbound_webhook_autofill_names` setting locally
  // so the user can preview both ON and OFF behaviour without changing platform settings.
  const [simulateAutofill, setSimulateAutofill] = useState(true);

  // --- Inspect Lead in DB (admin lookup by id or reference_code) ---
  const [lookupInput, setLookupInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupRow, setLookupRow] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());

  const inspectLead = async () => {
    const q = lookupInput.trim();
    if (!q) {
      toast.error("Enter a lead id (UUID) or reference_code (e.g. MX-2026-123)");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupRow(null);
    try {
      const query = supabase.from("leads").select("*").limit(1);
      const { data, error } = isUuid(q)
        ? await query.eq("id", q).maybeSingle()
        : await query.eq("reference_code", q).maybeSingle();
      if (error) throw error;
      if (!data) {
        setLookupError(`No lead found for ${isUuid(q) ? "id" : "reference_code"} "${q}".`);
        return;
      }
      setLookupRow(data as Record<string, unknown>);
    } catch (err: any) {
      setLookupError(err?.message ?? "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const copyLookupJson = async () => {
    if (!lookupRow) return;
    await navigator.clipboard.writeText(JSON.stringify(lookupRow, null, 2));
    toast.success("Lead JSON copied");
  };

  // --- RLS / permission diagnostic for the leads table ---
  type DiagResult = {
    authenticated: boolean;
    userId: string | null;
    email: string | null;
    isAdmin: boolean | null;
    rolesError: string | null;
    canSelect: boolean;
    rowCount: number | null;
    selectError: { message: string; code?: string; details?: string; hint?: string } | null;
    headCount: number | null;
    headError: { message: string; code?: string; details?: string; hint?: string } | null;
    checkedAt: string;
  };
  const [diagLoading, setDiagLoading] = useState(false);
  const [diag, setDiag] = useState<DiagResult | null>(null);

  const runLeadsDiagnostic = async () => {
    setDiagLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const userId = session?.user.id ?? null;
      const email = session?.user.email ?? null;

      let isAdmin: boolean | null = null;
      let rolesError: string | null = null;
      if (userId) {
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (rErr) rolesError = rErr.message;
        else isAdmin = !!roles?.some((r: any) => r.role === "admin");
      }

      const { data: rows, error: selErr } = await supabase
        .from("leads")
        .select("id, reference_code, has_bankruptcy, trade_in_vehicle")
        .limit(1);

      const { count: headCount, error: headErr } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      setDiag({
        authenticated: !!session,
        userId,
        email,
        isAdmin,
        rolesError,
        canSelect: !selErr,
        rowCount: rows?.length ?? 0,
        selectError: selErr
          ? { message: selErr.message, code: (selErr as any).code, details: (selErr as any).details, hint: (selErr as any).hint }
          : null,
        headCount: headCount ?? null,
        headError: headErr
          ? { message: headErr.message, code: (headErr as any).code, details: (headErr as any).details, hint: (headErr as any).hint }
          : null,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Diagnostic failed");
    } finally {
      setDiagLoading(false);
    }
  };

  const validation = useMemo(() => validatePayload(payload), [payload]);

  // Preview state — when set, the diff dialog is open showing before/after.
  type PendingFix =
    | { kind: "single"; issue: ValidationIssue; fix: FixSuggestion; nextPayload: string; appliedCount: number }
    | { kind: "all"; nextPayload: string; appliedCount: number; skippedCount: number };
  const [pendingFix, setPendingFix] = useState<PendingFix | null>(null);
  // "Changes only" toggle inside the preview dialog. Hides unchanged context lines
  // so reviewers can focus on additions/removals on large payloads.
  const [changesOnly, setChangesOnly] = useState(false);

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

  // --- JSON-aware diff ---
  // Strategy:
  //   1. Try to parse both sides as JSON. If both parse, walk the structures
  //      recursively and emit semantic change records keyed by JSON path
  //      (e.g. `[0].email`, `vehicle_preference`). Then re-render before/after
  //      pretty JSON line-by-line, marking only the lines whose path is part
  //      of a changed subtree as removed/added. This gives accurate nested
  //      highlighting even when sibling lines happen to share identical text.
  //   2. If either side fails to parse, fall back to a true line-level LCS
  //      diff (Myers-equivalent classic DP) so the dialog still renders
  //      something useful while the user is mid-edit.
  type DiffLine = { kind: "same" | "added" | "removed"; text: string };

  // Stable JSON serializer with path tracking. Returns lines paired with
  // the JSON path that produced them, so we can mark sub-trees red/green.
  type PathLine = { text: string; path: string };
  const serializeWithPaths = (value: unknown): PathLine[] => {
    const lines: PathLine[] = [];
    const indent = (n: number) => "  ".repeat(n);
    const walk = (v: unknown, depth: number, path: string, suffix: string) => {
      if (v === null || typeof v !== "object") {
        lines.push({ path, text: `${indent(depth)}${JSON.stringify(v)}${suffix}` });
        return;
      }
      if (Array.isArray(v)) {
        if (v.length === 0) {
          lines.push({ path, text: `${indent(depth)}[]${suffix}` });
          return;
        }
        lines.push({ path, text: `${indent(depth)}[` });
        v.forEach((item, i) => {
          const childPath = `${path}[${i}]`;
          const childSuffix = i < v.length - 1 ? "," : "";
          walk(item, depth + 1, childPath, childSuffix);
        });
        lines.push({ path, text: `${indent(depth)}]${suffix}` });
        return;
      }
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length === 0) {
        lines.push({ path, text: `${indent(depth)}{}${suffix}` });
        return;
      }
      lines.push({ path, text: `${indent(depth)}{` });
      entries.forEach(([k, val], i) => {
        const childPath = path ? `${path}.${k}` : k;
        const childSuffix = i < entries.length - 1 ? "," : "";
        if (val === null || typeof val !== "object") {
          lines.push({
            path: childPath,
            text: `${indent(depth + 1)}${JSON.stringify(k)}: ${JSON.stringify(val)}${childSuffix}`,
          });
        } else if (Array.isArray(val) && val.length === 0) {
          lines.push({ path: childPath, text: `${indent(depth + 1)}${JSON.stringify(k)}: []${childSuffix}` });
        } else if (!Array.isArray(val) && Object.keys(val as object).length === 0) {
          lines.push({ path: childPath, text: `${indent(depth + 1)}${JSON.stringify(k)}: {}${childSuffix}` });
        } else if (Array.isArray(val)) {
          lines.push({ path: childPath, text: `${indent(depth + 1)}${JSON.stringify(k)}: [` });
          val.forEach((item, j) => {
            const grandPath = `${childPath}[${j}]`;
            const grandSuffix = j < val.length - 1 ? "," : "";
            walk(item, depth + 2, grandPath, grandSuffix);
          });
          lines.push({ path: childPath, text: `${indent(depth + 1)}]${childSuffix}` });
        } else {
          const inner = Object.entries(val as Record<string, unknown>);
          lines.push({ path: childPath, text: `${indent(depth + 1)}${JSON.stringify(k)}: {` });
          inner.forEach(([ik, iv], j) => {
            const grandPath = `${childPath}.${ik}`;
            const grandSuffix = j < inner.length - 1 ? "," : "";
            walk(iv, depth + 2, grandPath, grandSuffix);
            // walk emits its own line; but for primitives walk uses the parent path,
            // so override the just-pushed line's path to the child path.
            const last = lines[lines.length - 1];
            if (last && (iv === null || typeof iv !== "object")) {
              last.path = grandPath;
              last.text = `${indent(depth + 2)}${JSON.stringify(ik)}: ${JSON.stringify(iv)}${grandSuffix}`;
            } else if (last) {
              // Object/array case: rewrite the opening line to include the key.
              // walk pushed a line like `{` or `[`. Replace with `"key": {` etc.
              // To keep things simple, we just adjust the first line of that subtree.
              // Find the start of this subtree by scanning back.
              // (Cheaper: re-call walk via the object branch above for the array case.
              //  For nested objects we re-walk inline.)
              // To avoid complexity, we re-emit the inner object via a recursive call:
              // remove what walk just pushed and recurse properly.
              // (Counts of pushed lines is unknown without bookkeeping; instead,
              // for nested objects/arrays we use a dedicated path below.)
            }
          });
          lines.push({ path: childPath, text: `${indent(depth + 1)}}${childSuffix}` });
        }
      });
      lines.push({ path, text: `${indent(depth)}}${suffix}` });
    };
    walk(value, 0, "", "");
    return lines;
  };

  // Collect every JSON path whose value differs between prev and next.
  // Returns the set of "changed roots" — paths that should be highlighted along
  // with all their descendants.
  const collectChangedPaths = (
    prev: unknown,
    next: unknown,
    path: string,
    out: Set<string>,
  ): boolean => {
    // Returns true if this subtree is unchanged.
    if (prev === next) return true;
    const prevType = prev === null ? "null" : Array.isArray(prev) ? "array" : typeof prev;
    const nextType = next === null ? "null" : Array.isArray(next) ? "array" : typeof next;
    if (prevType !== nextType) {
      out.add(path);
      return false;
    }
    if (prevType !== "object" && prevType !== "array") {
      if (prev !== next) {
        out.add(path);
        return false;
      }
      return true;
    }
    if (Array.isArray(prev) && Array.isArray(next)) {
      let unchanged = prev.length === next.length;
      const max = Math.max(prev.length, next.length);
      for (let i = 0; i < max; i++) {
        const childPath = `${path}[${i}]`;
        if (i >= prev.length || i >= next.length) {
          out.add(childPath);
          unchanged = false;
        } else {
          const childUnchanged = collectChangedPaths(prev[i], next[i], childPath, out);
          if (!childUnchanged) unchanged = false;
        }
      }
      return unchanged;
    }
    // object
    const a = prev as Record<string, unknown>;
    const b = next as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let unchanged = true;
    keys.forEach((k) => {
      const childPath = path ? `${path}.${k}` : k;
      if (!(k in a) || !(k in b)) {
        out.add(childPath);
        unchanged = false;
        return;
      }
      const childUnchanged = collectChangedPaths(a[k], b[k], childPath, out);
      if (!childUnchanged) unchanged = false;
    });
    return unchanged;
  };

  // Classic LCS line diff (DP table) — used as the fallback when JSON parsing fails.
  const lcsDiff = (
    prevLines: string[],
    nextLines: string[],
  ): { left: DiffLine[]; right: DiffLine[] } => {
    const m = prevLines.length;
    const n = nextLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (prevLines[i] === nextLines[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (prevLines[i] === nextLines[j]) {
        left.push({ kind: "same", text: prevLines[i] });
        right.push({ kind: "same", text: nextLines[j] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        left.push({ kind: "removed", text: prevLines[i] });
        right.push({ kind: "same", text: "" }); // padding to keep rows aligned
        i++;
      } else {
        left.push({ kind: "same", text: "" });
        right.push({ kind: "added", text: nextLines[j] });
        j++;
      }
    }
    while (i < m) {
      left.push({ kind: "removed", text: prevLines[i++] });
      right.push({ kind: "same", text: "" });
    }
    while (j < n) {
      left.push({ kind: "same", text: "" });
      right.push({ kind: "added", text: nextLines[j++] });
    }
    return { left, right };
  };

  const buildDiff = (prev: string, next: string): { left: DiffLine[]; right: DiffLine[] } => {
    let prevJson: unknown;
    let nextJson: unknown;
    try {
      prevJson = JSON.parse(prev);
      nextJson = JSON.parse(next);
    } catch {
      return lcsDiff(prev.split("\n"), next.split("\n"));
    }

    const changedRoots = new Set<string>();
    collectChangedPaths(prevJson, nextJson, "", changedRoots);

    // A line is "changed" if its path equals or is nested under any changed root.
    const isChangedPath = (path: string): boolean => {
      for (const root of changedRoots) {
        if (root === "") return true; // top-level type change
        if (path === root) return true;
        if (path.startsWith(root + ".") || path.startsWith(root + "[")) return true;
      }
      return false;
    };

    const prevLines = serializeWithPaths(prevJson);
    const nextLines = serializeWithPaths(nextJson);

    // Run an LCS over the rendered text to align matching lines. Then upgrade
    // any "same"-on-text line whose path is in a changed subtree to removed/added,
    // so identical-looking lines that semantically moved still get flagged.
    const aligned = lcsDiff(
      prevLines.map((p) => p.text),
      nextLines.map((p) => p.text),
    );
    let li = 0;
    let ri = 0;
    const left: DiffLine[] = aligned.left.map((row) => {
      if (row.text === "" && row.kind === "same") return row; // padding
      const path = prevLines[li]?.path ?? "";
      li++;
      if (row.kind === "same" && isChangedPath(path)) {
        return { kind: "removed", text: row.text };
      }
      return row;
    });
    const right: DiffLine[] = aligned.right.map((row) => {
      if (row.text === "" && row.kind === "same") return row; // padding
      const path = nextLines[ri]?.path ?? "";
      ri++;
      if (row.kind === "same" && isChangedPath(path)) {
        return { kind: "added", text: row.text };
      }
      return row;
    });
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

      {/* ── Inspect Lead in DB ─────────────────────────────────────────── */}
      {/* ── RLS Permission Diagnostic ───────────────────────────────────── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Leads Table — Permission Diagnostic
          </CardTitle>
          <CardDescription className="text-xs">
            Verifies whether the current admin session can read the <code>leads</code> table via Row-Level Security. Shows the exact Supabase error if the SELECT fails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runLeadsDiagnostic} disabled={diagLoading} size="sm">
            {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span className="ml-2">Run diagnostic</span>
          </Button>

          {diag && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-border/60 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Authenticated</div>
                  <Badge variant={diag.authenticated ? "secondary" : "destructive"} className="mt-1 text-[10px]">
                    {diag.authenticated ? "yes" : "no"}
                  </Badge>
                </div>
                <div className="rounded-md border border-border/60 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin role</div>
                  <Badge
                    variant={diag.isAdmin ? "secondary" : diag.isAdmin === false ? "destructive" : "outline"}
                    className="mt-1 text-[10px]"
                  >
                    {diag.isAdmin === null ? "unknown" : diag.isAdmin ? "yes" : "no"}
                  </Badge>
                </div>
                <div className="rounded-md border border-border/60 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">SELECT leads</div>
                  <Badge variant={diag.canSelect ? "secondary" : "destructive"} className="mt-1 text-[10px]">
                    {diag.canSelect ? "allowed" : "blocked"}
                  </Badge>
                </div>
                <div className="rounded-md border border-border/60 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Visible row count</div>
                  <div className="mt-1 font-mono text-sm">
                    {diag.headCount ?? (diag.canSelect ? diag.rowCount ?? 0 : "—")}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border/60 p-2 text-xs space-y-1">
                <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{diag.userId ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{diag.email ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Checked at:</span> <span className="font-mono">{diag.checkedAt}</span></div>
              </div>

              {diag.rolesError && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Cannot read user_roles</AlertTitle>
                  <AlertDescription className="font-mono text-xs whitespace-pre-wrap">{diag.rolesError}</AlertDescription>
                </Alert>
              )}

              {diag.selectError && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>SELECT on leads failed</AlertTitle>
                  <AlertDescription>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs">
{JSON.stringify(diag.selectError, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}

              {diag.headError && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>COUNT on leads failed</AlertTitle>
                  <AlertDescription>
                    <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs">
{JSON.stringify(diag.headError, null, 2)}
                    </pre>
                  </AlertDescription>
                </Alert>
              )}

              {diag.canSelect && !diag.selectError && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>RLS check passed</AlertTitle>
                  <AlertDescription className="text-xs">
                    Your session can read from <code>leads</code>. {diag.headCount !== null ? `${diag.headCount} row(s) visible.` : ""}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Inspect Lead in Database
          </CardTitle>
          <CardDescription className="text-xs">
            Look up a stored lead by <code>id</code> (UUID) or <code>reference_code</code> (e.g. <code>MX-2026-123</code>) to verify what was actually persisted — including <code>has_bankruptcy</code> and <code>trade_in_vehicle</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") inspectLead(); }}
              placeholder="Lead UUID or reference code (MX-YYYY-XXX)"
              className="font-mono text-xs"
            />
            <Button onClick={inspectLead} disabled={lookupLoading} size="sm">
              {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Fetch</span>
            </Button>
          </div>

          {lookupError && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{lookupError}</AlertDescription>
            </Alert>
          )}

          {lookupRow && (
            <div className="space-y-3">
              {/* Highlighted columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">reference_code</div>
                  <div className="text-sm font-mono mt-1 break-all">{String(lookupRow.reference_code ?? "—")}</div>
                </div>
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-primary/80">has_bankruptcy</div>
                  <div className="text-sm font-mono mt-1">
                    {lookupRow.has_bankruptcy === null || lookupRow.has_bankruptcy === undefined ? (
                      <span className="text-muted-foreground">null</span>
                    ) : (
                      <Badge variant={lookupRow.has_bankruptcy ? "destructive" : "secondary"} className="text-[10px]">
                        {String(lookupRow.has_bankruptcy)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-primary/80">trade_in_vehicle</div>
                  <div className="text-sm font-mono mt-1 break-words">
                    {lookupRow.trade_in_vehicle == null || lookupRow.trade_in_vehicle === ""
                      ? <span className="text-muted-foreground">null</span>
                      : String(lookupRow.trade_in_vehicle)}
                  </div>
                </div>
              </div>

              {/* Raw JSON */}
              <Collapsible defaultOpen>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" />
                    Raw row JSON
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="sm" onClick={copyLookupJson} className="h-7 px-2">
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-96 overflow-auto rounded border border-border/50 bg-muted/30 p-3 text-[11px] font-mono">
                    {JSON.stringify(lookupRow, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

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
            {(() => {
              // Name-recovery preview — local simulation, no network call.
              // Mirrors `recoverNamesFromPayload` in the edge function so admins
              // can see exactly which leads would pass / fail with or without
              // the `inbound_webhook_autofill_names` setting enabled.
              let parsed: unknown;
              try {
                parsed = JSON.parse(payload);
              } catch {
                return null;
              }
              if (parsed === null || typeof parsed !== "object") return null;
              const leads = Array.isArray(parsed) ? (parsed as any[]) : [parsed as any];
              const previews = leads.map((l, i) => ({
                ...simulateNameRecovery(l, simulateAutofill),
                leadIndex: i,
              }));
              const passed = previews.filter((p) => p.wouldPass).length;
              const recoveredCount = previews.filter((p) => p.source).length;
              return (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Name recovery preview
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Simulates the webhook's first/last-name auto-fill locally — no request sent.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1.5">
                      <Switch
                        id="sim-autofill"
                        checked={simulateAutofill}
                        onCheckedChange={setSimulateAutofill}
                      />
                      <Label htmlFor="sim-autofill" className="text-xs cursor-pointer">
                        Simulate auto-fill {simulateAutofill ? "ON" : "OFF"}
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                      {passed}/{previews.length} would pass
                    </Badge>
                    {recoveredCount > 0 && (
                      <Badge variant="outline" className="bg-blue-500/15 text-blue-300 border-blue-500/40">
                        {recoveredCount} recovered
                      </Badge>
                    )}
                    {passed < previews.length && (
                      <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">
                        {previews.length - passed} would reject
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {previews.map((p) => (
                      <div
                        key={p.leadIndex}
                        className={`rounded border px-3 py-2 text-xs ${
                          p.wouldPass
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-red-500/40 bg-red-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {p.wouldPass ? (
                              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <UserX className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span className="font-mono text-muted-foreground">
                              Lead #{p.leadIndex + 1}
                            </span>
                            {p.wouldPass ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px]"
                              >
                                Would accept
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-red-500/15 text-red-300 border-red-500/40 text-[10px]"
                              >
                                Would reject
                              </Badge>
                            )}
                            {p.source && (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/15 text-blue-300 border-blue-500/40 text-[10px]"
                              >
                                from {p.source}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                          <div>
                            <span className="text-muted-foreground">first: </span>
                            <span className={p.originalFirst ? "" : "text-muted-foreground italic"}>
                              {p.originalFirst ?? "(empty)"}
                            </span>
                            {p.recoveredFirst && (
                              <span className="text-emerald-300"> → {p.recoveredFirst}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">last: </span>
                            <span className={p.originalLast ? "" : "text-muted-foreground italic"}>
                              {p.originalLast ?? "(empty)"}
                            </span>
                            {p.recoveredLast && (
                              <span className="text-emerald-300"> → {p.recoveredLast}</span>
                            )}
                          </div>
                        </div>
                        {p.suggestedFix && (
                          <div className="mt-1.5 text-[11px] text-red-200/90 leading-relaxed">
                            <strong className="text-red-300">Suggested fix: </strong>
                            {p.suggestedFix}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
      <Dialog
        open={pendingFix !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingFix(null);
            setChangesOnly(false);
          }
        }}
      >
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

            // When "Changes only" is enabled, drop unchanged ("same") lines and insert
            // a single ellipsis row wherever a run of context was removed. The original
            // line number is preserved as a 1-based gutter so reviewers can correlate
            // back to the full payload.
            type RenderRow =
              | { type: "line"; kind: "same" | "added" | "removed"; text: string; lineNo: number }
              | { type: "gap"; skipped: number };
            const collapse = (lines: typeof left): RenderRow[] => {
              if (!changesOnly) {
                return lines.map((l, i) => ({
                  type: "line",
                  kind: l.kind,
                  text: l.text,
                  lineNo: i + 1,
                }));
              }
              const out: RenderRow[] = [];
              let pendingGap = 0;
              lines.forEach((l, i) => {
                if (l.kind === "same") {
                  pendingGap++;
                  return;
                }
                if (pendingGap > 0) {
                  out.push({ type: "gap", skipped: pendingGap });
                  pendingGap = 0;
                }
                out.push({ type: "line", kind: l.kind, text: l.text, lineNo: i + 1 });
              });
              if (pendingGap > 0) out.push({ type: "gap", skipped: pendingGap });
              return out;
            };
            const leftRows = collapse(left);
            const rightRows = collapse(right);
            const noChanges = removedCount === 0 && addedCount === 0;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">
                      − {removedCount} removed
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                      + {addedCount} added
                    </Badge>
                    {noChanges && (
                      <span className="italic">No textual change — fix may be a no-op.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="changes-only-toggle"
                      checked={changesOnly}
                      onCheckedChange={setChangesOnly}
                      disabled={noChanges}
                    />
                    <Label
                      htmlFor="changes-only-toggle"
                      className="text-xs text-muted-foreground cursor-pointer select-none"
                    >
                      Changes only
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Before
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto">
                      {leftRows.length === 0 && (
                        <div className="px-3 py-2 text-muted-foreground italic">
                          No removed lines.
                        </div>
                      )}
                      {leftRows.map((row, i) =>
                        row.type === "gap" ? (
                          <div
                            key={i}
                            className="px-3 text-[10px] text-muted-foreground/70 bg-muted/20 border-y border-border/40 select-none"
                          >
                            ⋯ {row.skipped} unchanged line{row.skipped === 1 ? "" : "s"} hidden
                          </div>
                        ) : (
                          <div
                            key={i}
                            className={
                              row.kind === "removed"
                                ? "flex bg-red-500/15 text-red-300"
                                : "flex text-muted-foreground"
                            }
                          >
                            <span className="w-10 text-right pr-2 select-none opacity-50 border-r border-border/30">
                              {row.lineNo}
                            </span>
                            <span className="inline-block w-4 text-center select-none opacity-70">
                              {row.kind === "removed" ? "−" : " "}
                            </span>
                            <span className="flex-1 pr-3">{row.text || "\u00A0"}</span>
                          </div>
                        ),
                      )}
                    </pre>
                  </div>
                  <div className="rounded-md border border-border/60 overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/40 border-b border-border/60 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      After
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed max-h-[60vh] overflow-auto">
                      {rightRows.length === 0 && (
                        <div className="px-3 py-2 text-muted-foreground italic">
                          No added lines.
                        </div>
                      )}
                      {rightRows.map((row, i) =>
                        row.type === "gap" ? (
                          <div
                            key={i}
                            className="px-3 text-[10px] text-muted-foreground/70 bg-muted/20 border-y border-border/40 select-none"
                          >
                            ⋯ {row.skipped} unchanged line{row.skipped === 1 ? "" : "s"} hidden
                          </div>
                        ) : (
                          <div
                            key={i}
                            className={
                              row.kind === "added"
                                ? "flex bg-emerald-500/15 text-emerald-300"
                                : "flex text-muted-foreground"
                            }
                          >
                            <span className="w-10 text-right pr-2 select-none opacity-50 border-r border-border/30">
                              {row.lineNo}
                            </span>
                            <span className="inline-block w-4 text-center select-none opacity-70">
                              {row.kind === "added" ? "+" : " "}
                            </span>
                            <span className="flex-1 pr-3">{row.text || "\u00A0"}</span>
                          </div>
                        ),
                      )}
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
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                if (!pendingFix) return;
                try {
                  await navigator.clipboard.writeText(pendingFix.nextPayload);
                  toast.success("After JSON copied to clipboard");
                } catch {
                  toast.error("Clipboard unavailable in this browser");
                }
              }}
              disabled={!pendingFix}
            >
              <Copy className="h-4 w-4" />
              Copy after JSON
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