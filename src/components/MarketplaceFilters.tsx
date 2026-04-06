import { useState } from "react";
import { Filter, X, ChevronDown, ChevronRight, Coins } from "lucide-react";
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
import { cn } from "@/lib/utils";

export interface MarketplaceFilters {
  creditMin: number;
  creditMax: number;
  incomeMin: string;
  incomeMax: string;
  buyerTypes: string[];
  provinces: string[];
  documents: string[];
  vehicleType: string;
  maxAge: string;
  priceMin: string;
  priceMax: string;
}

export const defaultFilters: MarketplaceFilters = {
  creditMin: 300,
  creditMax: 900,
  incomeMin: "",
  incomeMax: "",
  buyerTypes: [],
  provinces: [],
  documents: [],
  vehicleType: "all",
  maxAge: "all",
  priceMin: "",
  priceMax: "",
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

interface FilterSidebarProps {
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
  onReset: () => void;
  activeCount: number;
}

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold text-gray-800 hover:text-gray-600">
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FilterContent({ filters, onChange, onReset, activeCount }: FilterSidebarProps) {
  const update = (partial: Partial<MarketplaceFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleArray = (key: keyof MarketplaceFilters, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    update({ [key]: next });
  };

  return (
    <div className="space-y-5 text-sm">
      {/* Credit Range */}
      <div>
        <p className="font-semibold text-gray-800 mb-3">Credit Range</p>
        <div className="relative">
          <Slider
            min={300}
            max={900}
            step={10}
            value={[filters.creditMin, filters.creditMax]}
            onValueChange={([min, max]) => update({ creditMin: min, creditMax: max })}
            className="marketplace-slider"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{filters.creditMin}</span>
          <span>{filters.creditMax}</span>
        </div>
      </div>

      {/* Income Range */}
      <div>
        <p className="font-semibold text-gray-800 mb-2">Income Range</p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Coins className="h-4 w-4 text-amber-500" />
          <span>500 LD</span>
          <div className="flex gap-1 ml-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={cn("w-2 h-2 rounded-full", i <= 3 ? "bg-gray-400" : "bg-gray-200")} />
            ))}
          </div>
        </div>
      </div>

      {/* Documents Uploaded */}
      <div>
        <p className="font-semibold text-gray-800 mb-3">Documents Uploaded</p>
        <div className="space-y-2.5">
          {documentOptions.map((d) => (
            <label key={d.value} className="flex items-center gap-2.5 cursor-pointer text-gray-700">
              <Checkbox
                checked={filters.documents.includes(d.value)}
                onCheckedChange={() => toggleArray("documents", d.value)}
                className="border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <span className="text-sm">{d.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="border-t border-gray-200 pt-3 space-y-1">
        <CollapsibleSection title="Location">
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {provinceOptions.map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer text-gray-700 text-sm">
                <Checkbox
                  checked={filters.provinces.includes(p)}
                  onCheckedChange={() => toggleArray("provinces", p)}
                  className="border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Vehicle">
          <div className="space-y-2">
            {vehicleTypes.map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-gray-700 text-sm">
                <Checkbox
                  checked={filters.vehicleType === v}
                  onCheckedChange={() => update({ vehicleType: filters.vehicleType === v ? "all" : v })}
                  className="border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <span>{v}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Lead Age">
          <div className="space-y-2">
            {ageOptions.map((a) => (
              <label key={a.value} className="flex items-center gap-2 cursor-pointer text-gray-700 text-sm">
                <Checkbox
                  checked={filters.maxAge === a.value}
                  onCheckedChange={() => update({ maxAge: filters.maxAge === a.value ? "all" : a.value })}
                  className="border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Clear Filters */}
      <div className="pt-3 border-t border-gray-200">
        <button
          onClick={onReset}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
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
    <aside className="w-[280px] shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-fit sticky top-4 hidden lg:block">
      <h2 className="text-lg font-bold text-gray-800 mb-5">Filters</h2>
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
            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {props.activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white border-gray-200 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-gray-800">Filter Leads</SheetTitle>
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
  if (f.creditMin !== 300 || f.creditMax !== 900) count++;
  if (f.incomeMin || f.incomeMax) count++;
  if (f.buyerTypes.length) count++;
  if (f.provinces.length) count++;
  if (f.documents.length) count++;
  if (f.vehicleType !== "all") count++;
  if (f.maxAge !== "all") count++;
  if (f.priceMin || f.priceMax) count++;
  return count;
}

export function applyFilters(leads: any[], filters: MarketplaceFilters): any[] {
  let result = leads;

  if (filters.creditMin !== 300 || filters.creditMax !== 900) {
    result = result.filter(
      (l) => (l.credit_range_min ?? 0) >= filters.creditMin && (l.credit_range_max ?? 900) <= filters.creditMax
    );
  }

  if (filters.incomeMin) {
    result = result.filter((l) => (l.income ?? 0) >= Number(filters.incomeMin));
  }
  if (filters.incomeMax) {
    result = result.filter((l) => (l.income ?? 0) <= Number(filters.incomeMax));
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

  if (filters.vehicleType !== "all") {
    result = result.filter((l) =>
      l.vehicle_preference?.toLowerCase().includes(filters.vehicleType.toLowerCase())
    );
  }

  if (filters.maxAge !== "all") {
    const cutoff = new Date(Date.now() - Number(filters.maxAge) * 24 * 60 * 60 * 1000).toISOString();
    result = result.filter((l) => l.created_at > cutoff);
  }

  if (filters.priceMin) {
    result = result.filter((l) => l.price >= Number(filters.priceMin));
  }
  if (filters.priceMax) {
    result = result.filter((l) => l.price <= Number(filters.priceMax));
  }

  return result;
}
