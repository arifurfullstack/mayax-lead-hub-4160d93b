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

        <div className="rounded-lg bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-foreground">Expected JSON payload:</p>
          <pre className="text-[11px] text-muted-foreground overflow-x-auto">
{`{
  "first_name": "John",        // required
  "last_name": "Doe",          // required
  "price": 25.00,              // required
  "email": "john@email.com",
  "phone": "+1-555-1234",
  "city": "Toronto",
  "province": "Ontario",
  "quality_grade": "A",
  "ai_score": 85,
  "appointment_time": "2025-01-15T14:00:00Z",
  "vehicle_preference": "SUV",
  "buyer_type": "online"
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
