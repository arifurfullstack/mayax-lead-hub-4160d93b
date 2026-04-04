import { useState, useEffect, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Users,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

const perPage = 15;

const Marketplace = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<"all" | "new" | "saved">("all");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (dealer) setDealerId(dealer.id);

    const { data } = await supabase.rpc("get_marketplace_leads", {
      requesting_dealer_id: dealer?.id,
    });

    setLeads(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = leads.filter((l) => l.sold_status === "available");

    if (tab === "new") {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      result = result.filter((l) => l.created_at > dayAgo);
    }

    if (gradeFilter !== "all") {
      result = result.filter((l) => l.quality_grade === gradeFilter);
    }

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
  }, [leads, search, sortBy, gradeFilter, tab]);

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const stats = useMemo(() => ({
    total: leads.filter((l) => l.sold_status === "available").length,
    newToday: leads.filter((l) => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return l.sold_status === "available" && l.created_at > dayAgo;
    }).length,
    avgPrice: leads.length
      ? leads.filter((l) => l.sold_status === "available").reduce((s, l) => s + l.price, 0) / Math.max(leads.filter((l) => l.sold_status === "available").length, 1)
      : 0,
  }), [leads]);

  const handleBuy = async (lead: any) => {
    if (!dealerId) return;
    toast({ title: "Purchase", description: `Buying lead ${lead.reference_code}... (Purchase flow coming soon)` });
  };

  const maskPII = (val: string | null) => {
    if (!val) return "•••••";
    if (val.includes("@") && val.includes("xxx")) return "•••@••••.com";
    if (val === "xxx-xxx-xxxx") return "•••-•••-••••";
    return val;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
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
          <div className="flex gap-2">
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
          </div>
          <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[120px] bg-card border-border">
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
            <SelectTrigger className="w-[140px] bg-card border-border">
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
                      <TableHead className="text-muted-foreground w-[100px]">Code</TableHead>
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">Contact</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">Location</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">Vehicle</TableHead>
                      <TableHead className="text-muted-foreground">Grade</TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">Score</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className={cn(
                          "border-border border-l-4",
                          gradeColors[lead.quality_grade] || "border-l-muted"
                        )}
                      >
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
                          <Button
                            size="sm"
                            onClick={() => handleBuy(lead)}
                            className="gradient-blue-cyan text-foreground gap-1 text-xs"
                          >
                            <ShoppingCart className="h-3 w-3" /> Buy
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
      </div>
    </div>
  );
};

export default Marketplace;
