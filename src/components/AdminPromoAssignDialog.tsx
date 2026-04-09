import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface Dealer {
  id: string;
  dealership_name: string;
  contact_person: string;
  email: string;
}

interface AssignedDealer {
  id: string;
  dealer_id: string;
  dealership_name: string;
  applied_at: string;
}

interface Props {
  promoCodeId: string;
  promoCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AdminPromoAssignDialog = ({ promoCodeId, promoCode, open, onOpenChange }: Props) => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [assignedDealers, setAssignedDealers] = useState<AssignedDealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [dealersRes, assignedRes] = await Promise.all([
      supabase.from("dealers").select("id, dealership_name, contact_person, email").eq("approval_status", "approved"),
      supabase.from("dealer_promo_codes").select("id, dealer_id, applied_at").eq("promo_code_id", promoCodeId),
    ]);

    setDealers((dealersRes.data as Dealer[]) ?? []);

    const assigned = (assignedRes.data ?? []) as { id: string; dealer_id: string; applied_at: string }[];
    // Enrich with dealer names
    if (assigned.length > 0 && dealersRes.data) {
      const dealerMap = new Map((dealersRes.data as Dealer[]).map(d => [d.id, d.dealership_name]));
      setAssignedDealers(assigned.map(a => ({
        ...a,
        dealership_name: dealerMap.get(a.dealer_id) || "Unknown",
      })));
    } else {
      setAssignedDealers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedDealerId("");
    }
  }, [open, promoCodeId]);

  const availableDealers = dealers.filter(
    d => !assignedDealers.some(a => a.dealer_id === d.id)
  );

  const handleAssign = async () => {
    if (!selectedDealerId) return;
    setAssigning(true);

    // Remove any existing promo for this dealer (unique constraint)
    await supabase.from("dealer_promo_codes").delete().eq("dealer_id", selectedDealerId);

    const { error } = await supabase.from("dealer_promo_codes").insert({
      dealer_id: selectedDealerId,
      promo_code_id: promoCodeId,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assigned", description: `Promo ${promoCode} assigned to dealer.` });
      setSelectedDealerId("");
      fetchData();
    }
    setAssigning(false);
  };

  const handleRemove = async (assignmentId: string) => {
    const { error } = await supabase.from("dealer_promo_codes").delete().eq("id", assignmentId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: "Promo removed from dealer." });
      setAssignedDealers(prev => prev.filter(a => a.id !== assignmentId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign "{promoCode}" to Dealers
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading dealers...</p>
        ) : (
          <div className="space-y-4">
            {/* Assign new */}
            <div className="flex gap-2">
              <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
                <SelectTrigger className="bg-card border-border flex-1">
                  <SelectValue placeholder="Select a dealership..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDealers.length === 0 && (
                    <SelectItem value="_none" disabled>No available dealers</SelectItem>
                  )}
                  {availableDealers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.dealership_name} — {d.contact_person}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!selectedDealerId || assigning} onClick={handleAssign}>
                {assigning ? "..." : "Assign"}
              </Button>
            </div>

            {/* Currently assigned */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Currently assigned ({assignedDealers.length}):
              </p>
              {assignedDealers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No dealers assigned yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {assignedDealers.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-foreground">{a.dealership_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(a.applied_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(a.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPromoAssignDialog;
