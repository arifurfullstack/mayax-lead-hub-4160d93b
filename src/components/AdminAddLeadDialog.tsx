import { useState, useMemo } from "react";
import { Plus, Brain, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { calculateAiScore, getGradePrice } from "@/lib/leadScoring";

const provinces = [
  "Ontario",
  "British Columbia",
  "Alberta",
  "Quebec",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "Newfoundland",
];

interface Props {
  onLeadAdded: () => void;
}

export default function AdminAddLeadDialog({ onLeadAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    city: "",
    province: "",
    buyer_type: "online",
    vehicle_preference: "",
    vehicle_price: "",
    vehicle_mileage: "",
    income: "",
    credit_range_min: "",
    credit_range_max: "",
    notes: "",
    appointment_time: "",
    trade_in: false,
  });

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const computed = useMemo(() => {
    const result = calculateAiScore({
      income: form.income ? Number(form.income) : null,
      vehicle_preference: form.vehicle_preference || null,
      buyer_type: form.buyer_type,
      notes: form.notes || null,
      appointment_time: form.appointment_time || null,
      trade_in: form.trade_in,
    });
    return { ...result, price: getGradePrice(result.quality_grade) };
  }, [form.income, form.vehicle_preference, form.buyer_type, form.notes, form.appointment_time, form.trade_in]);

  const generateRefCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "MX-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: "Missing fields", description: "First name and last name are required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      reference_code: generateRefCode(),
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      city: form.city || null,
      province: form.province || null,
      quality_grade: computed.quality_grade,
      price: computed.price,
      ai_score: computed.ai_score,
      buyer_type: form.buyer_type,
      vehicle_preference: form.vehicle_preference || null,
      vehicle_price: form.vehicle_price ? Number(form.vehicle_price) : null,
      vehicle_mileage: form.vehicle_mileage ? Number(form.vehicle_mileage) : null,
      income: form.income ? Number(form.income) : null,
      credit_range_min: form.credit_range_min ? Number(form.credit_range_min) : null,
      credit_range_max: form.credit_range_max ? Number(form.credit_range_max) : null,
      notes: form.notes || null,
      appointment_time: form.appointment_time || null,
      trade_in: form.trade_in,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error adding lead", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead added", description: "New lead created successfully." });
      setForm({
        first_name: "", last_name: "", email: "", phone: "", city: "", province: "",
        buyer_type: "online",
        vehicle_preference: "", vehicle_price: "", vehicle_mileage: "", income: "",
        credit_range_min: "", credit_range_max: "", notes: "", appointment_time: "",
        trade_in: false,
      });
      setOpen(false);
      onLeadAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 gradient-blue-cyan text-foreground">
          <Plus className="h-4 w-4" /> Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add New Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* AI Score & Price Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Brain className="h-5 w-5 text-primary shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground">Auto-calculated:</span>
              <Badge variant="secondary" className="font-mono text-xs">AI {computed.ai_score}</Badge>
              <Badge variant="outline" className="font-mono text-xs font-bold">{computed.quality_grade}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">${computed.price}</span>
            </div>
          </div>

          {/* Personal Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">First Name *</Label>
                <Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="bg-background border-border" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Province</Label>
                <Select value={form.province} onValueChange={(v) => update("province", v)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Income ($)</Label>
                <Input type="number" min={0} value={form.income} onChange={(e) => update("income", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Credit Min</Label>
                <Input type="number" min={300} max={900} value={form.credit_range_min} onChange={(e) => update("credit_range_min", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Credit Max</Label>
                <Input type="number" min={300} max={900} value={form.credit_range_max} onChange={(e) => update("credit_range_max", e.target.value)} className="bg-background border-border" />
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vehicle</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vehicle Preference</Label>
                <Input value={form.vehicle_preference} onChange={(e) => update("vehicle_preference", e.target.value)} placeholder="e.g. Honda Civic, SUV" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vehicle Price ($)</Label>
                <Input type="number" min={0} value={form.vehicle_price} onChange={(e) => update("vehicle_price", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vehicle Mileage (km)</Label>
                <Input type="number" min={0} value={form.vehicle_mileage} onChange={(e) => update("vehicle_mileage", e.target.value)} className="bg-background border-border" />
              </div>
            </div>
          </div>

          {/* Buyer Type, Trade-In & Appointment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buyer Type</Label>
              <Select value={form.buyer_type} onValueChange={(v) => update("buyer_type", v)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="trade">Trade-in</SelectItem>
                  <SelectItem value="refinance">Refinance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Appointment Time</Label>
              <Input type="datetime-local" value={form.appointment_time} onChange={(e) => update("appointment_time", e.target.value)} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trade-In</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={form.trade_in} onCheckedChange={(v) => update("trade_in", v)} />
                <span className="text-xs text-muted-foreground">{form.trade_in ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes (hidden from marketplace)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. bankruptcy mentioned, refinance request..."
              className="bg-background border-border min-h-[60px]"
            />
            <p className="text-[10px] text-muted-foreground/60">Mentioning trade, refinance, or bankruptcy here affects the AI score.</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gradient-blue-cyan text-foreground">
              {saving ? "Adding…" : "Add Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
