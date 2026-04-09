import { useState, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MarketplaceFilters {
  creditMin: number;
  creditMax: number;
  incomeMin: number;
  incomeMax: number;
  buyerTypes: string[];
  provinces: string[];
  documents: string[];
  grades: string[];
  vehicleSearch: string;
  maxAge: string;
  priceMin: number;
  priceMax: number;
}

export const defaultFilters: MarketplaceFilters = {
  creditMin: 300,
  creditMax: 900,
  incomeMin: 0,
  incomeMax: 0,
  buyerTypes: [],
  provinces: [],
  documents: [],
  grades: [],
  vehicleSearch: "",
  maxAge: "all",
  priceMin: 0,
  priceMax: 0,
};

const documentOptions = [
  { value: "license", label: "Driver License" },
  { value: "paystub", label: "Paystubs" },
  { value: "bank_statement", label: "Bank Statements" },
  { value: "credit_report", label: "Credit Report" },
  { value: "pre_approval", label: "Pre-Approval Cert." },
];

const provinceOptions = ["Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", "Saskatchewan", "Nova Scotia", "Newfoundland"];
const vehicleTypes = ["SUV", "Sedan", "Truck", "Compact", "Luxury"];
const ageOptions = [
  { value: "all", label: "Any Age" },
  { value: "1", label: "< 1 day" },
  { value: "3", label: "< 3 days" },
  { value: "7", label: "< 7 days" },
  { value: "14", label: "< 14 days" },
  { value: "30", label: "< 30 days" },
];

/** Parse "SUV - Ford Escape" → { type, make, model } */
function parseVehiclePref(vp: string | null): { type: string; make: string; model: string } {
  if (!vp) return { type: "", make: "", model: "" };
  const parts = vp.split(" - ");
  const type = parts[0]?.trim() ?? "";
  const rest = parts[1]?.trim() ?? "";
  const words = rest.split(" ");
  const make = words[0] ?? "";
  const model = words.slice(1).join(" ") ?? "";
  return { type, make, model };
}

interface FilterSidebarProps {
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
  onReset: () => void;
  activeCount: number;
  maxIncome: number;
  maxPrice: number;
  leads: any[];
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors">
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FilterContent({ filters, onChange, onReset, activeCount, maxIncome, maxPrice, leads }: FilterSidebarProps) {
  const update = (partial: Partial<MarketplaceFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleArray = (key: keyof MarketplaceFilters, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    update({ [key]: next });
  };

  const effectiveIncomeMax = maxIncome || 200000;
  const sliderIncomeMax = filters.incomeMax === 0 ? effectiveIncomeMax : filters.incomeMax;

  const effectivePriceMax = maxPrice || 500;
  const sliderPriceMax = filters.priceMax === 0 ? effectivePriceMax : filters.priceMax;

  // Derive unique vehicle preferences from leads for search suggestions
  const vehicleOptions = useMemo(() => {
    const prefs = leads.map((l) => l.vehicle_preference).filter(Boolean) as string[];
    return [...new Set(prefs)].sort();
  }, [leads]);

  const filteredVehicleOptions = useMemo(() => {
    if (!filters.vehicleSearch) return [];
    const q = filters.vehicleSearch.toLowerCase();
    return vehicleOptions.filter((v) => v.toLowerCase().includes(q)).slice(0, 8);
  }, [vehicleOptions, filters.vehicleSearch]);

  return (
    <div className="space-y-5 text-sm">
      {/* Income Range — dual slider */}
      <div>
        <p className="font-semibold text-foreground mb-3">Income Range</p>
        <Slider
          min={0}
          max={effectiveIncomeMax}
          step={1000}
          value={[filters.incomeMin, sliderIncomeMax]}
          onValueChange={([min, max]) => update({ incomeMin: min, incomeMax: max })}
          className="marketplace-slider"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>${filters.incomeMin.toLocaleString()}</span>
          <span>${sliderIncomeMax.toLocaleString()}</span>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <p className="font-semibold text-foreground mb-3">Lead Price</p>
        <Slider
          min={0}
          max={effectivePriceMax}
          step={5}
          value={[filters.priceMin, sliderPriceMax]}
          onValueChange={([min, max]) => update({ priceMin: min, priceMax: max })}
          className="marketplace-slider"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>${filters.priceMin}</span>
          <span>${sliderPriceMax}</span>
        </div>
      </div>

      {/* Quality Grade */}
      <CollapsibleSection title="Quality Grade" defaultOpen={filters.grades.length > 0}>
        <div className="space-y-2.5">
          {["A+", "A", "B", "C"].map((g) => (
            <label key={g} className="flex items-center gap-2.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Checkbox
                checked={filters.grades.includes(g)}
                onCheckedChange={() => toggleArray("grades", g)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm">{g}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Documents Uploaded */}
      <CollapsibleSection title="Documents Uploaded">
        <div className="space-y-2.5">
          {documentOptions.map((d) => (
            <label key={d.value} className="flex items-center gap-2.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Checkbox
                checked={filters.documents.includes(d.value)}
                onCheckedChange={() => toggleArray("documents", d.value)}
                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm">{d.label}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Collapsible sections */}
      <div className="border-t border-border pt-3 space-y-1">
        <CollapsibleSection title="Location">
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {provinceOptions.map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer text-muted-foreground text-sm hover:text-foreground transition-colors">
                <Checkbox
                  checked={filters.provinces.includes(p)}
                  onCheckedChange={() => toggleArray("provinces", p)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Vehicle" defaultOpen={filters.vehicleSearch.length > 0}>
          <div className="space-y-2">
            <Input
              placeholder="Search vehicle preference..."
              value={filters.vehicleSearch}
              onChange={(e) => update({ vehicleSearch: e.target.value })}
              className="h-8 text-xs bg-background/50 border-border/60"
            />
            {filters.vehicleSearch && filteredVehicleOptions.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filteredVehicleOptions.map((v) => (
                  <button
                    key={v}
                    onClick={() => update({ vehicleSearch: v })}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent/50 transition-colors",
                      filters.vehicleSearch === v ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Lead Age">
          <div className="space-y-2">
            {ageOptions.map((a) => (
              <label key={a.value} className="flex items-center gap-2 cursor-pointer text-muted-foreground text-sm hover:text-foreground transition-colors">
                <Checkbox
                  checked={filters.maxAge === a.value}
                  onCheckedChange={() => update({ maxAge: filters.maxAge === a.value ? "all" : a.value })}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Clear Filters */}
      <div className="pt-3 border-t border-border">
        <button
          onClick={onReset}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          <span>Clear Filters</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Persistent sidebar for desktop */
export function MarketplaceFilterSidebar(props: FilterSidebarProps) {
  return (
    <aside className="w-[280px] shrink-0 glass-card p-5 h-fit sticky top-4 hidden lg:block">
      <h2 className="text-lg font-bold text-foreground mb-5">Filters</h2>
      <FilterContent {...props} />
    </aside>
  );
}

/** Mobile drawer */
export function MarketplaceFilterDrawer(props: FilterSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 relative lg:hidden">
          <Filter className="h-3.5 w-3.5" /> Filters
          {props.activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {props.activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">Filter Leads</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <FilterContent {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function countActiveFilters(f: MarketplaceFilters): number {
  let count = 0;
  if (f.incomeMin > 0 || (f.incomeMax > 0)) count++;
  if (f.buyerTypes.length) count++;
  if (f.provinces.length) count++;
  if (f.documents.length) count++;
  if (f.grades.length) count++;
  if (f.vehicleSearch) count++;
  if (f.maxAge !== "all") count++;
  if (f.priceMin > 0 || f.priceMax > 0) count++;
  return count;
}

export function applyFilters(leads: any[], filters: MarketplaceFilters, maxIncome?: number): any[] {
  let result = leads;

  if (filters.incomeMin > 0) {
    result = result.filter((l) => (l.income ?? 0) >= filters.incomeMin);
  }
  if (filters.incomeMax > 0 && filters.incomeMax < (maxIncome || Infinity)) {
    result = result.filter((l) => (l.income ?? 0) <= filters.incomeMax);
  }

  if (filters.buyerTypes.length) {
    result = result.filter((l) => filters.buyerTypes.includes(l.buyer_type));
  }

  if (filters.provinces.length) {
    result = result.filter((l) => filters.provinces.includes(l.province));
  }

  if (filters.documents.length) {
    result = result.filter((l) =>
      filters.documents.every((d) => (l.documents ?? []).includes(d))
    );
  }

  // Vehicle search filter — matches against vehicle_preference string
  if (filters.vehicleSearch) {
    const q = filters.vehicleSearch.toLowerCase();
    result = result.filter((l) =>
      (l.vehicle_preference ?? "").toLowerCase().includes(q)
    );
  }

  if (filters.maxAge !== "all") {
    const cutoff = new Date(Date.now() - Number(filters.maxAge) * 24 * 60 * 60 * 1000).toISOString();
    result = result.filter((l) => l.created_at > cutoff);
  }

  if (filters.priceMin > 0) {
    result = result.filter((l) => Number(l.price) >= filters.priceMin);
  }
  if (filters.priceMax > 0) {
    result = result.filter((l) => Number(l.price) <= filters.priceMax);
  }

  if (filters.grades.length) {
    result = result.filter((l) => filters.grades.includes(l.quality_grade));
  }

  return result;
}
