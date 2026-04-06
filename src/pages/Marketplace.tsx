import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  DollarSign,
  ShieldCheck,
  Zap,
  Phone,
  Mail,
  Car,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  MarketplaceFilterDrawer,
  defaultFilters,
  countActiveFilters,
  applyFilters,
  type MarketplaceFilters,
} from "@/components/MarketplaceFilters";

const tierDelayHours: Record<string, number> = {
  vip: 0,
  elite: 6,
  pro: 12,
  basic: 24,
};

function useCountdown(targetMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (targetMs <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const diff = Math.max(0, targetMs - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { remaining: diff, display: `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s` };
}

function CountdownBadge({ unlockAt }: { unlockAt: number }) {
  const { remaining, display } = useCountdown(unlockAt);
  if (remaining <= 0) return null;
  return (
    <span className="font-mono text-[11px] text-cyan whitespace-nowrap">
      <Lock className="h-3 w-3 inline mr-0.5 mb-0.5" />
      {display}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

const Marketplace = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerTier, setDealerTier] = useState("basic");
  const [walletBalance, setWalletBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [tab, setTab] = useState<"all" | "new" | "saved">("all");
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);

  // Purchase modal
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

    if (tab === "new") {
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      result = result.filter((l) => l.created_at > dayAgo);
    }

    result = applyFilters(result, filters);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.reference_code?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.province?.toLowerCase().includes(q) ||
          l.vehicle_preference?.toLowerCase().includes(q) ||
          l.first_name?.toLowerCase().includes(q) ||
          l.last_name?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "newest") result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === "price_low") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_high") result.sort((a, b) => b.price - a.price);
    else if (sortBy === "score") result.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

    return result;
  }, [leads, search, sortBy, tab, filters]);

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const stats = useMemo(() => {
    const available = leads.filter((l) => l.sold_status === "available");
    return {
      total: available.length,
      newToday: available.filter((l) => l.created_at > new Date(Date.now() - 86400000).toISOString()).length,
      avgIncome: available.length ? available.reduce((s, l) => s + (l.income ?? 0), 0) / available.length : 0,
      trustedPct: available.length
        ? Math.round((available.filter((l) => (l.ai_score ?? 0) >= 70).length / available.length) * 100)
        : 0,
    };
  }, [leads]);

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

  const activeFilterCount = countActiveFilters(filters);

  const maskPII = (val: string | null) => {
    if (!val) return "•••••";
    if (val.includes("@") && val.includes("xxx")) return "•••@••••.com";
    if (val === "xxx-xxx-xxxx") return "•••-•••-••••";
    return val;
  };

  // Pagination helpers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0, 1, 2);
      if (page > 3) pages.push("...");
      if (page > 2 && page < totalPages - 3) pages.push(page);
      if (page < totalPages - 4) pages.push("...");
      pages.push(totalPages - 1);
    }
    return [...new Set(pages)];
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Leads Marketplace</h1>
          <p className="text-muted-foreground">
            Instantly buy AI-verified auto leads. Real buyers with real intent, delivered directly to your CRM.
          </p>
        </div>

        {/* Search + Tabs + Sort */}
        <div className="flex flex-col md:flex-row gap-3 mb-5 items-start md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {([
              { key: "all", label: "All Leads", icon: <Users className="h-3.5 w-3.5" /> },
              { key: "new", label: "New Leads", icon: <Zap className="h-3.5 w-3.5" /> },
            ] as const).map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key ? "default" : "outline"}
                size="sm"
                onClick={() => { setTab(t.key); setPage(0); }}
                className={cn(
                  "gap-1.5",
                  tab === t.key ? "gradient-blue-cyan text-foreground" : ""
                )}
              >
                {t.icon} {t.label}
              </Button>
            ))}
            <MarketplaceFilterDrawer
              filters={filters}
              onChange={(f) => { setFilters(f); setPage(0); }}
              onReset={() => { setFilters(defaultFilters); setPage(0); }}
              activeCount={activeFilterCount}
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by</span>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
                <SelectTrigger className="w-[120px] bg-card border-border h-9 text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_low">Price: Low</SelectItem>
                  <SelectItem value="price_high">Price: High</SelectItem>
                  <SelectItem value="score">AI Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="glass-card mb-6 p-4 flex flex-wrap items-center gap-6 md:gap-0 md:divide-x md:divide-border">
          <div className="flex items-center gap-2.5 flex-1 min-w-[160px] md:px-4 first:pl-0">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Total Leads:</span>
            <span className="text-lg font-bold text-primary">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 min-w-[160px] md:px-4">
            <Zap className="h-5 w-5 text-success" />
            <span className="text-sm text-muted-foreground">New Leads:</span>
            <span className="text-lg font-bold text-success">{stats.newToday}</span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 min-w-[160px] md:px-4">
            <DollarSign className="h-5 w-5 text-gold" />
            <span className="text-sm text-muted-foreground">Average Income:</span>
            <span className="text-lg font-bold text-gold">${stats.avgIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-2.5 flex-1 min-w-[160px] md:px-4">
            <ShieldCheck className="h-5 w-5 text-cyan" />
            <span className="text-sm text-muted-foreground">Trusted Buyers:</span>
            <span className="text-lg font-bold text-cyan">{stats.trustedPct}%</span>
          </div>
        </div>

        {/* Lead Table */}
        <div className="glass-card overflow-hidden">
          {paged.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No leads match your criteria.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Type of Lead</TableHead>
                      <TableHead className="text-muted-foreground">Contact Information</TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">Vehicle</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">Time</TableHead>
                      <TableHead className="text-muted-foreground text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((lead) => {
                      const locked = isLocked(lead);
                      return (
                        <TableRow
                          key={lead.id}
                          className={cn(
                            "border-border",
                            locked && "opacity-50"
                          )}
                        >
                          {/* Type of Lead */}
                          <TableCell>
                            <Badge className="bg-success/20 text-success border-0 gap-1 text-xs">
                              <CheckCircle className="h-3 w-3" />
                              Verified · {lead.buyer_type === "walk-in" ? "Walk-in" : "Auto Loan"}
                            </Badge>
                          </TableCell>

                          {/* Contact Information */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium text-foreground">
                                {lead.first_name} {lead.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {maskPII(lead.phone)}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {maskPII(lead.email)}
                              </p>
                            </div>
                          </TableCell>

                          {/* Vehicle */}
                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-0.5">
                              <p className="text-sm text-foreground">{lead.vehicle_preference || "—"}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {lead.vehicle_mileage != null && (
                                  <span className="flex items-center gap-0.5">
                                    <Car className="h-3 w-3" /> {lead.vehicle_mileage.toLocaleString()}
                                  </span>
                                )}
                                {lead.vehicle_price != null && (
                                  <span>${Number(lead.vehicle_price).toLocaleString()}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {lead.ai_score != null && (
                                  <span>Score: {lead.ai_score}</span>
                                )}
                                {lead.credit_range_min != null && (
                                  <span>Credit: {lead.credit_range_min}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Price */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-semibold text-foreground">${Number(lead.price).toFixed(2)}</span>
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            </div>
                          </TableCell>

                          {/* Time */}
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(lead.created_at)}
                          </TableCell>

                          {/* Action */}
                          <TableCell className="text-right">
                            {locked ? (
                              <CountdownBadge unlockAt={getUnlockAt(lead)} />
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => setConfirmLead(lead)}
                                className="gradient-blue-cyan text-foreground gap-1 text-xs"
                              >
                                Buy Lead <ShoppingCart className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getPageNumbers().map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="text-muted-foreground text-sm px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={page === p ? "default" : "outline"}
                        size="sm"
                        className={cn("h-8 w-8 p-0", page === p && "gradient-blue-cyan")}
                        onClick={() => setPage(p as number)}
                      >
                        {(p as number) + 1}
                      </Button>
                    )
                  )}
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    {page * perPage + 1}-{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filter : page:</span>
                  <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(0); }}>
                    <SelectTrigger className="w-[70px] bg-card border-border h-8 text-xs">
                      <SlidersHorizontal className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
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
              <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/30">
                <div>
                  <span className="font-mono text-cyan text-xs">{confirmLead.reference_code}</span>
                  <span className="text-foreground ml-2">{confirmLead.first_name} {confirmLead.last_name?.charAt(0)}.</span>
                </div>
                <span className="font-semibold text-foreground">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">${Number(confirmLead.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className={cn("font-semibold", walletBalance >= confirmLead.price ? "text-success" : "text-destructive")}>
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
            <Button
              className="gradient-blue-cyan text-foreground"
              disabled={purchasing || !confirmLead || walletBalance < confirmLead.price}
              onClick={executePurchase}
            >
              {purchasing ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;
