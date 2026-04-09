import { useState, useEffect, useMemo } from "react";
import { Save, DollarSign, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_PRICING, type PricingSettings } from "@/lib/leadScoring";

interface Props {
  platformSettings: Record<string, string>;
  onSaved: () => void;
}

const FIELDS: { key: keyof PricingSettings; label: string; description: string }[] = [
  { key: "lead_price_base", label: "Base Price", description: "Every lead starts at this price (Name + Email + Phone)" },
  { key: "lead_price_income_tier1", label: "Income Tier 1 ($1,800–$4,999)", description: "Added when income is $1,800–$4,999" },
  { key: "lead_price_income_tier2", label: "Income Tier 2 ($5,000+)", description: "Additional add-on when income is $5,000+ (stacks with Tier 1)" },
  { key: "lead_price_vehicle", label: "Vehicle Info", description: "Added when any vehicle preference is present" },
  { key: "lead_price_trade", label: "Trade-In", description: "Added when trade-in is detected in notes or flagged" },
  { key: "lead_price_bankruptcy", label: "Bankruptcy", description: "Added when bankruptcy is detected in notes" },
  { key: "lead_price_appointment", label: "Phone Appointment", description: "Added when an appointment/call request is present" },
];

export default function AdminLeadPricingSettings({ platformSettings, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) {
      initial[f.key] = platformSettings[f.key] ?? String(DEFAULT_PRICING[f.key]);
    }
    setForm(initial);
  }, [platformSettings]);

  const maxPrice = useMemo(() => {
    return FIELDS.reduce((sum, f) => sum + (Number(form[f.key]) || 0), 0);
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    for (const f of FIELDS) {
      const value = form[f.key] ?? String(DEFAULT_PRICING[f.key]);
      if (platformSettings[f.key] !== undefined) {
        await supabase.from("platform_settings").update({ value }).eq("key", f.key);
      } else {
        await supabase.from("platform_settings").insert({ key: f.key, value });
      }
    }
    setSaving(false);
    toast({ title: "Saved", description: "Lead pricing settings updated." });
    onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Lead Pricing Configuration</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure the additive pricing model. Each lead starts at the base price and gains add-ons based on the data it contains.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, description }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="bg-background border-border pl-7"
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60">{description}</p>
            </div>
          ))}
        </div>

        {/* Sample breakdown */}
        <div className="rounded-lg bg-muted/30 border border-border/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Price Range Preview</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="font-mono text-xs">
              Min: ${Number(form.lead_price_base) || DEFAULT_PRICING.lead_price_base}
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs font-bold">
              Max: ${maxPrice}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Min = base price only (name + email + phone). Max = all add-ons applied.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Pricing"}
        </Button>
      </div>
    </div>
  );
}
