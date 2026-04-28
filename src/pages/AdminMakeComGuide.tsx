import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Workflow, FlaskConical, AlertTriangle, CheckCircle2, BookOpen, ExternalLink, Filter, Settings2 } from "lucide-react";

// ----------------------------------------------------------------------------
// Make.com integration guide
// Mirrors the rejection error_types from the inbound-webhook function so the
// client can self-diagnose mapping problems end-to-end.
// ----------------------------------------------------------------------------

type Mapping = {
  jsonKey: string;
  required?: boolean;
  source: string;
  mistake: string;
};

const MAPPINGS: Mapping[] = [
  { jsonKey: "first_name", required: true, source: "Customer first name variable from your trigger / data prep step.", mistake: "Mapping the full name here, or sending status words like 'Planning', 'Pending', 'Unknown'." },
  { jsonKey: "last_name", required: true, source: "Customer last name variable.", mistake: "Leaving empty when the source only has a 'name' field — instead enable 'Auto-fill missing names' or send a combined 'name'." },
  { jsonKey: "email", source: "Customer email address.", mistake: "Sending the literal string 'None', 'unknown', or the dealer's email instead of the customer's." },
  { jsonKey: "phone", source: "Customer phone, any format (spaces/dashes/+1 OK).", mistake: "Sending only the area code or extension." },
  { jsonKey: "city", source: "Customer city — Toronto, Mississauga, etc.", mistake: "Mapping vehicle text here (e.g. 'Mercedes Benz', 'newer model'). This is the #1 cause of bad data." },
  { jsonKey: "province", source: "Province or state name/abbreviation.", mistake: "Sending postal code." },
  { jsonKey: "income", source: "Monthly income as a number (4500) or quoted string ('$4,500').", mistake: "Sending free text like 'Not working' or a year (2025). Send empty/null instead." },
  { jsonKey: "credit_range_min", source: "Lower bound of credit score.", mistake: "Sending 0 as a placeholder — leave the field out instead." },
  { jsonKey: "credit_range_max", source: "Upper bound of credit score.", mistake: "Same — never send 0." },
  { jsonKey: "vehicle_preference", source: "Year + Make + Model (e.g. '2024 Honda CR-V').", mistake: "Mapping a city or generic word like 'SUV' when more detail is available." },
  { jsonKey: "vehicle_mileage", source: "Number (km).", mistake: "Sending '45,000 km' as a string — the comma is OK, but strip the unit." },
  { jsonKey: "vehicle_price", source: "Number — asking price.", mistake: "Sending the monthly payment instead of total price." },
  { jsonKey: "trade_in", source: "Boolean — true / false.", mistake: "Sending 'yes'/'no' as strings (now auto-coerced) or leaving blank when there IS a trade." },
  { jsonKey: "trade_in_vehicle", source: "Description of the trade-in vehicle (e.g. '2018 Honda Civic, 80,000 km'). Only sent when trade_in is true.", mistake: "Using a key with a space ('trade_in vehicle') — auto-aliased but the canonical key is trade_in_vehicle." },
  { jsonKey: "has_bankruptcy", source: "Boolean — true / false.", mistake: "Using the key 'bankruptcy' (auto-aliased) or sending 'yes'/'no' as strings (also coerced)." },
  { jsonKey: "appointment_time", source: "ISO 8601 timestamp with timezone (2026-05-15T14:00:00-04:00).", mistake: "Sending an empty string '' or a free-text date like 'Saturday morning'." },
  { jsonKey: "notes", source: "Free text — transcript fragments, comments, etc.", mistake: "Putting transcript text into city/vehicle slots instead of here." },
  { jsonKey: "reference_code", source: "Optional — your CRM's lead ID. Auto-generated as MX-YYYY-XXX if omitted.", mistake: "Reusing the same code for different leads (causes false dedupe matches)." },
];

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/inbound-webhook`;

export default function AdminMakeComGuide() {
  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-gold" />
            Make.com integration guide
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Step-by-step setup for sending leads from Make.com into MayaX without losing
            data. Most "half data comes in, half doesn't" issues come from mapping the
            wrong source variable to the wrong JSON key — this guide fixes that.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/webhook-tester">
              <FlaskConical className="h-4 w-4" /> Open Tester
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/rejected-leads">
              <AlertTriangle className="h-4 w-4" /> Rejected Leads
            </Link>
          </Button>
        </div>
      </div>

      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertTitle className="text-sm">Endpoint</AlertTitle>
        <AlertDescription>
          <code className="text-xs font-mono break-all">POST {ENDPOINT}</code>
          <span className="block mt-1 text-[11px] text-muted-foreground">
            Add <code>?strict=1</code> to the URL while debugging — every shape issue
            (vehicle in city, invalid email, etc.) will be rejected with a clear error
            instead of stored with a warning.
          </span>
        </AlertDescription>
      </Alert>

      {/* Scenario layout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold" /> Required Make.com scenario layout
          </CardTitle>
          <CardDescription>The four modules you need, in this order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
              <div>
                <strong>Trigger</strong> — webhook, Typeform, Voiceflow, ChatGPT, etc.
                Whatever fires when a new lead is captured.
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
              <div>
                <strong>Data prep</strong> — text parser, ChatGPT block, or Tools modules
                that extract <code>first_name</code>, <code>last_name</code>, <code>email</code>,
                <code> phone</code>, etc. from the raw input. <span className="text-muted-foreground">Make sure each variable is filled before continuing.</span>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5 bg-warning/15 text-warning border-warning/40">3</Badge>
              <div>
                <strong>Filter</strong> <Filter className="inline h-3.5 w-3.5 text-warning ml-0.5" /> —
                <span className="text-warning"> the most commonly missing module.</span> Add a Filter
                between data-prep and the HTTP module. Condition:
                <pre className="mt-1.5 text-[11px] bg-muted/50 rounded p-2 font-mono">
{`first_name  Exists  AND  Not Empty
last_name   Exists  AND  Not Empty
( email Exists  OR  phone Exists )`}
                </pre>
                Without this filter, Make.com fires before your data is ready and you get
                empty payloads in the Rejected Leads tab.
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
              <div>
                <strong>HTTP &gt; Make a request</strong> — POST to the endpoint above.
                <ul className="text-[12px] text-muted-foreground mt-1.5 list-disc pl-4 space-y-0.5">
                  <li>Method: <code>POST</code></li>
                  <li>Body type: <strong>Raw</strong> → Content type: <strong>JSON (application/json)</strong></li>
                  <li className="text-warning">Do NOT use Form-data — it sends every field as a string and breaks numeric fields.</li>
                  <li>Parse response: <strong>Yes</strong> (so you can branch on errors).</li>
                </ul>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Mapping table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Field mapping reference</CardTitle>
          <CardDescription>
            Each MayaX JSON key, what it expects, and the most common Make.com mistake.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">JSON key</th>
                <th className="py-2 pr-3">What to map</th>
                <th className="py-2">Common mistake</th>
              </tr>
            </thead>
            <tbody>
              {MAPPINGS.map((m) => (
                <tr key={m.jsonKey} className="border-b border-border/30 align-top">
                  <td className="py-2 pr-3">
                    <code className="text-xs">{m.jsonKey}</code>
                    {m.required && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-destructive/40 text-destructive">required</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-foreground/90 text-[13px]">{m.source}</td>
                  <td className="py-2 text-muted-foreground text-[12px]">{m.mistake}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Test it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Test your scenario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground/90">
          <p>
            In Make.com, run your scenario once with a real lead. Then come to MayaX
            admin and check both:
          </p>
          <ul className="list-disc pl-5 text-[13px] space-y-1">
            <li>
              <Link to="/admin/rejected-leads" className="text-primary hover:underline">
                Rejected Leads <ExternalLink className="inline h-3 w-3" />
              </Link>{" "}
              — the 7-day heatmap shows which mapping is breaking most.
            </li>
            <li>
              <Link to="/admin/webhook-tester" className="text-primary hover:underline">
                Webhook Tester <ExternalLink className="inline h-3 w-3" />
              </Link>{" "}
              — paste the exact JSON Make.com would send and run a dry-run to see what
              would happen without writing to the database.
            </li>
          </ul>
          <p className="text-[12px] text-muted-foreground">
            Tip: while debugging, append <code>?strict=1</code> to the webhook URL in
            your Make.com HTTP module. Switch back to the plain URL once everything is
            green.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}