import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PlanFeature {
  id?: string;
  feature_text: string;
  sort_order: number;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  leads_per_month: number;
  delay_hours: number;
  glow_color: string;
  accent_color: string;
  is_popular: boolean;
  sort_order: number;
  is_active: boolean;
  plan_features: PlanFeature[];
}

const defaultForm = {
  name: "",
  price: 0,
  leads_per_month: 100,
  delay_hours: 24,
  glow_color: "0, 210, 210",
  accent_color: "#00d2d2",
  is_popular: false,
  sort_order: 0,
};

const COLOR_PRESETS = [
  { label: "Cyan", glow: "0, 210, 210", accent: "#00d2d2" },
  { label: "Purple", glow: "120, 80, 255", accent: "#a78bfa" },
  { label: "Blue", glow: "0, 180, 255", accent: "#38bdf8" },
  { label: "Gold", glow: "234, 179, 8", accent: "#fbbf24" },
  { label: "Green", glow: "34, 197, 94", accent: "#22c55e" },
  { label: "Red", glow: "239, 68, 68", accent: "#ef4444" },
];

const AdminPlanManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*, plan_features(*)")
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as Plan[]).map((p) => ({
        ...p,
        plan_features: (p.plan_features ?? []).sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });

  const openAdd = () => {
    setEditingPlan(null);
    setForm({ ...defaultForm, sort_order: (plans?.length ?? 0) + 1 });
    setFeatures([]);
    setNewFeature("");
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      leads_per_month: plan.leads_per_month,
      delay_hours: plan.delay_hours,
      glow_color: plan.glow_color,
      accent_color: plan.accent_color,
      is_popular: plan.is_popular,
      sort_order: plan.sort_order,
    });
    setFeatures(plan.plan_features.map((f) => ({ ...f })));
    setNewFeature("");
    setDialogOpen(true);
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setFeatures((prev) => [...prev, { feature_text: newFeature.trim(), sort_order: prev.length + 1 }]);
    setNewFeature("");
  };

  const removeFeature = (idx: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "Plan name is required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let planId = editingPlan?.id;

      if (editingPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({
            name: form.name,
            price: form.price,
            leads_per_month: form.leads_per_month,
            delay_hours: form.delay_hours,
            glow_color: form.glow_color,
            accent_color: form.accent_color,
            is_popular: form.is_popular,
            sort_order: form.sort_order,
          })
          .eq("id", editingPlan.id);
        if (error) throw error;

        // Delete old features and re-insert
        await supabase.from("plan_features").delete().eq("plan_id", editingPlan.id);
      } else {
        const { data, error } = await supabase
          .from("subscription_plans")
          .insert({
            name: form.name,
            price: form.price,
            leads_per_month: form.leads_per_month,
            delay_hours: form.delay_hours,
            glow_color: form.glow_color,
            accent_color: form.accent_color,
            is_popular: form.is_popular,
            sort_order: form.sort_order,
          })
          .select("id")
          .single();
        if (error) throw error;
        planId = data.id;
      }

      // Insert features
      if (features.length > 0 && planId) {
        const { error } = await supabase.from("plan_features").insert(
          features.map((f, i) => ({
            plan_id: planId!,
            feature_text: f.feature_text,
            sort_order: i + 1,
          }))
        );
        if (error) throw error;
      }

      toast({ title: "Saved", description: `Plan "${form.name}" saved successfully.` });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (plan: Plan) => {
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Plan "${plan.name}" ${plan.is_active ? "deactivated" : "activated"}.` });
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{plans?.length ?? 0} plans configured</p>
        <Button size="sm" onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Add Plan
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Plan</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Price</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Leads/mo</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Delay</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : (plans ?? []).map((plan) => (
                <tr key={plan.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: plan.accent_color }} />
                      <span className="font-medium text-foreground">{plan.name}</span>
                      {plan.is_popular && <Badge className="text-[10px] bg-warning/20 text-warning border-0">Popular</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono text-foreground">${plan.price}</td>
                  <td className="p-3 text-right text-muted-foreground">{plan.leads_per_month}</td>
                  <td className="p-3 text-right text-muted-foreground">{plan.delay_hours === 0 ? "Instant" : `${plan.delay_hours}h`}</td>
                  <td className="p-3 text-center">
                    <Badge className={`text-[10px] border-0 ${plan.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeactivate(plan)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (plans ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No plans configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add New Plan"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. PRO" className="bg-background" />
              </div>
              <div>
                <Label>Price ($/mo)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} className="bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Leads per Month</Label>
                <Input type="number" value={form.leads_per_month} onChange={(e) => setForm((f) => ({ ...f, leads_per_month: Number(e.target.value) }))} className="bg-background" />
              </div>
              <div>
                <Label>Delay Hours (0 = instant)</Label>
                <Input type="number" value={form.delay_hours} onChange={(e) => setForm((f) => ({ ...f, delay_hours: Number(e.target.value) }))} className="bg-background" />
              </div>
            </div>

            <div>
              <Label>Color Preset</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{
                      background: form.glow_color === preset.glow ? `rgba(${preset.glow}, 0.25)` : "transparent",
                      borderColor: form.glow_color === preset.glow ? preset.accent : "rgba(255,255,255,0.1)",
                      color: preset.accent,
                    }}
                    onClick={() => setForm((f) => ({ ...f, glow_color: preset.glow, accent_color: preset.accent }))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} className="bg-background" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.is_popular} onCheckedChange={(v) => setForm((f) => ({ ...f, is_popular: v }))} />
                <Label>Most Popular</Label>
              </div>
            </div>

            {/* Features */}
            <div>
              <Label>Features</Label>
              <div className="space-y-2 mt-1.5">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1">{f.feature_text}</span>
                    <button type="button" onClick={() => removeFeature(i)} className="text-destructive hover:text-destructive/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a feature..."
                    className="bg-background"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addFeature}>Add</Button>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlanManager;
