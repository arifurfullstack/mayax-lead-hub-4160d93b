import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const grades = ["A+", "A", "B", "C"];

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
    quality_grade: "B",
    price: "",
    ai_score: "",
    buyer_type: "online",
    vehicle_preference: "",
    vehicle_price: "",
    vehicle_mileage: "",
    income: "",
    credit_range_min: "",
    credit_range_max: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const generateRefCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "MX-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.price) {
      toast({ title: "Missing fields", description: "First name, last name, and price are required.", variant: "destructive" });
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
      quality_grade: form.quality_grade,
      price: Number(form.price),
      ai_score: form.ai_score ? Number(form.ai_score) : 0,
      buyer_type: form.buyer_type,
      vehicle_preference: form.vehicle_preference || null,
      vehicle_price: form.vehicle_price ? Number(form.vehicle_price) : null,
      vehicle_mileage: form.vehicle_mileage ? Number(form.vehicle_mileage) : null,
      income: form.income ? Number(form.income) : null,
      credit_range_min: form.credit_range_min ? Number(form.credit_range_min) : null,
      credit_range_max: form.credit_range_max ? Number(form.credit_range_max) : null,
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error adding lead", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead added", description: "New lead created successfully." });
      setForm({
        first_name: "", last_name: "", email: "", phone: "", city: "", province: "",
        quality_grade: "B", price: "", ai_score: "", buyer_type: "online",
        vehicle_preference: "", vehicle_price: "", vehicle_mileage: "", income: "",
        credit_range_min: "", credit_range_max: "",
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

          {/* Lead Quality & Pricing */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quality & Pricing</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quality Grade</Label>
                <Select value={form.quality_grade} onValueChange={(v) => update("quality_grade", v)}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">AI Score (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.ai_score} onChange={(e) => update("ai_score", e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Price ($) *</Label>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} className="bg-background border-border" />
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
                <Input value={form.vehicle_preference} onChange={(e) => update("vehicle_preference", e.target.value)} placeholder="e.g. SUV, Sedan" className="bg-background border-border" />
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

          {/* Buyer Type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buyer Type</Label>
            <Select value={form.buyer_type} onValueChange={(v) => update("buyer_type", v)}>
              <SelectTrigger className="bg-background border-border w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="walk-in">Walk-in</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
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
