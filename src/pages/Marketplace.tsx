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
  const [usage, setUsage] = useState<{ leads_used: number; leads_limit: number } | null>(null);

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

      const now = new Date();
      const periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: usageData } = await supabase
        .from("dealer_subscription_usage")
        .select("leads_used, leads_limit")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStr)
        .maybeSingle();
      if (usageData) setUsage(usageData);
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

  // Compute max income from leads for slider
  const maxIncome = useMemo(() => {
    const incomes = leads.map((l) => Number(l.income ?? 0)).filter((v) => v > 0);
    return incomes.length > 0 ? Math.max(...incomes) : 500000;
  }, [leads]);

  // Extract available makes/models from leads based on selected vehicle type/make
  const availableMakes = useMemo(() => {
    if (filters.vehicleType === "all") return [];
    const makes = leads
      .filter((l) => l.vehicle_preference?.toLowerCase().includes(filters.vehicleType.toLowerCase()))
      .map((l) => l.vehicle_make)
      .filter(Boolean);
    return [...new Set(makes)].sort();
  }, [leads, filters.vehicleType]);

  const availableModels = useMemo(() => {
    if (filters.vehicleMake === "all") return [];
    const models = leads
      .filter((l) => l.vehicle_make?.toLowerCase() === filters.vehicleMake.toLowerCase())
      .map((l) => l.vehicle_model)
      .filter(Boolean);
    return [...new Set(models)].sort();
  }, [leads, filters.vehicleMake]);

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
    <div className="min-h-screen pb-20">
      <div className="max-w-[1600px] mx-auto px-4 py-6 relative z-10">
        <div className="flex gap-5">
          {/* Left sidebar filters */}
          <MarketplaceFilterSidebar
            filters={filters}
            onChange={(f) => setFilters(f)}
            onReset={() => setFilters(defaultFilters)}
            activeCount={activeFilterCount}
            maxIncome={maxIncome}
            availableMakes={availableMakes}
            availableModels={availableModels}
          />

          {/* Mobile filter trigger */}
          <div className="lg:hidden mb-4">
            <MarketplaceFilterDrawer
              filters={filters}
              onChange={(f) => setFilters(f)}
              onReset={() => setFilters(defaultFilters)}
              activeCount={activeFilterCount}
              maxIncome={maxIncome}
              availableMakes={availableMakes}
              availableModels={availableModels}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Leads</h2>
                <span className="text-xs text-muted-foreground">({filtered.length})</span>
              </div>
              {usage && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border">
                  <span className="text-muted-foreground">Leads Used:</span>
                  <span className={`font-mono font-bold ${usage.leads_used >= usage.leads_limit ? "text-destructive" : "text-foreground"}`}>
                    {usage.leads_used}/{usage.leads_limit}
                  </span>
                </div>
              )}
            </div>

            {/* Card grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  No leads match your criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-4">
                  {filtered.map((lead, i) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      locked={isLocked(lead)}
                      unlockAt={getUnlockAt(lead)}
                      onBuy={(l) => setConfirmLead(l)}
                      selected={selectedLeads.has(lead.id)}
                      onSelect={toggleSelect}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 glass border-t border-border py-3 px-6 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilters(defaultFilters)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors border border-border px-4 py-2 rounded-lg hover:border-foreground/20"
            >
              Clear Filters <ChevronRight className="h-4 w-4" />
            </button>
            {selectedLeads.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{selectedLeads.size} lead{selectedLeads.size > 1 ? "s" : ""} selected</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-5">
            <span className="text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground font-mono-timer text-lg">${selectedTotal.toFixed(0)}</span>
            </span>
            <button
              className="gradient-cta-green px-6 py-2.5 rounded-lg font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40"
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
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Purchase</DialogTitle>
          </DialogHeader>
          {confirmLead && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted border border-border">
                <div>
                  <span className="font-mono-timer text-primary text-xs">{confirmLead.reference_code}</span>
                </div>
                <span className="font-bold text-foreground font-mono-timer">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground font-mono-timer">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className={cn("font-semibold font-mono-timer", walletBalance >= confirmLead.price ? "text-[hsl(var(--success))]" : "text-destructive")}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>
              {walletBalance < confirmLead.price && (
                <p className="text-destructive text-xs">Insufficient funds. Please add more funds to your wallet.</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLead(null)}>Cancel</Button>
            <button
              className="gradient-cta-buy px-5 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
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
