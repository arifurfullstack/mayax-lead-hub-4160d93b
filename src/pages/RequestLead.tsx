import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Clock, CheckCircle2, XCircle, Car } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LeadRequest {
  id: string;
  vehicle_type: string | null;
  city: string | null;
  province: string | null;
  price_min: number | null;
  price_max: number | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const statusBadge: Record<string, { class: string; icon: typeof Clock }> = {
  pending: { class: "bg-warning/20 text-warning", icon: Clock },
  fulfilled: { class: "bg-success/20 text-success", icon: CheckCircle2 },
  cancelled: { class: "bg-destructive/20 text-destructive", icon: XCircle },
};

const RequestLead = () => {
  const [requests, setRequests] = useState<LeadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicle_type: "",
    city: "",
    province: "",
    price_min: "",
    price_max: "",
    notes: "",
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: dealer } = await supabase
        .from("dealers")
        .select("id")
        .eq("user_id", session.user.id)
        .single();
      if (dealer) {
        setDealerId(dealer.id);
        fetchRequests(dealer.id);
      }
    };
    init();
  }, []);

  const fetchRequests = async (did: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_requests")
      .select("*")
      .eq("dealer_id", did)
      .order("created_at", { ascending: false });
    setRequests((data as LeadRequest[]) ?? []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!dealerId) return;
    if (!form.vehicle_type.trim()) {
      toast({ title: "Required", description: "Please enter a vehicle type.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("lead_requests").insert({
      dealer_id: dealerId,
      vehicle_type: form.vehicle_type.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      notes: form.notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submitted", description: "Your lead request has been submitted." });
      setForm({ vehicle_type: "", city: "", province: "", price_min: "", price_max: "", notes: "" });
      setShowForm(false);
      fetchRequests(dealerId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Request Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tell us what leads you're looking for and we'll find them for you.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No requests yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Submit your first lead request to get started.</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> New Request
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((r) => {
            const badge = statusBadge[r.status] || statusBadge.pending;
            const Icon = badge.icon;
            return (
              <div key={r.id} className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-foreground">{r.vehicle_type || "Any Vehicle"}</span>
                  </div>
                  <Badge className={badge.class}>
                    <Icon className="h-3 w-3 mr-1" />
                    {r.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {r.city && <span>📍 {r.city}{r.province ? `, ${r.province}` : ""}</span>}
                  {(r.price_min || r.price_max) && (
                    <span>💰 ${r.price_min?.toLocaleString() ?? "0"} – ${r.price_max?.toLocaleString() ?? "∞"}</span>
                  )}
                </div>
                {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                {r.admin_notes && (
                  <p className="text-sm text-primary bg-primary/10 rounded px-2 py-1">
                    Admin: {r.admin_notes}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>New Lead Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vehicle Type *</Label>
              <Input
                placeholder="e.g. SUV, Sedan, Honda Civic"
                value={form.vehicle_type}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input
                  placeholder="e.g. Toronto"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>Province</Label>
                <Input
                  placeholder="e.g. Ontario"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Budget ($)</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={form.price_min}
                  onChange={(e) => setForm({ ...form, price_min: e.target.value })}
                />
              </div>
              <div>
                <Label>Max Budget ($)</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={form.price_max}
                  onChange={(e) => setForm({ ...form, price_max: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Any specific requirements..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              <Send className="h-4 w-4" /> {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestLead;
