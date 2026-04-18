import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Tag, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [confirmLeads, setConfirmLeads] = useState<any[] | null>(null);
  const [purchaseResults, setPurchaseResults] = useState<Array<{ lead_id: string; success: boolean; error?: string }> | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [usage, setUsage] = useState<{ leads_used: number; leads_limit: number } | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [activePromo, setActivePromo] = useState<{ code: string; flat_price: number } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Check admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleRow);

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id, subscription_tier, wallet_balance")
      .eq("user_id", session.user.id)
      .single();

    if (dealer) {
      setDealerId(dealer.id);
      setDealerTier(dealer.subscription_tier);
      setWalletBalance(dealer.wallet_balance);

      // Fetch current month usage
      const now = new Date();
      const periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: usageData } = await supabase
        .from("dealer_subscription_usage")
        .select("leads_used, leads_limit")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStr)
        .maybeSingle();
      if (usageData) setUsage(usageData);

      // Check if dealer has an active promo
      const { data: dealerPromo } = await supabase
        .from("dealer_promo_codes")
        .select("promo_code_id, promo_codes(code, flat_price, is_active)")
        .eq("dealer_id", dealer.id)
        .maybeSingle();
      if (dealerPromo && (dealerPromo as any).promo_codes?.is_active) {
        const pc = (dealerPromo as any).promo_codes;
        setActivePromo({ code: pc.code, flat_price: Number(pc.flat_price) });
      } else {
        setActivePromo(null);
      }
    }

    const { data } = await supabase.rpc("get_marketplace_leads", {
      requesting_dealer_id: dealer?.id,
    });

    setLeads(data || []);
    setLoading(false);
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !dealerId) return;
    setApplyingPromo(true);
    // Look up the promo code
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("id, code, flat_price, is_active, max_uses, times_used, expires_at")
      .eq("code", promoCode.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !promo) {
      toast({ title: "Invalid Code", description: "Promo code not found or inactive.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      toast({ title: "Expired", description: "This promo code has expired.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }
    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      toast({ title: "Limit Reached", description: "This promo code has reached its usage limit.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }

    // Remove existing promo if any, then insert
    await supabase.from("dealer_promo_codes").delete().eq("dealer_id", dealerId);
    const { error: insertErr } = await supabase.from("dealer_promo_codes").insert({
      dealer_id: dealerId,
      promo_code_id: promo.id,
    });

    if (insertErr) {
      toast({ title: "Error", description: insertErr.message, variant: "destructive" });
    } else {
      setActivePromo({ code: promo.code, flat_price: Number(promo.flat_price) });
      setPromoCode("");
      toast({ title: "Promo Applied!", description: `All leads now cost $${Number(promo.flat_price).toFixed(2)}.` });
    }
    setApplyingPromo(false);
  };

  const removePromoCode = async () => {
    if (!dealerId) return;
    await supabase.from("dealer_promo_codes").delete().eq("dealer_id", dealerId);
    setActivePromo(null);
    toast({ title: "Promo Removed", description: "Regular pricing restored." });
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

  const maxIncome = useMemo(() => {
    return leads.reduce((max, l) => Math.max(max, Number(l.income ?? 0)), 0);
  }, [leads]);

  const maxPrice = useMemo(() => {
    return leads.reduce((max, l) => Math.max(max, Number(l.price ?? 0)), 0);
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads.filter((l) => l.sold_status === "available");
    result = applyFilters(result, filters, maxIncome);
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [leads, filters, maxIncome]);

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
      .reduce((sum, l) => sum + (activePromo ? activePromo.flat_price : Number(l.price)), 0);
  }, [filtered, selectedLeads, activePromo]);

  const executePurchase = async () => {
    if (!confirmLeads || confirmLeads.length === 0) return;
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
          body: JSON.stringify({ lead_ids: confirmLeads.map((l) => l.id) }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Purchase Failed", description: data.error || "Unknown error", variant: "destructive" });
        setPurchasing(false);
        return;
      }

      if (data.purchased > 0) {
        setWalletBalance(data.new_balance);
        setSelectedLeads((prev) => {
          const next = new Set(prev);
          (data.results as Array<{ lead_id: string; success: boolean }>)
            .filter((r) => r.success)
            .forEach((r) => next.delete(r.lead_id));
          return next;
        });
      }

      // Show per-lead results inside the dialog instead of toasts
      setPurchaseResults(data.results || []);
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
      <div className="mx-auto px-4 py-6 relative z-10">
        <div className="flex gap-6">
          {/* Left sidebar filters */}
          <MarketplaceFilterSidebar
            filters={filters}
            onChange={(f) => setFilters(f)}
            onReset={() => setFilters(defaultFilters)}
            activeCount={activeFilterCount}
            maxIncome={maxIncome}
            maxPrice={maxPrice}
            leads={leads}
          />

          {/* Mobile filter trigger */}
          <div className="lg:hidden mb-4">
            <MarketplaceFilterDrawer
              filters={filters}
              onChange={(f) => setFilters(f)}
              onReset={() => setFilters(defaultFilters)}
              activeCount={activeFilterCount}
              maxIncome={maxIncome}
              maxPrice={maxPrice}
              leads={leads}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
            {/* Sticky Header */}
            <div className="flex items-center justify-between mb-5 flex-shrink-0 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Leads</h2>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Promo code */}
                {activePromo ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 border border-primary/30">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span className="text-primary font-bold font-mono-timer">{activePromo.code}</span>
                    <span className="text-muted-foreground">— All leads at</span>
                    <span className="text-foreground font-bold font-mono-timer">${activePromo.flat_price.toFixed(2)}</span>
                    <button onClick={removePromoCode} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="h-8 w-32 text-xs uppercase bg-card border-border"
                      onKeyDown={(e) => e.key === "Enter" && applyPromoCode()}
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyPromoCode} disabled={applyingPromo || !promoCode.trim()}>
                      {applyingPromo ? "..." : "Apply"}
                    </Button>
                  </div>
                )}
                {usage && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Leads Used:</span>
                    <span className={`font-mono font-bold ${usage.leads_used >= usage.leads_limit ? "text-destructive" : "text-foreground"}`}>
                      {usage.leads_used}/{usage.leads_limit}
                    </span>
                    {usage.leads_used >= usage.leads_limit && (
                      <span className="text-destructive text-[10px] uppercase tracking-wider font-bold">Limit Reached</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Card grid */}
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
                      onBuy={(l) => setConfirmLeads([l])}
                      selected={selectedLeads.has(lead.id)}
                      onSelect={toggleSelect}
                      index={i}
                       promoPrice={activePromo?.flat_price ?? null}
                       promoType={activePromo ? "flat" : null}
                       isAdminView={isAdmin}
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
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilters(defaultFilters)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors border border-border/60 px-4 py-2 rounded-lg hover:border-foreground/20"
            >
              Clear Filters <ChevronRight className="h-4 w-4" />
            </button>
            {selectedLeads.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{selectedLeads.size} lead{selectedLeads.size > 1 ? "s" : ""} selected</span>
                <span className="text-muted-foreground/60">—</span>
                <span className="truncate max-w-[300px]">
                  {filtered
                    .filter((l) => selectedLeads.has(l.id))
                    .map((l) => {
                      const grade = l.quality_grade?.toLowerCase?.() ?? "";
                      if (grade === "a+" || grade === "a") return "Credit/Finance Lead";
                      if (grade === "b") return "Marketplace Lead";
                      return "Referral Lead";
                    })
                    .join(", ")}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-5">
            <span className="text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground font-mono-timer text-lg">${selectedTotal.toFixed(0)}</span>
            </span>
            <button
              className="gradient-cta-green text-foreground px-6 py-2.5 rounded-lg font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40"
              disabled={selectedLeads.size === 0}
              onClick={() => {
                const selected = filtered.filter((l) => selectedLeads.has(l.id));
                if (selected.length > 0) setConfirmLeads(selected);
              }}
            >
              {selectedLeads.size > 1 ? `BUY ${selectedLeads.size} LEADS` : "BUY LEAD"}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog
        open={!!confirmLeads}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmLeads(null);
            setPurchaseResults(null);
          }
        }}
      >
        <DialogContent className="glass border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {purchaseResults
                ? "Purchase Results"
                : `Confirm Purchase${confirmLeads && confirmLeads.length > 1 ? ` (${confirmLeads.length} leads)` : ""}`}
            </DialogTitle>
          </DialogHeader>

          {/* Results view (shown after purchase completes) */}
          {purchaseResults && confirmLeads && (() => {
            const successCount = purchaseResults.filter((r) => r.success).length;
            const failedCount = purchaseResults.length - successCount;
            return (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg p-3 bg-[#22c55e]/10 border border-[#22c55e]/30 text-center">
                    <div className="text-xs text-muted-foreground">Purchased</div>
                    <div className="text-2xl font-bold font-mono-timer text-[#22c55e]">{successCount}</div>
                  </div>
                  <div className="flex-1 rounded-lg p-3 bg-destructive/10 border border-destructive/30 text-center">
                    <div className="text-xs text-muted-foreground">Failed</div>
                    <div className="text-2xl font-bold font-mono-timer text-destructive">{failedCount}</div>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {purchaseResults.map((r) => {
                    const lead = confirmLeads.find((l) => l.id === r.lead_id);
                    return (
                      <div
                        key={r.lead_id}
                        className={cn(
                          "flex items-start justify-between gap-2 text-sm p-3 rounded-lg border",
                          r.success
                            ? "bg-[#22c55e]/5 border-[#22c55e]/30"
                            : "bg-destructive/5 border-destructive/30"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono-timer text-primary text-xs">
                              {lead?.reference_code ?? r.lead_id.slice(0, 8)}
                            </span>
                            {lead && (
                              <span className="text-foreground">
                                {lead.first_name} {lead.last_name?.charAt(0)}.
                              </span>
                            )}
                          </div>
                          {!r.success && r.error && (
                            <p className="text-destructive text-xs mt-1 break-words">{r.error}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-full",
                            r.success
                              ? "bg-[#22c55e]/20 text-[#22c55e]"
                              : "bg-destructive/20 text-destructive"
                          )}
                        >
                          {r.success ? "✓ Purchased" : "✕ Failed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                  <span className="text-muted-foreground">New Balance</span>
                  <span className="font-semibold font-mono-timer text-foreground">
                    ${walletBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Confirmation view (shown before purchase) */}
          {!purchaseResults && confirmLeads && (() => {
            const priceFor = (l: any) => activePromo ? activePromo.flat_price : Number(l.price);
            const total = confirmLeads.reduce((s, l) => s + priceFor(l), 0);
            const insufficient = walletBalance < total;
            return (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {confirmLeads.map((lead) => (
                    <div key={lead.id} className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="min-w-0">
                        <span className="font-mono-timer text-primary text-xs">{lead.reference_code}</span>
                        <span className="text-foreground ml-2">{lead.first_name} {lead.last_name?.charAt(0)}.</span>
                      </div>
                      <span className="font-bold text-foreground font-mono-timer whitespace-nowrap">
                        ${priceFor(lead).toFixed(2)}
                        {activePromo && <span className="text-xs text-primary ml-1">(promo)</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border/50 pt-3 flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground font-mono-timer">
                    ${total.toFixed(2)}
                  </span>
                </div>
                {activePromo && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Promo <strong>{activePromo.code}</strong> applied — flat rate pricing</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet Balance</span>
                  <span className={cn("font-semibold font-mono-timer", !insufficient ? "text-[#22c55e]" : "text-destructive")}>
                    ${walletBalance.toFixed(2)}
                  </span>
                </div>
                {insufficient && (
                  <p className="text-destructive text-xs">Insufficient funds. Please add more funds to your wallet.</p>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            {purchaseResults ? (
              <Button
                onClick={() => {
                  setConfirmLeads(null);
                  setPurchaseResults(null);
                }}
                className="gradient-cta-buy text-foreground font-semibold"
              >
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmLeads(null)} className="border-border/60">Cancel</Button>
                <button
                  className="gradient-cta-buy text-foreground px-5 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                  disabled={
                    purchasing ||
                    !confirmLeads ||
                    walletBalance < (confirmLeads?.reduce((s, l) => s + (activePromo ? activePromo.flat_price : Number(l.price)), 0) ?? 0)
                  }
                  onClick={executePurchase}
                >
                  {purchasing ? "Processing..." : "Confirm Purchase"}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;
