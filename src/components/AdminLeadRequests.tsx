import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock, CheckCircle2, XCircle, Eye, RefreshCw } from "lucide-react";

interface LeadRequest {
  id: string;
  dealer_id: string;
  vehicle_type: string | null;
  city: string | null;
  province: string | null;
  price_min: number | null;
  price_max: number | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  dealers?: { dealership_name: string; contact_person: string; email: string } | null;
}

const statusBadge: Record<string, { class: string; icon: typeof Clock }> = {
  pending: { class: "bg-warning/20 text-warning", icon: Clock },
  fulfilled: { class: "bg-success/20 text-success", icon: CheckCircle2 },
  cancelled: { class: "bg-destructive/20 text-destructive", icon: XCircle },
};

const generateReferenceCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "LR-";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const AdminLeadRequests = () => {
  const [requests, setRequests] = useState<LeadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeadRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  // Lead creation fields (shown when status = fulfilled)
  const [leadForm, setLeadForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    price: "",
    income: "",
    credit_range_min: "",
    credit_range_max: "",
    buyer_type: "online",
    vehicle_preference: "",
    vehicle_price: "",
    notes: "",
  });

  const resetLeadForm = () => {
    setLeadForm({
      first_name: "", last_name: "", phone: "", email: "",
      price: "", income: "", credit_range_min: "", credit_range_max: "",
      buyer_type: "online", vehicle_preference: "", vehicle_price: "", notes: "",
    });
  };

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lead_requests")
      .select("*, dealers(dealership_name, contact_person, email)")
      .order("created_at", { ascending: false });
    setRequests((data as LeadRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);

    // If fulfilling, create a lead first
    if (newStatus === "fulfilled") {
      if (!leadForm.first_name.trim() || !leadForm.last_name.trim() || !leadForm.price) {
        toast({ title: "Required Fields", description: "First name, last name, and price are required to create a lead.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const { error: leadError } = await supabase.from("leads").insert({
        reference_code: generateReferenceCode(),
        first_name: leadForm.first_name.trim(),
        last_name: leadForm.last_name.trim(),
        phone: leadForm.phone.trim() || null,
        email: leadForm.email.trim() || null,
        price: Number(leadForm.price),
        income: leadForm.income ? Number(leadForm.income) : null,
        credit_range_min: leadForm.credit_range_min ? Number(leadForm.credit_range_min) : null,
        credit_range_max: leadForm.credit_range_max ? Number(leadForm.credit_range_max) : null,
        buyer_type: leadForm.buyer_type,
        vehicle_preference: leadForm.vehicle_preference.trim() || selected.vehicle_type || null,
        vehicle_price: leadForm.vehicle_price ? Number(leadForm.vehicle_price) : null,
        city: selected.city || null,
        province: selected.province || null,
        notes: leadForm.notes.trim() || null,
        sold_status: "available",
        quality_grade: "B",
        ai_score: 50,
      });

      if (leadError) {
        toast({ title: "Error creating lead", description: leadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("lead_requests").update({
      status: newStatus,
      admin_notes: adminNotes || null,
    }).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: newStatus === "fulfilled" ? "Lead request fulfilled and lead created in marketplace." : "Lead request updated." });
      setSelected(null);
      resetLeadForm();
      fetchRequests();
    }
  };

  const openDetail = (r: LeadRequest) => {
    setSelected(r);
    setNewStatus(r.status);
    setAdminNotes(r.admin_notes || "");
    resetLeadForm();
    // Pre-fill vehicle preference from request
    if (r.vehicle_type) {
      setLeadForm(prev => ({ ...prev, vehicle_preference: r.vehicle_type || "" }));
    }
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} requests</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">No lead requests found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Dealer</th>
                <th className="text-left p-3">Vehicle</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Budget</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const badge = statusBadge[r.status] || statusBadge.pending;
                const Icon = badge.icon;
                return (
                  <tr key={r.id} className="hover:bg-card/30">
                    <td className="p-3 text-foreground font-medium">
                      {r.dealers?.dealership_name || "Unknown"}
                    </td>
                    <td className="p-3 text-foreground">{r.vehicle_type || "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {[r.city, r.province].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.price_min || r.price_max
                        ? `$${r.price_min?.toLocaleString() ?? "0"} – $${r.price_max?.toLocaleString() ?? "∞"}`
                        : "—"}
                    </td>
                    <td className="p-3">
                      <Badge className={badge.class}>
                        <Icon className="h-3 w-3 mr-1" /> {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); resetLeadForm(); }}>
        <DialogContent className="bg-card border-border max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lead Request Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Dealer:</span> <span className="text-foreground font-medium">{selected.dealers?.dealership_name}</span></div>
                <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{selected.dealers?.contact_person}</span></div>
                <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground">{selected.vehicle_type || "—"}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{[selected.city, selected.province].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">Budget:</span> <span className="text-foreground">${selected.price_min?.toLocaleString() ?? "0"} – ${selected.price_max?.toLocaleString() ?? "∞"}</span></div>
              </div>
              {selected.notes && (
                <div>
                  <Label className="text-muted-foreground">Dealer Notes</Label>
                  <p className="text-foreground text-sm mt-1">{selected.notes}</p>
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled (Create Lead)</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for the dealer..."
                />
              </div>

              {/* Lead creation form - shown when fulfilling */}
              {newStatus === "fulfilled" && selected.status !== "fulfilled" && (
                <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                  <h4 className="text-sm font-semibold text-primary">Create Lead for Marketplace</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">First Name *</Label>
                      <Input
                        value={leadForm.first_name}
                        onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Last Name *</Label>
                      <Input
                        value={leadForm.last_name}
                        onChange={(e) => setLeadForm({ ...leadForm, last_name: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="(416) 555-0123"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Lead Price ($) *</Label>
                      <Input
                        type="number"
                        value={leadForm.price}
                        onChange={(e) => setLeadForm({ ...leadForm, price: e.target.value })}
                        placeholder="25"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Buyer Type</Label>
                      <Select value={leadForm.buyer_type} onValueChange={(v) => setLeadForm({ ...leadForm, buyer_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="walk-in">Walk-in</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Income ($)</Label>
                      <Input
                        type="number"
                        value={leadForm.income}
                        onChange={(e) => setLeadForm({ ...leadForm, income: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Vehicle Price ($)</Label>
                      <Input
                        type="number"
                        value={leadForm.vehicle_price}
                        onChange={(e) => setLeadForm({ ...leadForm, vehicle_price: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Credit Min</Label>
                      <Input
                        type="number"
                        value={leadForm.credit_range_min}
                        onChange={(e) => setLeadForm({ ...leadForm, credit_range_min: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Credit Max</Label>
                      <Input
                        type="number"
                        value={leadForm.credit_range_max}
                        onChange={(e) => setLeadForm({ ...leadForm, credit_range_max: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Vehicle Preference</Label>
                    <Input
                      value={leadForm.vehicle_preference}
                      onChange={(e) => setLeadForm({ ...leadForm, vehicle_preference: e.target.value })}
                      placeholder="e.g. SUV, Honda Civic"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={leadForm.notes}
                      onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                      placeholder="Additional lead details..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); resetLeadForm(); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : newStatus === "fulfilled" && selected?.status !== "fulfilled" ? "Approve & Create Lead" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeadRequests;
