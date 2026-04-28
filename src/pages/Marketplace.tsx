import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDown, ChevronRight, Tag, X, Wifi, WifiOff, Loader2, FlaskConical } from "lucide-react";
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
  // Admin "buy on behalf of" state
  const [allDealers, setAllDealers] = useState<Array<{ id: string; dealership_name: string; wallet_balance: number; subscription_tier: string }>>([]);
  const [targetDealerId, setTargetDealerId] = useState<string>(""); // empty = self
  const [giftMode, setGiftMode] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected" | "error"
  >("connecting");
  // Track whether the realtime channel was previously dropped so we can
  // re-fetch (catch-up) the moment it reconnects — events fired during the
  // outage would otherwise be lost.
  const wasDisconnectedRef = useRef(false);
  const [insertingTestLead, setInsertingTestLead] = useState(false);
  // When > 0, also fetch leads sold within the last N hours and render them
  // as read-only cards so the marketplace doesn't look "empty" when buyers
  // claim every new lead instantly.
  const [includeSoldHours, setIncludeSoldHours] = useState(0);

  useEffect(() => {
    fetchLeads();
  }, []);

  // Realtime: instantly add new available leads & remove sold/deleted ones
  useEffect(() => {
    const channel = supabase
      .channel("marketplace-leads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const newLead = payload.new as any;
          if (newLead?.sold_status !== "available") return;
          console.log("[Marketplace realtime] INSERT received", newLead.id);
          // Re-fetch via RPC so the new lead arrives with the same shape
          // (masked PII, tier-delay filtering) as the rest of the list.
          fetchLeads();
          toast({
            title: "🚗 New lead just arrived!",
            description: `${newLead.buyer_type === "finance" ? "Finance" : "Marketplace"} lead${newLead.city ? ` from ${newLead.city}` : ""} • $${Number(newLead.price ?? 0).toFixed(0)}`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const updated = payload.new as any;
          console.log("[Marketplace realtime] UPDATE received", updated.id, updated.sold_status);
          setLeads((prev) => {
            const exists = prev.some((l) => l.id === updated.id);
            if (updated.sold_status !== "available") {
              return exists ? prev.filter((l) => l.id !== updated.id) : prev;
            }
            if (exists) {
              return prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
            }
            // New lead became available — re-fetch for proper shape.
            fetchLeads();
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const oldLead = payload.old as any;
          console.log("[Marketplace realtime] DELETE received", oldLead.id);
          setLeads((prev) => prev.filter((l) => l.id !== oldLead.id));
        }
      )
      .subscribe((status) => {
        console.log("[Marketplace realtime] subscription status:", status);
        // Supabase emits: SUBSCRIBED | TIMED_OUT | CLOSED | CHANNEL_ERROR
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          // Catch up on anything we missed while disconnected.
          if (wasDisconnectedRef.current) {
            wasDisconnectedRef.current = false;
            console.log("[Marketplace realtime] reconnected — re-fetching leads");
            fetchLeads();
            toast({
              title: "Reconnected",
              description: "Marketplace is live again. Refreshed leads.",
            });
          }
        } else if (status === "CHANNEL_ERROR") {
          setRealtimeStatus("error");
          wasDisconnectedRef.current = true;
        } else if (status === "TIMED_OUT") {
          setRealtimeStatus("reconnecting");
          wasDisconnectedRef.current = true;
        } else if (status === "CLOSED") {
          setRealtimeStatus("disconnected");
          wasDisconnectedRef.current = true;
        }
      });

    // If the browser regains network, force the realtime client to reconnect.
    const handleOnline = () => {
      console.log("[Marketplace realtime] browser online — forcing reconnect");
      wasDisconnectedRef.current = true;
      try {
        supabase.realtime.disconnect();
        supabase.realtime.connect();
      } catch (e) {
        console.warn("[Marketplace realtime] reconnect attempt failed", e);
      }
    };
    // If the tab becomes visible again after being hidden, re-fetch to catch up
    // (Supabase auto-reconnects, but events during the gap are lost).
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[Marketplace realtime] tab visible — refreshing leads");
        fetchLeads();
      }
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
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
    const adminFlag = !!roleRow;
    setIsAdmin(adminFlag);

    if (adminFlag) {
      const { data: dealersData } = await supabase
        .from("dealers")
        .select("id, dealership_name, wallet_balance, subscription_tier")
        .eq("approval_status", "approved")
        .order("dealership_name", { ascending: true });
      setAllDealers((dealersData || []) as any);
    }

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
      include_sold_hours: includeSoldHours,
    });

    setLeads(data || []);
    setLoading(false);
  };

  // Re-fetch whenever the "show sold" window changes
  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeSoldHours]);

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

  // Admin-only: insert a synthetic test lead and verify it shows up via realtime.
  const insertTestLead = async () => {
    if (!isAdmin) return;
    setInsertingTestLead(true);
    const before = leads.length;
    const ref = `TEST-${Date.now().toString(36).toUpperCase()}`;
    const cities = ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"];
    const provinces = ["ON", "BC", "QC", "AB", "ON"];
    const idx = Math.floor(Math.random() * cities.length);

    const { data, error } = await supabase
      .from("leads")
      .insert({
        reference_code: ref,
        first_name: "Test",
        last_name: "Lead",
        email: `test+${Date.now()}@example.com`,
        phone: `416-555-${String(Math.floor(1000 + Math.random() * 9000))}`,
        city: cities[idx],
        province: provinces[idx],
        buyer_type: Math.random() > 0.5 ? "finance" : "online",
        credit_range_min: 600,
        credit_range_max: 700,
        income: 60000,
        vehicle_preference: "Sedan",
        vehicle_price: 25000,
        ai_score: 75,
        quality_grade: "B",
        price: 49,
        sold_status: "available",
        notes: "🧪 Synthetic test lead — safe to delete.",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Insert failed", description: error.message, variant: "destructive" });
      setInsertingTestLead(false);
      return;
    }

    toast({
      title: "Test lead inserted",
      description: `Ref ${ref} • Verifying realtime delivery…`,
    });

    // Verify the realtime subscription delivered it within 5s.
    const insertedId = data?.id;
    const startedAt = Date.now();
    const verify = () => {
      setLeads((current) => {
        const arrived = insertedId
          ? current.some((l) => l.id === insertedId)
          : current.length > before;
        if (arrived) {
          toast({
            title: "✅ Realtime verified",
            description: `Test lead ${ref} appeared in the marketplace.`,
          });
        } else if (Date.now() - startedAt > 5000) {
          toast({
            title: "⚠️ Realtime not received",
            description:
              "Test lead was created but did not arrive via realtime within 5s. Refreshing now.",
            variant: "destructive",
          });
          fetchLeads();
        } else {
          setTimeout(verify, 500);
        }
        return current;
      });
    };
    setTimeout(verify, 500);
    setInsertingTestLead(false);
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
    const available = applyFilters(
      leads.filter((l) => l.sold_status === "available"),
      filters,
      maxIncome,
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (includeSoldHours <= 0) return available;

    const sold = leads
      .filter((l) => l.sold_status === "sold")
      .sort((a, b) => new Date(b.sold_at ?? 0).getTime() - new Date(a.sold_at ?? 0).getTime());

    return [...available, ...sold];
  }, [leads, filters, maxIncome, includeSoldHours]);

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
          body: JSON.stringify({
            lead_ids: confirmLeads.map((l) => l.id),
            ...(isAdmin && targetDealerId ? { target_dealer_id: targetDealerId } : {}),
            ...(isAdmin && giftMode ? { gift: true } : {}),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Purchase Failed", description: data.error || "Unknown error", variant: "destructive" });
        setPurchasing(false);
        return;
      }

      if (data.purchased > 0) {
        // Only update OUR wallet balance if buying for self
        if (!targetDealerId) setWalletBalance(data.new_balance);
        const successfulLeadIds = new Set(
          (data.results as Array<{ lead_id: string; success: boolean }>)
            .filter((r) => r.success)
            .map((r) => r.lead_id)
        );
        setLeads((prev) => prev.filter((lead) => !successfulLeadIds.has(lead.id)));
        setSelectedLeads((prev) => {
          const next = new Set(prev);
          (data.results as Array<{ lead_id: string; success: boolean }>)
            .filter((r) => r.success)
            .forEach((r) => next.delete(r.lead_id));
          return next;
        });
      }

      const failedResults = (data.results as Array<{ lead_id: string; success: boolean; error?: string }>).filter((r) => !r.success);
      if (failedResults.length > 0) {
        toast({
          title: failedResults.length === 1 ? "Lead not assigned" : "Some leads were not assigned",
          description: failedResults[0].error || "Please review the purchase results.",
          variant: "destructive",
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
                {(() => {
                  const map = {
                    connected: {
                      label: "Live",
                      title: "Real-time updates connected",
                      dot: "bg-emerald-500 shadow-[0_0_8px_hsl(var(--primary)/0.6)]",
                      text: "text-emerald-500",
                      Icon: Wifi,
                      pulse: true,
                    },
                    connecting: {
                      label: "Connecting…",
                      title: "Connecting to real-time updates",
                      dot: "bg-muted-foreground",
                      text: "text-muted-foreground",
                      Icon: Loader2,
                      pulse: false,
                    },
                    reconnecting: {
                      label: "Reconnecting…",
                      title: "Connection timed out, reconnecting",
                      dot: "bg-amber-500",
                      text: "text-amber-500",
                      Icon: Loader2,
                      pulse: false,
                    },
                    disconnected: {
                      label: "Offline",
                      title: "Real-time updates disconnected",
                      dot: "bg-muted-foreground",
                      text: "text-muted-foreground",
                      Icon: WifiOff,
                      pulse: false,
                    },
                    error: {
                      label: "Error",
                      title: "Real-time connection error",
                      dot: "bg-destructive",
                      text: "text-destructive",
                      Icon: WifiOff,
                      pulse: false,
                    },
                  } as const;
                  const s = map[realtimeStatus];
                  const isSpinner = s.Icon === Loader2;
                  return (
                    <div
                      title={s.title}
                      className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border/60 bg-muted/30"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          s.dot,
                          s.pulse && "animate-pulse"
                        )}
                      />
                      <s.Icon
                        className={cn(
                          "h-3 w-3",
                          s.text,
                          isSpinner && "animate-spin"
                        )}
                      />
                      <span className={cn("text-[10px] font-medium leading-none", s.text)}>
                        {s.label}
                      </span>
                    </div>
                  );
                })()}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={insertTestLead}
                    disabled={insertingTestLead}
                    title="Admin only — insert a synthetic lead and verify realtime delivery"
                    className="h-7 ml-1 text-[11px] gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                  >
                    {insertingTestLead ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FlaskConical className="h-3 w-3" />
                    )}
                    Insert test lead
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Recently sold visibility toggle (admins default to 24h) */}
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  title="When on, recently sold leads stay visible (read-only) so an empty marketplace is easier to diagnose."
                >
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>Show sold (24h)</span>
                  <Switch
                    checked={includeSoldHours > 0}
                    onCheckedChange={(v) => setIncludeSoldHours(v ? 24 : 0)}
                  />
                </div>
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
                       readOnly={lead.sold_status === "sold"}
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
            setTargetDealerId("");
            setGiftMode(false);
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
            const targetDealer = isAdmin && targetDealerId
              ? allDealers.find((d) => d.id === targetDealerId)
              : null;
            const effectiveBalance = targetDealer ? Number(targetDealer.wallet_balance) : walletBalance;
            const effectiveTotal = isAdmin && giftMode ? 0 : total;
            const insufficient = effectiveBalance < effectiveTotal;
            return (
              <div className="space-y-3">
                {/* Admin: buy on behalf of */}
                {isAdmin && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
                      <span className="px-1.5 py-0.5 rounded bg-primary/20">Admin</span>
                      Buy on behalf of
                    </div>
                    <Select value={targetDealerId || "self"} onValueChange={(v) => setTargetDealerId(v === "self" ? "" : v)}>
                      <SelectTrigger className="bg-background/60 border-border">
                        <SelectValue placeholder="Pick a dealer" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="self">— Buy for myself —</SelectItem>
                        {allDealers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.dealership_name} · ${Number(d.wallet_balance).toFixed(0)} · {d.subscription_tier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gift-mode" className="text-xs text-muted-foreground cursor-pointer">
                        Gift (no charge)
                      </Label>
                      <Switch id="gift-mode" checked={giftMode} onCheckedChange={setGiftMode} />
                    </div>
                  </div>
                )}

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
                    {isAdmin && giftMode ? (
                      <>
                        <span className="line-through text-muted-foreground text-sm mr-2">${total.toFixed(2)}</span>
                        <span className="text-[#22c55e]">FREE</span>
                      </>
                    ) : (
                      <>${total.toFixed(2)}</>
                    )}
                  </span>
                </div>
                {activePromo && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Promo <strong>{activePromo.code}</strong> applied — flat rate pricing</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {targetDealer ? `${targetDealer.dealership_name}'s wallet` : "Wallet Balance"}
                  </span>
                  <span className={cn("font-semibold font-mono-timer", !insufficient ? "text-[#22c55e]" : "text-destructive")}>
                    ${effectiveBalance.toFixed(2)}
                  </span>
                </div>
                {insufficient && !giftMode && (
                  <p className="text-destructive text-xs">
                    Insufficient funds in {targetDealer ? `${targetDealer.dealership_name}'s` : "your"} wallet.
                    {isAdmin && " Toggle 'Gift (no charge)' to assign for free."}
                  </p>
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
                  setTargetDealerId("");
                  setGiftMode(false);
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
                  disabled={(() => {
                    if (purchasing || !confirmLeads) return true;
                    if (isAdmin && giftMode) return false;
                    const total = confirmLeads.reduce((s, l) => s + (activePromo ? activePromo.flat_price : Number(l.price)), 0);
                    const targetDealer = isAdmin && targetDealerId ? allDealers.find((d) => d.id === targetDealerId) : null;
                    const bal = targetDealer ? Number(targetDealer.wallet_balance) : walletBalance;
                    return bal < total;
                  })()}
                  onClick={executePurchase}
                >
                  {purchasing
                    ? "Processing..."
                    : isAdmin && giftMode
                    ? "Gift Lead(s)"
                    : isAdmin && targetDealerId
                    ? "Buy for Dealer"
                    : "Confirm Purchase"}
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
