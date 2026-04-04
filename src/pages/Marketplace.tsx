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
  ArrowUpCircle,
  CheckSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

const gradeColors: Record<string, string> = {
  "A+": "border-l-gold",
  A: "border-l-primary",
  B: "border-l-cyan",
  C: "border-l-muted-foreground",
};

const gradeBadgeColors: Record<string, string> = {
  "A+": "bg-gold/20 text-gold",
  A: "bg-primary/20 text-primary",
  B: "bg-cyan/20 text-cyan",
  C: "bg-muted text-muted-foreground",
};

const tierDelayHours: Record<string, number> = {
  vip: 0,
  elite: 6,
  pro: 12,
  basic: 24,
};

const perPage = 15;

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

const Marketplace = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerTier, setDealerTier] = useState("basic");
  const [walletBalance, setWalletBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<"all" | "new">("all");
  const [filters, setFilters] = useState<MarketplaceFilters>(defaultFilters);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Purchase modal
  const [confirmLeads, setConfirmLeads] = useState<any[] | null>(null);
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

    if (gradeFilter !== "all") {
      result = result.filter((l) => l.quality_grade === gradeFilter);
    }

    // Apply advanced filters
    result = applyFilters(result, filters);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.reference_code?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.province?.toLowerCase().includes(q) ||
          l.vehicle_preference?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "newest") result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === "price_low") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_high") result.sort((a, b) => b.price - a.price);
    else if (sortBy === "score") result.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

    return result;
  }, [leads, search, sortBy, gradeFilter, tab, filters]);

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const stats = useMemo(() => {
    const available = leads.filter((l) => l.sold_status === "available");
    return {
      total: available.length,
      newToday: available.filter((l) => l.created_at > new Date(Date.now() - 86400000).toISOString()).length,
      avgPrice: available.length ? available.reduce((s, l) => s + l.price, 0) / available.length : 0,
    };
  }, [leads]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const unlocked = paged.filter((l) => !isLocked(l));
    const allSelected = unlocked.every((l) => selected.has(l.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        unlocked.forEach((l) => next.delete(l.id));
      } else {
        unlocked.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };

  const selectedLeads = useMemo(
    () => leads.filter((l) => selected.has(l.id) && l.sold_status === "available" && !isLocked(l)),
    [leads, selected, isLocked]
  );

  const selectedTotal = selectedLeads.reduce((s, l) => s + Number(l.price), 0);

  const openConfirm = (leadsList: any[]) => setConfirmLeads(leadsList);

  const executePurchase = async () => {
    if (!confirmLeads?.length) return;
    setPurchasing(true);

    const leadIds = confirmLeads.map((l) => l.id);
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
          body: JSON.stringify({ lead_ids: leadIds }),
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
          description: `${data.purchased} lead(s) purchased. New balance: $${Number(data.new_balance).toFixed(2)}`,
        });
        setWalletBalance(data.new_balance);
        setSelected(new Set());
      }

      if (data.failed > 0) {
        const errors = data.results.filter((r: any) => !r.success).map((r: any) => r.error).join("; ");
        toast({ title: `${data.failed} lead(s) failed`, description: errors, variant: "destructive" });
      }

      setConfirmLeads(null);
      fetchLeads();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPurchasing(false);
  };

  const maskPII = (val: string | null) => {
    if (!val) return "•••••";
    if (val.includes("@") && val.includes("xxx")) return "•••@••••.com";
    if (val === "xxx-xxx-xxxx") return "•••-•••-••••";
    return val;
  };

  const activeFilterCount = countActiveFilters(filters);

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
          <h1 className="text-2xl font-bold text-foreground mb-1">Lead Marketplace</h1>
          <p className="text-muted-foreground text-sm">Browse and purchase AI-verified buyer leads</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Available Leads</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">New Today</p>
              <p className="text-xl font-bold text-foreground">{stats.newToday}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-cyan" />
            <div>
              <p className="text-xs text-muted-foreground">Avg. Price</p>
              <p className="text-xl font-bold text-foreground">${stats.avgPrice.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Search + Tabs + Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, city, province, vehicle..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "new"] as const).map((t) => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                size="sm"
                onClick={() => { setTab(t); setPage(0); }}
                className={tab === t ? "gradient-blue-cyan text-foreground" : ""}
              >
                {t === "all" ? "All" : "New"}
              </Button>
            ))}
            <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[120px] bg-card border-border h-9">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
              <SelectTrigger className="w-[130px] bg-card border-border h-9">
                <SlidersHorizontal className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: Low</SelectItem>
                <SelectItem value="price_high">Price: High</SelectItem>
                <SelectItem value="score">AI Score</SelectItem>
              </SelectContent>
            </Select>
            <MarketplaceFilterDrawer
              filters={filters}
              onChange={(f) => { setFilters(f); setPage(0); }}
              onReset={() => { setFilters(defaultFilters); setPage(0); }}
              activeCount={activeFilterCount}
            />
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
                      <TableHead className="w-10">
                        <Checkbox
                          checked={paged.filter((l) => !isLocked(l)).length > 0 && paged.filter((l) => !isLocked(l)).every((l) => selected.has(l.id))}
                          onCheckedChange={selectAllOnPage}
                        />
                      </TableHead>
                      <TableHead className="text-muted-foreground w-[100px]">Code</TableHead>
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">Contact</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">Location</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">Vehicle</TableHead>
                      <TableHead className="text-muted-foreground">Grade</TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">Score</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground text-right w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((lead) => {
                      const locked = isLocked(lead);
                      return (
                        <TableRow
                          key={lead.id}
                          className={cn(
                            "border-border border-l-4",
                            gradeColors[lead.quality_grade] || "border-l-muted",
                            locked && "opacity-60"
                          )}
                        >
                          <TableCell>
                            {locked ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={selected.has(lead.id)}
                                onCheckedChange={() => toggleSelect(lead.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-cyan">
                            {lead.reference_code}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {lead.first_name} {lead.last_name?.charAt(0)}.
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            <div>{maskPII(lead.email)}</div>
                            <div className="text-xs">{maskPII(lead.phone)}</div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {lead.city}, {lead.province}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {lead.vehicle_preference || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-xs border-0", gradeBadgeColors[lead.quality_grade] || "bg-muted text-muted-foreground")}>
                              {lead.quality_grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="font-mono text-sm text-foreground">{lead.ai_score ?? 0}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            ${Number(lead.price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {locked ? (
                              <CountdownBadge unlockAt={getUnlockAt(lead)} />
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => openConfirm([lead])}
                                className="gradient-blue-cyan text-foreground gap-1 text-xs"
                              >
                                <ShoppingCart className="h-3 w-3" /> Buy
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
                <p className="text-xs text-muted-foreground">
                  Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length} leads
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Batch Purchase Sticky Bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CheckSquare className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-foreground font-semibold">{selectedLeads.length} lead(s) selected</span>
                  <span className="text-muted-foreground ml-2">Total: <span className="text-foreground font-bold">${selectedTotal.toFixed(2)}</span></span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  className="gradient-blue-cyan text-foreground gap-1"
                  onClick={() => openConfirm(selectedLeads)}
                  disabled={selectedLeads.length === 0}
                >
                  <ShoppingCart className="h-4 w-4" /> Buy {selectedLeads.length} Lead(s)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Purchase Dialog */}
      <Dialog open={!!confirmLeads} onOpenChange={() => setConfirmLeads(null)}>
        <DialogContent className="glass border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Purchase</DialogTitle>
          </DialogHeader>
          {confirmLeads && (
            <div className="space-y-3">
              <div className="max-h-48 overflow-y-auto space-y-2">
                {confirmLeads.map((l) => (
                  <div key={l.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-muted/30">
                    <div>
                      <span className="font-mono text-cyan text-xs">{l.reference_code}</span>
                      <span className="text-foreground ml-2">{l.first_name} {l.last_name?.charAt(0)}.</span>
                    </div>
                    <span className="font-semibold text-foreground">${Number(l.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">
                  ${confirmLeads.reduce((s, l) => s + Number(l.price), 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className={cn("font-semibold", walletBalance >= confirmLeads.reduce((s, l) => s + Number(l.price), 0) ? "text-success" : "text-destructive")}>
                  ${walletBalance.toFixed(2)}
                </span>
              </div>
              {walletBalance < confirmLeads.reduce((s, l) => s + Number(l.price), 0) && (
                <p className="text-destructive text-xs">Insufficient funds. Please add more funds to your wallet.</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLeads(null)}>Cancel</Button>
            <Button
              className="gradient-blue-cyan text-foreground"
              disabled={purchasing || !confirmLeads || walletBalance < confirmLeads.reduce((s, l) => s + Number(l.price), 0)}
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
