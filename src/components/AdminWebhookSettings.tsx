import { useState, useEffect } from "react";
import { Webhook, Clock, Calendar, Save, Copy, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SETTINGS_KEYS = [
  "lead_expiry_hours",
  "lead_expiry_enabled",
  "expiry_webhook_url",
  "appointment_webhook_url",
  "appointment_pre_send_minutes",
  "appointment_presend_enabled",
  "inbound_webhook_secret",
  "inbound_webhook_autofill_names",
  "inbound_webhook_retry_rejected",
  "inbound_webhook_reject_empty_payloads",
];

interface Props {
  settingsForm: Record<string, string>;
  setSettingsForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  platformSettings: Record<string, string>;
  onSave: () => Promise<void>;
  saving: boolean;
}

export default function AdminWebhookSettings({ settingsForm, setSettingsForm, platformSettings, onSave, saving }: Props) {
  const [copied, setCopied] = useState(false);

  const inboundUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`;

  const copyUrl = () => {
    navigator.clipboard.writeText(inboundUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Inbound webhook URL copied to clipboard." });
  };

  const update = (key: string, value: string) => {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Inbound Webhook */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Inbound Lead Webhook</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          External systems can POST lead data to this URL to automatically add leads into the marketplace.
        </p>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Webhook URL</Label>
          <div className="flex gap-2">
            <Input value={inboundUrl} readOnly className="bg-card border-border font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyUrl} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Webhook Secret (optional — sent as x-webhook-secret header)</Label>
          <Input
            value={settingsForm["inbound_webhook_secret"] ?? ""}
            onChange={(e) => update("inbound_webhook_secret", e.target.value)}
            placeholder="Leave blank to disable secret validation"
            className="bg-card border-border"
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Auto-fill missing names</Label>
            <p className="text-[11px] text-muted-foreground">
              When <span className="text-destructive">first_name</span> or <span className="text-destructive">last_name</span> is missing,
              try to recover them from <code>email</code> (e.g. <code>john.doe@…</code>) or <code>notes</code>.
              If recovery fails, the lead is rejected with a clearer suggested fix.
            </p>
          </div>
          <Switch
            checked={settingsForm["inbound_webhook_autofill_names"] === "true"}
            onCheckedChange={(v) => update("inbound_webhook_autofill_names", v ? "true" : "false")}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Retry rejected leads on resubmission</Label>
            <p className="text-[11px] text-muted-foreground">
              When an inbound lead matches a previously <span className="text-destructive">rejected</span> one
              (same email or phone), merge the new payload with the old one and re-attempt name recovery.
              If it now passes, the lead is created and the original rejection is marked <code>recovered</code>.
            </p>
          </div>
          <Switch
            checked={settingsForm["inbound_webhook_retry_rejected"] === "true"}
            onCheckedChange={(v) => update("inbound_webhook_retry_rejected", v ? "true" : "false")}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-foreground">Reject empty payloads</Label>
            <p className="text-[11px] text-muted-foreground">
              Block inbound pings where every meaningful field (name, email, city, income, vehicle…) is empty
              — even if <code>phone</code> is present. This is the most common Make.com failure mode: the HTTP module
              fires before the upstream data-prep step has finished filling its variables. Default <strong>ON</strong>.
            </p>
          </div>
          <Switch
            checked={(settingsForm["inbound_webhook_reject_empty_payloads"] ?? "true") !== "false"}
            onCheckedChange={(v) => update("inbound_webhook_reject_empty_payloads", v ? "true" : "false")}
          />
        </div>

        <div className="rounded-lg bg-muted/30 p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Expected JSON payload:</p>
            <p className="text-[10px] text-muted-foreground">
              <span className="text-destructive">first_name</span> and{" "}
              <span className="text-destructive">last_name</span> are required — all other fields are optional.
            </p>
          </div>
          <pre className="text-[11px] text-muted-foreground overflow-x-auto">
{`{
  "first_name": "Alex",
  "last_name": "Martin",
  "email": "alex.martin@example.com",
  "phone": "647 555 0142",
  "city": "Toronto",
  "province": "Ontario",
  "buyer_type": "online",
  "income": "$6,800",
  "credit_range_min": 720,
  "credit_range_max": 780,
  "vehicle_preference": "2024 Honda CR-V Hybrid",
  "vehicle_mileage": 12000,
  "vehicle_price": 38000,
  "trade_in": true,
  "appointment_time": "2026-05-15T14:00:00-04:00",
  "notes": "Wants to trade in 2018 Civic. Prefers weekend appointment.",
  "reference_code": "MX-2026-0001"
}`}
          </pre>
        </div>
      </div>

      {/* Expiry */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Unsold Lead Expiry</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{settingsForm["lead_expiry_enabled"] === "true" ? "Enabled" : "Disabled"}</span>
            <Switch
              checked={settingsForm["lead_expiry_enabled"] === "true"}
              onCheckedChange={(v) => update("lead_expiry_enabled", v ? "true" : "false")}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, leads that remain unsold for the configured time will be sent to the webhook below (if set) and removed from the system. When disabled, leads stay indefinitely.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Expiry Time (hours)</Label>
            <Input
              type="number"
              min="1"
              value={settingsForm["lead_expiry_hours"] ?? "24"}
              onChange={(e) => update("lead_expiry_hours", e.target.value)}
              placeholder="24"
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Expiry Webhook URL (your CRM)</Label>
            <Input
              value={settingsForm["expiry_webhook_url"] ?? ""}
              onChange={(e) => update("expiry_webhook_url", e.target.value)}
              placeholder="https://your-crm.com/webhook/expired-leads"
              className="bg-card border-border"
            />
          </div>
        </div>
      </div>

      {/* Appointment */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan" />
            <h2 className="text-sm font-semibold text-foreground">Appointment Pre-Send</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{settingsForm["appointment_presend_enabled"] === "true" ? "Enabled" : "Disabled"}</span>
            <Switch
              checked={settingsForm["appointment_presend_enabled"] === "true"}
              onCheckedChange={(v) => update("appointment_presend_enabled", v ? "true" : "false")}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, leads with a phone appointment that are still available will be sent to the webhook below (if set) X minutes before the appointment, then removed. When disabled, appointment leads stay in the system.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Minutes Before Appointment</Label>
            <Input
              type="number"
              min="1"
              value={settingsForm["appointment_pre_send_minutes"] ?? "20"}
              onChange={(e) => update("appointment_pre_send_minutes", e.target.value)}
              placeholder="20"
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Appointment Webhook URL (your CRM)</Label>
            <Input
              value={settingsForm["appointment_webhook_url"] ?? ""}
              onChange={(e) => update("appointment_webhook_url", e.target.value)}
              placeholder="https://your-crm.com/webhook/appointments"
              className="bg-card border-border"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Webhook Settings"}
        </Button>
      </div>
    </div>
  );
}
