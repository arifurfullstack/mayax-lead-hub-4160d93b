import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, FileJson, FlaskConical, ExternalLink, Search, BookOpen, Info } from "lucide-react";
import { toast } from "sonner";

// ----------------------------------------------------------------------------
// Dealer integration payload templates
// ----------------------------------------------------------------------------
// Each template documents how a common dealer/CRM/lead-source integration
// should map its fields onto the MayaX inbound webhook contract.
// All examples are accepted by /functions/v1/inbound-webhook as-is.
// ----------------------------------------------------------------------------

type TemplateCategory = "crm" | "marketplace" | "website" | "ads" | "generic";

type DealerTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  vendor: string;
  description: string;
  notes: string[];
  payload: unknown;
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  generic: "Generic",
  crm: "Dealer CRM",
  marketplace: "Marketplace",
  website: "Dealer website",
  ads: "Ads / forms",
};

const TEMPLATES: DealerTemplate[] = [
  // ---------------- Generic ----------------
  {
    id: "generic-minimal",
    name: "Minimal required",
    category: "generic",
    vendor: "Any source",
    description: "Smallest payload accepted: first_name + last_name only.",
    notes: [
      "Use when you cannot guarantee any contact info.",
      "Lead will score low — add email/phone/income whenever possible.",
    ],
    payload: {
      first_name: "Test",
      last_name: "Lead",
    },
  },
  {
    id: "generic-full",
    name: "Full single lead",
    category: "generic",
    vendor: "Any source",
    description: "Every supported field populated. Reference shape for new integrations.",
    notes: [
      "Numeric fields accept plain numbers or comma-grouped strings ($5,000).",
      "appointment_time must be ISO 8601 with timezone.",
    ],
    payload: {
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
      appointment_time: "2026-05-15T14:00:00-04:00",
      notes: "Wants to trade in 2018 Civic. Prefers weekend appointment.",
      reference_code: "MX-2026-0001",
    },
  },
  {
    id: "generic-batch",
    name: "Batch upload",
    category: "generic",
    vendor: "Any source",
    description: "Send multiple leads in a single POST as a JSON array.",
    notes: [
      "Each element is validated independently.",
      "Response returns per-lead success/failure.",
    ],
    payload: [
      {
        first_name: "Olivia",
        last_name: "Tremblay",
        email: "olivia.t@example.com",
        phone: "514 555 0123",
        city: "Montreal",
        province: "Quebec",
        income: "$7,500",
        vehicle_preference: "2024 Tesla Model Y",
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
      },
    ],
  },

  // ---------------- Dealer CRMs ----------------
  {
    id: "dealersocket",
    name: "DealerSocket-style export",
    category: "crm",
    vendor: "DealerSocket",
    description: "Map DealerSocket lead fields (CustomerFirstName, etc.) to MayaX names.",
    notes: [
      "DealerSocket exports CustomerFirstName/CustomerLastName — rename them.",
      "Combine VehicleYear + VehicleMake + VehicleModel into vehicle_preference.",
    ],
    payload: {
      first_name: "Jamie",
      last_name: "Nguyen",
      email: "jamie.nguyen@example.com",
      phone: "905-555-0144",
      city: "Markham",
      province: "Ontario",
      buyer_type: "online",
      income: 5400,
      credit_range_min: 660,
      credit_range_max: 700,
      vehicle_preference: "2024 Toyota RAV4 XLE",
      trade_in: true,
      notes: "DealerSocket lead ID 88231. Trade: 2019 Corolla.",
      reference_code: "DS-88231",
    },
  },
  {
    id: "vinsolutions",
    name: "VinSolutions CRM",
    category: "crm",
    vendor: "VinSolutions",
    description: "ADF-style lead converted to MayaX JSON contract.",
    notes: [
      "VinSolutions sends ADF/XML — convert to JSON before posting.",
      "Map <contact><name part='first'> → first_name etc.",
    ],
    payload: {
      first_name: "Daniel",
      last_name: "Park",
      email: "daniel.park@example.com",
      phone: "+1 416 555 0190",
      city: "Toronto",
      province: "Ontario",
      vehicle_preference: "2023 Audi Q5 Premium",
      vehicle_price: 52000,
      notes: "Source: VinSolutions website form. Asked about lease options.",
      reference_code: "VIN-2026-4471",
    },
  },
  {
    id: "elead",
    name: "Elead CRM",
    category: "crm",
    vendor: "Elead / CDK",
    description: "Elead sales lead with appointment request.",
    notes: [
      "Elead's preferred_contact_time → notes.",
      "Set appointment_time when sales rep has confirmed.",
    ],
    payload: {
      first_name: "Priya",
      last_name: "Sharma",
      email: "priya.sharma@example.com",
      phone: "905 555 0188",
      city: "Mississauga",
      province: "Ontario",
      income: 5200,
      vehicle_preference: "2023 Toyota RAV4 Hybrid",
      appointment_time: "2026-05-02T10:30:00-04:00",
      notes: "Confirmed phone appointment for Saturday morning. Source: Elead.",
      reference_code: "ELEAD-77321",
    },
  },

  // ---------------- Marketplaces ----------------
  {
    id: "autotrader",
    name: "AutoTrader.ca lead",
    category: "marketplace",
    vendor: "AutoTrader",
    description: "Inquiry from a vehicle listing page.",
    notes: [
      "AutoTrader provides Year/Make/Model + listing price.",
      "Use ListingId as reference_code for traceability.",
    ],
    payload: {
      first_name: "Sara",
      last_name: "Lopez",
      email: "sara.lopez@example.com",
      phone: "780 555 0145",
      city: "Edmonton",
      province: "Alberta",
      vehicle_preference: "2022 Ford F-150 Lariat",
      vehicle_mileage: 38000,
      vehicle_price: 56900,
      notes: "Inquired via AutoTrader listing. Asking about financing.",
      reference_code: "AT-LIST-993421",
    },
  },
  {
    id: "cargurus",
    name: "CarGurus lead",
    category: "marketplace",
    vendor: "CarGurus",
    description: "Email lead forwarded from CarGurus marketplace.",
    notes: [
      "CarGurus may not include phone — email-only is fine.",
      "Add buyer_type='online' explicitly if not provided.",
    ],
    payload: {
      first_name: "Marcus",
      last_name: "Bell",
      email: "marcus.bell@example.com",
      city: "Vancouver",
      province: "British Columbia",
      buyer_type: "online",
      vehicle_preference: "2021 Honda Civic Sport",
      vehicle_price: 24500,
      notes: "CarGurus inquiry — wants out-the-door price.",
      reference_code: "CG-2026-55812",
    },
  },
  {
    id: "kijiji",
    name: "Kijiji Autos message",
    category: "marketplace",
    vendor: "Kijiji Autos",
    description: "Buyer message from Kijiji listing.",
    notes: [
      "Phone often missing — keep email mandatory.",
      "Include the listing URL or ID in notes for context.",
    ],
    payload: {
      first_name: "Olivia",
      last_name: "Tremblay",
      email: "olivia.t@example.com",
      city: "Montreal",
      province: "Quebec",
      vehicle_preference: "2020 Mazda CX-5 GT",
      notes: "Kijiji listing #4471188. Asked if still available.",
      reference_code: "KJ-4471188",
    },
  },

  // ---------------- Dealer websites ----------------
  {
    id: "website-finance",
    name: "Dealer site finance form",
    category: "website",
    vendor: "Dealer website",
    description: "Pre-approval / financing form on the dealer's own website.",
    notes: [
      "Income + credit range are critical for grading.",
      "trade_in boolean unlocks trade-in pricing modifier.",
    ],
    payload: {
      first_name: "Jordan",
      last_name: "Reid",
      email: "jordan.reid@example.com",
      phone: "416 555 0199",
      city: "Toronto",
      province: "Ontario",
      income: "$4,200",
      credit_range_min: 580,
      credit_range_max: 640,
      vehicle_preference: "Used SUV under $25k",
      trade_in: true,
      notes: "Discharged bankruptcy 18 months ago, looking to rebuild credit.",
      reference_code: "WEB-FIN-2026-219",
    },
  },
  {
    id: "website-bookservice",
    name: "Dealer site appointment",
    category: "website",
    vendor: "Dealer website",
    description: "Test-drive booking widget submission.",
    notes: [
      "appointment_time should be in the future.",
      "Server auto-flags 'appointment' from notes if missing.",
    ],
    payload: {
      first_name: "Hannah",
      last_name: "Cole",
      email: "hannah.cole@example.com",
      phone: "613 555 0166",
      city: "Ottawa",
      province: "Ontario",
      vehicle_preference: "2024 Subaru Outback Touring",
      appointment_time: "2026-05-08T15:00:00-04:00",
      notes: "Test-drive booked through dealer website widget.",
      reference_code: "WEB-APPT-66331",
    },
  },

  // ---------------- Ads / lead forms ----------------
  {
    id: "facebook-leadads",
    name: "Facebook / Meta Lead Ads",
    category: "ads",
    vendor: "Meta Lead Ads",
    description: "Lead generated via Facebook Lead Ads form fields.",
    notes: [
      "Meta sends 'full_name' — split into first_name/last_name before posting (or enable name auto-fill in webhook settings).",
      "Add ad campaign id to notes for attribution.",
    ],
    payload: {
      first_name: "Aaron",
      last_name: "Singh",
      email: "aaron.singh@example.com",
      phone: "+14165550101",
      city: "Brampton",
      province: "Ontario",
      vehicle_preference: "2024 Hyundai Tucson",
      notes: "Source: Meta Lead Ads, campaign 'Spring SUV 2026'.",
      reference_code: "META-LA-90021",
    },
  },
  {
    id: "google-lsa",
    name: "Google Lead Form",
    category: "ads",
    vendor: "Google Ads",
    description: "Google Lead Form Extension submission.",
    notes: [
      "Google Ads delivers user_column_data — flatten before sending.",
      "Phone may arrive as E.164 — accepted as-is.",
    ],
    payload: {
      first_name: "Emily",
      last_name: "Chen",
      email: "emily.chen@example.com",
      phone: "+14165550112",
      city: "Toronto",
      province: "Ontario",
      vehicle_preference: "2024 Kia Sportage Hybrid",
      notes: "Source: Google Lead Form. Campaign: 'Hybrid SUV 2026'.",
      reference_code: "GADS-LF-7720",
    },
  },
  {
    id: "tiktok-lead",
    name: "TikTok Lead Generation",
    category: "ads",
    vendor: "TikTok Ads",
    description: "Instant Form lead from TikTok Ads.",
    notes: [
      "TikTok provides 'full_name' — pre-split before posting.",
      "Often missing income — score will rely on vehicle + city.",
    ],
    payload: {
      first_name: "Tyler",
      last_name: "Brooks",
      email: "tyler.brooks@example.com",
      phone: "905 555 0123",
      city: "Hamilton",
      province: "Ontario",
      vehicle_preference: "2023 Kia Forte",
      notes: "Source: TikTok Lead Gen, creative #4421.",
      reference_code: "TT-LG-4421",
    },
  },
];

// ----------------------------------------------------------------------------

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/inbound-webhook`;

const stringify = (obj: unknown) => JSON.stringify(obj, null, 2);

export default function AdminWebhookTemplates() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TemplateCategory | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (activeTab !== "all" && t.category !== activeTab) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.vendor.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [search, activeTab]);

  const copy = async (id: string, payload: unknown) => {
    try {
      await navigator.clipboard.writeText(stringify(payload));
      setCopiedId(id);
      toast.success("Payload copied to clipboard");
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(ENDPOINT);
      toast.success("Endpoint URL copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-gold" />
            Webhook payload templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Copy-paste JSON examples for the most common dealer CRMs, marketplaces,
            and ad platforms. Each template is a valid body for the inbound
            webhook — drop it straight into your integration or test it in the
            tester.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/webhook-tester">
              <FlaskConical className="h-4 w-4" />
              Open Tester
            </Link>
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">Endpoint</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <code className="text-xs font-mono break-all">POST {ENDPOINT}</code>
          <Button size="sm" variant="ghost" className="gap-1.5 h-7" onClick={copyEndpoint}>
            <Copy className="h-3.5 w-3.5" />
            Copy URL
          </Button>
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full md:w-auto">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({TEMPLATES.length})</TabsTrigger>
            {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((c) => {
              const count = TEMPLATES.filter((t) => t.category === c).length;
              return (
                <TabsTrigger key={c} value={c}>
                  {CATEGORY_LABELS[c]} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
          {/* Tab content rendered below the grid — Tabs is used for controlled state */}
          <TabsContent value={activeTab} />
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or template…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No templates match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((t) => {
            const json = stringify(t.payload);
            const isCopied = copiedId === t.id;
            return (
              <Card key={t.id} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-gold shrink-0" />
                        {t.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t.description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
                      {CATEGORY_LABELS[t.category]}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Source: <span className="font-medium text-foreground">{t.vendor}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  {t.notes.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                      {t.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                  <pre className="text-[11px] bg-muted/50 rounded-md p-3 overflow-x-auto max-h-72 font-mono leading-relaxed">
                    {json}
                  </pre>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5"
                      onClick={() => copy(t.id, t.payload)}
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {isCopied ? "Copied" : "Copy JSON"}
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link
                        to="/admin/webhook-tester"
                        state={{ payload: json }}
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        Open in Tester
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}