import { useState, useMemo } from "react";
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import {
  Search,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
  CalendarDays,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AdminAddLeadDialog from "@/components/AdminAddLeadDialog";

interface LeadFileEntry {
  name: string;
  path: string;
}

export interface AdminLead {
  id: string;
  reference_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  quality_grade: string | null;
  ai_score: number | null;
  price: number;
  sold_status: string;
  created_at: string;
  document_files: LeadFileEntry[];
  buyer_type: string | null;
  vehicle_preference: string | null;
  vehicle_price: number | null;
  vehicle_mileage: number | null;
  income: number | null;
  credit_range_min: number | null;
  credit_range_max: number | null;
  notes: string | null;
  appointment_time: string | null;
  trade_in: boolean | null;
  has_bankruptcy: boolean | null;
}

const gradeColors: Record<string, string> = {
  "A+": "bg-gold/20 text-gold",
  A: "bg-primary/20 text-primary",
  B: "bg-cyan/20 text-cyan",
  C: "bg-muted text-muted-foreground",
};

type SortField = "reference_code" | "first_name" | "province" | "quality_grade" | "ai_score" | "price" | "sold_status" | "created_at";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface Props {
  leads: AdminLead[];
  onSelectLead: (lead: AdminLead) => void;
  onRefresh: () => void;
}

export default function AdminLeadTable({ leads, onSelectLead, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [timePeriod, setTimePeriod] = useState<string>("today");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const provinces = useMemo(
    () => [...new Set(leads.map((l) => l.province).filter(Boolean))].sort() as string[],
    [leads]
  );

  const grades = useMemo(
    () => [...new Set(leads.map((l) => l.quality_grade).filter(Boolean))].sort() as string[],
    [leads]
  );

  // Filter
  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.reference_code.toLowerCase().includes(q) ||
          l.first_name.toLowerCase().includes(q) ||
          l.last_name.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter((l) => l.sold_status === statusFilter);
    if (gradeFilter !== "all") result = result.filter((l) => l.quality_grade === gradeFilter);
    if (provinceFilter !== "all") result = result.filter((l) => l.province === provinceFilter);
    return result;
  }, [leads, search, statusFilter, gradeFilter, provinceFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (va == null) va = "";
      if (vb == null) vb = "";
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-primary" />
    );
  };

  const resetPage = () => setPage(0);

  // Bulk select helpers
  const allPageSelected = paged.length > 0 && paged.every((l) => selected.has(l.id));
  const somePageSelected = paged.some((l) => selected.has(l.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allPageSelected) {
      paged.forEach((l) => next.delete(l.id));
    } else {
      paged.forEach((l) => next.add(l.id));
    }
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selected);

    // 1. Find purchases linked to these leads
    const { data: purchases } = await supabase
      .from("purchases")
      .select("id")
      .in("lead_id", ids);
    const purchaseIds = (purchases ?? []).map((p) => p.id);

    // 2. Delete delivery_logs referencing those purchases
    if (purchaseIds.length > 0) {
      const { error: dlErr } = await supabase
        .from("delivery_logs")
        .delete()
        .in("purchase_id", purchaseIds);
      if (dlErr) {
        setBulkDeleting(false);
        toast({ title: "Error", description: dlErr.message, variant: "destructive" });
        return;
      }
    }

    // 3. Delete purchases referencing these leads
    if (purchaseIds.length > 0) {
      const { error: pErr } = await supabase
        .from("purchases")
        .delete()
        .in("id", purchaseIds);
      if (pErr) {
        setBulkDeleting(false);
        toast({ title: "Error", description: pErr.message, variant: "destructive" });
        return;
      }
    }

    // 4. Delete promo_code_usage referencing these leads
    const { error: promoErr } = await supabase
      .from("promo_code_usage")
      .delete()
      .in("lead_id", ids);
    if (promoErr) {
      setBulkDeleting(false);
      toast({ title: "Error", description: promoErr.message, variant: "destructive" });
      return;
    }

    // 5. Finally delete the leads
    const { error } = await supabase.from("leads").delete().in("id", ids);
    setBulkDeleting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: `${ids.length} lead(s) removed.` });
      setSelected(new Set());
      setConfirmBulkDelete(false);
      onRefresh();
    }
  };

  // Time-based stats
  const timeStats = useMemo(() => {
    const now = new Date();
    const getStart = (period: string) => {
      switch (period) {
        case "today": return startOfDay(now);
        case "week": return startOfWeek(now, { weekStartsOn: 1 });
        case "month": return startOfMonth(now);
        case "year": return startOfYear(now);
        default: return new Date(0);
      }
    };
    const start = getStart(timePeriod);
    const periodLeads = leads.filter((l) => new Date(l.created_at) >= start);
    const soldPeriodLeads = periodLeads.filter((l) => l.sold_status === "sold");
    return {
      total: periodLeads.length,
      available: periodLeads.filter((l) => l.sold_status === "available").length,
      sold: soldPeriodLeads.length,
      revenue: soldPeriodLeads.reduce((sum, l) => sum + Number(l.price), 0),
    };
  }, [leads, timePeriod]);

  return (
    <div className="space-y-4">
      {/* Time Period Stats */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[140px] bg-card border-border h-8 text-xs">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Leads</span>
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-xl font-bold text-foreground">{timeStats.total}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</span>
              <TrendingUp className="h-3.5 w-3.5 text-cyan" />
            </div>
            <p className="text-xl font-bold text-cyan">{timeStats.available}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Sold</span>
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-xl font-bold text-success">{timeStats.sold}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</span>
              <DollarSign className="h-3.5 w-3.5 text-gold" />
            </div>
            <p className="text-xl font-bold text-gold">${timeStats.revenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start">
        <AdminAddLeadDialog onLeadAdded={onRefresh} />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference, name, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage(); }}>
          <SelectTrigger className="w-[150px] bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); resetPage(); }}>
          <SelectTrigger className="w-[130px] bg-card border-border">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={provinceFilter} onValueChange={(v) => { setProvinceFilter(v); resetPage(); }}>
          <SelectTrigger className="w-[170px] bg-card border-border">
            <SelectValue placeholder="Province" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Provinces</SelectItem>
            {provinces.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="text-sm text-foreground font-medium">{selected.size} lead(s) selected</span>
          {!confirmBulkDelete ? (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </Button>
          ) : (
            <>
              <span className="text-sm text-destructive">Are you sure?</span>
              <Button variant="destructive" size="sm" disabled={bulkDeleting} onClick={bulkDelete}>
                {bulkDeleting ? "Deleting…" : "Yes, Delete"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => { setSelected(new Set()); setConfirmBulkDelete(false); }}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleAll}
                    className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    aria-label="Select all on page"
                  />
                </th>
                {([
                  ["reference_code", "Reference"],
                  ["first_name", "Name"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    className="p-3 text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors text-left"
                    onClick={() => toggleSort(field)}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="p-3 text-xs text-muted-foreground font-medium text-left">Phone</th>
                {([
                  ["province", "Location"],
                  ["quality_grade", "Grade"],
                  ["ai_score", "AI Score"],
                  ["price", "Price"],
                  ["sold_status", "Status"],
                  ["created_at", "Created"],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    className={cn(
                      "p-3 text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors",
                      field === "price" ? "text-right" : "text-left"
                    )}
                    onClick={() => toggleSort(field)}
                  >
                    <span className="inline-flex items-center">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((l) => (
                <tr key={l.id} className={cn("hover:bg-muted/20 transition-colors", selected.has(l.id) && "bg-primary/5")}>
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                      className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      aria-label={`Select ${l.reference_code}`}
                    />
                  </td>
                  <td className="p-3 font-mono text-foreground text-xs">{l.reference_code}</td>
                  <td className="p-3 text-foreground">{l.first_name} {l.last_name}</td>
                  <td className="p-3 text-muted-foreground text-xs">{l.phone ?? "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {[l.city, l.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="p-3">
                    <Badge className={cn("border-0 text-[10px]", gradeColors[l.quality_grade ?? ""] ?? "bg-muted text-muted-foreground")}>
                      {l.quality_grade ?? "—"}
                    </Badge>
                  </td>
                  <td className="p-3 text-foreground">{l.ai_score ?? "—"}</td>
                  <td className="p-3 text-right font-mono text-foreground">${Number(l.price).toFixed(2)}</td>
                  <td className="p-3">
                    <Badge variant={l.sold_status === "available" ? "outline" : "secondary"} className="text-[10px]">
                      {l.sold_status}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelectLead(l)}>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">No leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Showing {sorted.length === 0 ? 0 : safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] bg-card border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per page</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (safePage < 3) {
                pageNum = i;
              } else if (safePage > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = safePage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={safePage === pageNum ? "default" : "outline"}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
