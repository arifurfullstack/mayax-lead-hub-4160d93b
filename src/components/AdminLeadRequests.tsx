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

const AdminLeadRequests = () => {
  const [requests, setRequests] = useState<LeadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeadRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

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
    const { error } = await supabase.from("lead_requests").update({
      status: newStatus,
      admin_notes: adminNotes || null,
    }).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Lead request updated." });
      setSelected(null);
      fetchRequests();
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelected(r);
                          setNewStatus(r.status);
                          setAdminNotes(r.admin_notes || "");
                        }}
                      >
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border">
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
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeadRequests;
