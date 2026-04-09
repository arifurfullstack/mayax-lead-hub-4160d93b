import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PromoCode {
  id: string;
  code: string;
  flat_price: number;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  created_at: string;
}

const AdminPromoCodeManager = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    discount_type: "flat",
    flat_price: "",
    discount_value: "",
    max_uses: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setPromoCodes((data as PromoCode[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ code: "", discount_type: "flat", flat_price: "", discount_value: "", max_uses: "", expires_at: "" });
    setShowForm(true);
  };

  const openEdit = (pc: PromoCode) => {
    setEditingId(pc.id);
    setForm({
      code: pc.code,
      discount_type: pc.discount_type || "flat",
      flat_price: String(pc.flat_price),
      discount_value: String(pc.discount_value || 0),
      max_uses: pc.max_uses != null ? String(pc.max_uses) : "",
      expires_at: pc.expires_at ? pc.expires_at.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: "Error", description: "Code is required.", variant: "destructive" });
      return;
    }
    if (form.discount_type === "flat" && !form.flat_price) {
      toast({ title: "Error", description: "Flat price is required.", variant: "destructive" });
      return;
    }
    if (form.discount_type === "percentage" && (!form.discount_value || Number(form.discount_value) <= 0 || Number(form.discount_value) > 100)) {
      toast({ title: "Error", description: "Percentage must be between 1 and 100.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      flat_price: form.discount_type === "flat" ? Number(form.flat_price) : 0,
      discount_value: form.discount_type === "percentage" ? Number(form.discount_value) : 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    if (editingId) {
      const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Updated", description: "Promo code updated." });
    } else {
      const { error } = await supabase.from("promo_codes").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Created", description: "Promo code created." });
    }
    setSaving(false);
    setShowForm(false);
    fetchCodes();
  };

  const toggleActive = async (pc: PromoCode) => {
    await supabase.from("promo_codes").update({ is_active: !pc.is_active }).eq("id", pc.id);
    setPromoCodes((prev) => prev.map((p) => p.id === pc.id ? { ...p, is_active: !p.is_active } : p));
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted", description: "Promo code removed." });
      setPromoCodes((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const formatDiscount = (pc: PromoCode) => {
    if (pc.discount_type === "percentage") return `${pc.discount_value}% off`;
    return `$${Number(pc.flat_price).toFixed(2)}`;
  };

  if (loading) return <div className="text-muted-foreground text-sm p-4">Loading promo codes...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" /> Promo Codes
        </h3>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Promo Code
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Code</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Type</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Discount</th>
              <th className="text-center p-3 text-xs text-muted-foreground font-medium">Uses</th>
              <th className="text-center p-3 text-xs text-muted-foreground font-medium">Active</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Expires</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {promoCodes.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No promo codes yet.</td></tr>
            )}
            {promoCodes.map((pc) => (
              <tr key={pc.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 font-mono-timer font-bold text-foreground">{pc.code}</td>
                <td className="p-3">
                  <Badge variant="outline" className="text-xs capitalize">
                    {pc.discount_type || "flat"}
                  </Badge>
                </td>
                <td className="p-3 text-right font-mono-timer text-foreground">{formatDiscount(pc)}</td>
                <td className="p-3 text-center text-muted-foreground">
                  {pc.times_used}{pc.max_uses != null ? `/${pc.max_uses}` : ""}
                </td>
                <td className="p-3 text-center">
                  <Switch checked={pc.is_active} onCheckedChange={() => toggleActive(pc)} />
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {pc.expires_at ? new Date(pc.expires_at).toLocaleDateString() : "Never"}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCode(pc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="glass border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SUMMER25" className="uppercase" />
            </div>
            <div>
              <Label>Discount Type</Label>
              <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Price</SelectItem>
                  <SelectItem value="percentage">Percentage Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discount_type === "flat" ? (
              <div>
                <Label>Flat Price ($)</Label>
                <Input type="number" value={form.flat_price} onChange={(e) => setForm({ ...form, flat_price: e.target.value })} placeholder="e.g. 30.00" />
                <p className="text-xs text-muted-foreground mt-1">Dealers with this code pay this fixed amount for any lead.</p>
              </div>
            ) : (
              <div>
                <Label>Percentage Off (%)</Label>
                <Input type="number" min="1" max="100" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="e.g. 10" />
                <p className="text-xs text-muted-foreground mt-1">Discount applied to the lead's current price (e.g. 10 = 10% off).</p>
              </div>
            )}
            <div>
              <Label>Max Uses (optional)</Label>
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" />
            </div>
            <div>
              <Label>Expires At (optional)</Label>
              <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPromoCodeManager;
