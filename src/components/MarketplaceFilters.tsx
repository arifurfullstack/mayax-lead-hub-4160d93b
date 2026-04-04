import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
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

const buyerTypeOptions = ["online", "walk-in", "referral"];
const provinceOptions = ["Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", "Saskatchewan", "Nova Scotia", "Newfoundland"];
const documentOptions = ["license", "paystub", "bank_statement"];
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

function FilterContent({ filters, onChange, onReset, activeCount }: FilterSidebarProps) {
  const update = (partial: Partial<MarketplaceFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleArray = (key: keyof MarketplaceFilters, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    update({ [key]: next });
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Credit Score */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">
          Credit Score Range
        </Label>
        <Slider
          min={300}
          max={900}
          step={10}
          value={[filters.creditMin, filters.creditMax]}
          onValueChange={([min, max]) => update({ creditMin: min, creditMax: max })}
          className="mt-3"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{filters.creditMin}</span>
          <span>{filters.creditMax}</span>
        </div>
      </div>

      {/* Income */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Income Range</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Min"
            type="number"
            value={filters.incomeMin}
            onChange={(e) => update({ incomeMin: e.target.value })}
            className="bg-card border-border h-8 text-xs"
          />
          <Input
            placeholder="Max"
            type="number"
            value={filters.incomeMax}
            onChange={(e) => update({ incomeMax: e.target.value })}
            className="bg-card border-border h-8 text-xs"
          />
        </div>
      </div>

      {/* Buyer Type */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Buyer Type</Label>
        <div className="space-y-2">
          {buyerTypeOptions.map((bt) => (
            <label key={bt} className="flex items-center gap-2 cursor-pointer text-foreground">
              <Checkbox
                checked={filters.buyerTypes.includes(bt)}
                onCheckedChange={() => toggleArray("buyerTypes", bt)}
              />
              <span className="capitalize">{bt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Province */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Province</Label>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {provinceOptions.map((p) => (
            <label key={p} className="flex items-center gap-2 cursor-pointer text-foreground">
              <Checkbox
                checked={filters.provinces.includes(p)}
                onCheckedChange={() => toggleArray("provinces", p)}
              />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Documents</Label>
        <div className="space-y-2">
          {documentOptions.map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer text-foreground">
              <Checkbox
                checked={filters.documents.includes(d)}
                onCheckedChange={() => toggleArray("documents", d)}
              />
              <span className="capitalize">{d.replace("_", " ")}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vehicle Type */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Vehicle Type</Label>
        <Select value={filters.vehicleType} onValueChange={(v) => update({ vehicleType: v })}>
          <SelectTrigger className="bg-card border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {vehicleTypes.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lead Age */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Lead Age</Label>
        <Select value={filters.maxAge} onValueChange={(v) => update({ maxAge: v })}>
          <SelectTrigger className="bg-card border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ageOptions.map((a) => (
              <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div>
        <Label className="text-muted-foreground text-xs uppercase mb-2 block">Price Range</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Min"
            type="number"
            value={filters.priceMin}
            onChange={(e) => update({ priceMin: e.target.value })}
            className="bg-card border-border h-8 text-xs"
          />
          <Input
            placeholder="Max"
            type="number"
            value={filters.priceMax}
            onChange={(e) => update({ priceMax: e.target.value })}
            className="bg-card border-border h-8 text-xs"
          />
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="outline" size="sm" onClick={onReset} className="w-full text-xs">
          <X className="h-3 w-3 mr-1" /> Clear All Filters
        </Button>
      )}
    </div>
  );
}

export function MarketplaceFilterDrawer(props: FilterSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 relative">
          <Filter className="h-3.5 w-3.5" /> Filters
          {props.activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              {props.activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="glass border-border overflow-y-auto">
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
