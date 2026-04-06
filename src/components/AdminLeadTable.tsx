import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

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

  // Reset page when filters change
  const resetPage = () => setPage(0);

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {([
                  ["reference_code", "Reference"],
                  ["first_name", "Name"],
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
                <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono text-foreground text-xs">{l.reference_code}</td>
                  <td className="p-3 text-foreground">{l.first_name} {l.last_name}</td>
                  <td className="p-3 text-muted-foreground">
                    {l.city && l.province ? `${l.city}, ${l.province}` : l.province ?? "—"}
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
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">No leads found.</td>
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
