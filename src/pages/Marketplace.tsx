import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  MarketplaceFilterSidebar,
  MarketplaceFilterDrawer,
  defaultFilters,
  countActiveFilters,
  applyFilters,
  type MarketplaceFilters,
} from "@/components/MarketplaceFilters";
import { LeadCard } from "@/components/LeadCard";

const tierDelayHours: Record<string, number> = {
  vip: 0,
  elite: 6,
  pro: 12,
  basic: 24,
};

const Marketplace = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerTier, setDealerTier] = useState("basic");
  const [walletBalance, setWalletBalance] = useState(0);
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [confirmLead, setConfirmLead] = useState<any | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id, subscription_tier, wallet_balance")
      .eq("user_id", session.user.id)
      .single();

    if (dealer) {
      setDealerId(dealer.id);
      setDealerTier(dealer.subscription_tier);
      setWalletBalance(dealer.wallet_balance);
    }

    const { data } = await supabase.rpc("get_marketplace_leads", {
      requesting_dealer_id: dealer?.id,
    });

    setLeads(data || []);
    setLoading(false);
  };

  const delayHours = tierDelayHours[dealerTier] ?? 24;

  const isLocked = useCallback(
    (lead: any) => {
      if (delayHours === 0) return false;
      const ageMs = Date.now() - new Date(lead.created_at).getTime();
      return ageMs < delayHours * 3600000;
    },
    [delayHours]
  );

  const getUnlockAt = useCallback(
    (lead: any) => new Date(lead.created_at).getTime() + delayHours * 3600000,
    [delayHours]
  );

  const filtered = useMemo(() => {
    let result = leads.filter((l) => l.sold_status === "available");
    result = applyFilters(result, filters);
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [leads, filters]);

  const activeFilterCount = countActiveFilters(filters);

  const toggleSelect = (lead: any) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.add(lead.id);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    return filtered
      .filter((l) => selectedLeads.has(l.id))
      .reduce((sum, l) => sum + Number(l.price), 0);
  }, [filtered, selectedLeads]);

  const executePurchase = async () => {
    if (!confirmLead) return;
    setPurchasing(true);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/purchase-lead`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ lead_ids: [confirmLead.id] }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Purchase Failed", description: data.error || "Unknown error", variant: "destructive" });
        setPurchasing(false);
        return;
      }

      if (data.purchased > 0) {
        toast({
          title: "Purchase Successful!",
          description: `Lead purchased. New balance: $${Number(data.new_balance).toFixed(2)}`,
        });
        setWalletBalance(data.new_balance);
      }

      if (data.failed > 0) {
        const errors = data.results.filter((r: any) => !r.success).map((r: any) => r.error).join("; ");
        toast({ title: "Purchase failed", description: errors, variant: "destructive" });
      }

      setConfirmLead(null);
      fetchLeads();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 starfield">
      <div className="max-w-[1400px] mx-auto px-4 py-6 relative z-10">
        <div className="flex gap-6">
          {/* Left sidebar filters */}
          <MarketplaceFilterSidebar
            filters={filters}
            onChange={(f) => setFilters(f)}
            onReset={() => setFilters(defaultFilters)}
            activeCount={activeFilterCount}
          />

          {/* Mobile filter trigger */}
          <div className="lg:hidden mb-4">
            <MarketplaceFilterDrawer
              filters={filters}
              onChange={(f) => setFilters(f)}
              onReset={() => setFilters(defaultFilters)}
              activeCount={activeFilterCount}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-lg font-semibold text-foreground">Leads</h2>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Card grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                No leads match your criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    locked={isLocked(lead)}
                    unlockAt={getUnlockAt(lead)}
                    onBuy={(l) => setConfirmLead(l)}
                    selected={selectedLeads.has(lead.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 glass border-t border-border py-3 px-6 z-50">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <button
            onClick={() => setFilters(defaultFilters)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors border border-border/60 px-4 py-2 rounded-lg hover:border-foreground/20"
          >
            Clear Filters <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-5">
            <span className="text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground font-mono-timer text-lg">${selectedTotal.toFixed(0)}</span>
            </span>
            <button
              className="gradient-cta-green text-foreground px-6 py-2.5 rounded-lg font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40"
              disabled={selectedLeads.size === 0}
              onClick={() => {
                const firstSelected = filtered.find((l) => selectedLeads.has(l.id));
                if (firstSelected) setConfirmLead(firstSelected);
              }}
            >
              BUY LEAD
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog open={!!confirmLead} onOpenChange={() => setConfirmLead(null)}>
        <DialogContent className="glass border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Purchase</DialogTitle>
          </DialogHeader>
          {confirmLead && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/50 border border-border/50">
                <div>
                  <span className="font-mono-timer text-primary text-xs">{confirmLead.reference_code}</span>
                  <span className="text-foreground ml-2">{confirmLead.first_name} {confirmLead.last_name?.charAt(0)}.</span>
                </div>
                <span className="font-bold text-foreground font-mono-timer">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground font-mono-timer">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className={cn("font-semibold font-mono-timer", walletBalance >= confirmLead.price ? "text-[#22c55e]" : "text-destructive")}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>
              {walletBalance < confirmLead.price && (
                <p className="text-destructive text-xs">Insufficient funds. Please add more funds to your wallet.</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLead(null)} className="border-border/60">Cancel</Button>
            <button
              className="gradient-cta-buy text-foreground px-5 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              disabled={purchasing || !confirmLead || walletBalance < confirmLead.price}
              onClick={executePurchase}
            >
              {purchasing ? "Processing..." : "Confirm Purchase"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;
