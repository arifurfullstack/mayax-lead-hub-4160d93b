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

interface PromoCode {
  id: string;
  code: string;
  flat_price: number;
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
  const [form, setForm] = useState({ code: "", flat_price: "", max_uses: "", expires_at: "" });
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
    setForm({ code: "", flat_price: "", max_uses: "", expires_at: "" });
    setShowForm(true);
  };

  const openEdit = (pc: PromoCode) => {
    setEditingId(pc.id);
    setForm({
      code: pc.code,
      flat_price: String(pc.flat_price),
      max_uses: pc.max_uses != null ? String(pc.max_uses) : "",
      expires_at: pc.expires_at ? pc.expires_at.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.flat_price) {
      toast({ title: "Error", description: "Code and flat price are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      flat_price: Number(form.flat_price),
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
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Flat Price</th>
              <th className="text-center p-3 text-xs text-muted-foreground font-medium">Uses</th>
              <th className="text-center p-3 text-xs text-muted-foreground font-medium">Active</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Expires</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {promoCodes.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No promo codes yet.</td></tr>
            )}
            {promoCodes.map((pc) => (
              <tr key={pc.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 font-mono-timer font-bold text-foreground">{pc.code}</td>
                <td className="p-3 text-right font-mono-timer text-foreground">${Number(pc.flat_price).toFixed(2)}</td>
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
              <Label>Flat Price ($)</Label>
              <Input type="number" value={form.flat_price} onChange={(e) => setForm({ ...form, flat_price: e.target.value })} placeholder="e.g. 5.00" />
              <p className="text-xs text-muted-foreground mt-1">Dealers with this code will pay this amount for any lead.</p>
            </div>
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
