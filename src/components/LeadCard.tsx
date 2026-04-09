import { useState, useEffect } from "react";
import { Shield, MapPin, Clock, FileText, User, Home, Monitor, Building2, CheckCircle2, DollarSign, Lock, Car, Gauge, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadCardProps {
  lead: any;
  locked: boolean;
  unlockAt: number;
  onBuy: (lead: any) => void;
  selected?: boolean;
  onSelect?: (lead: any) => void;
  index?: number;
  promoPrice?: number | null;
  promoType?: "flat" | "percentage" | null;
}

function getLeadType(lead: any): { label: string; icon: React.ReactNode } {
  const grade = lead.quality_grade?.toLowerCase?.() ?? "";
  if (grade === "a+" || grade === "a") return { label: "Credit/Finance Lead", icon: <Building2 className="h-3.5 w-3.5" /> };
  if (grade === "b") return { label: "Marketplace Lead", icon: <Home className="h-3.5 w-3.5" /> };
  return { label: "Referral Lead", icon: <User className="h-3.5 w-3.5" /> };
}

const gradeColors: Record<string, string> = {
  "a+": "border-[hsl(var(--gold))] text-[hsl(var(--gold))] bg-[hsl(var(--gold))/0.1]",
  a: "border-emerald-500 text-emerald-400 bg-emerald-500/10",
  "b+": "border-teal-500 text-teal-400 bg-teal-500/10",
  b: "border-sky-500 text-sky-400 bg-sky-500/10",
  "c+": "border-indigo-400 text-indigo-300 bg-indigo-500/10",
  c: "border-muted-foreground text-muted-foreground bg-muted/30",
  "d+": "border-orange-500 text-orange-400 bg-orange-500/10",
  d: "border-red-500/60 text-red-400/80 bg-red-500/10",
};

function useCountdown(targetMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (targetMs <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [targetMs]);
  const diff = Math.max(0, targetMs - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return { remaining: diff, display: `${h}h ${String(m).padStart(2, "0")}m` };
  return { remaining: diff, display: `${m}m` };
}

const docLabels: Record<string, { icon: React.ReactNode; short: string }> = {
  license: { icon: <FileText className="h-3 w-3" />, short: "DL" },
  paystub: { icon: <Monitor className="h-3 w-3" />, short: "PS" },
  bank_statement: { icon: <Building2 className="h-3 w-3" />, short: "BS" },
  credit_report: { icon: <FileText className="h-3 w-3" />, short: "CR" },
  pre_approval: { icon: <Shield className="h-3 w-3" />, short: "PA" },
};

function isRevealed(lead: any): boolean {
  return lead.first_name !== "***" && lead.email !== "xxx@xxxx.com";
}

export function LeadCard({ lead, locked, unlockAt, onBuy, selected, onSelect, index = 0, promoPrice, promoType }: LeadCardProps) {
  const { remaining, display } = useCountdown(unlockAt);
  const leadType = getLeadType(lead);
  const buyerLabel = lead.buyer_type === "walk-in" ? "In-Store Buyer" : "Online Buyer";
  const buyerIcon = lead.buyer_type === "walk-in" ? <Home className="h-3 w-3" /> : <User className="h-3 w-3" />;
  const creditRange = lead.credit_range_min != null && lead.credit_range_max != null
    ? `${lead.credit_range_min}-${lead.credit_range_max}`
    : "N/A";
  const location = [lead.city, lead.province].filter(Boolean).join(", ");
  const isLocked = locked && remaining > 0;
  const staggerDelay = `${index * 80}ms`;
  const revealed = isRevealed(lead);
  const incomeDisplay = lead.income != null ? `$${Number(lead.income).toLocaleString()}` : null;

  return (
    <div
      className={cn(
        "glass-card p-3.5 cursor-pointer relative z-10 flex flex-col",
        selected && "glass-card-selected"
      )}
      style={{ animationDelay: staggerDelay }}
      onClick={() => onSelect?.(lead)}
    >
      <div className="shimmer-sweep" style={{ animationDelay: `${index * 80 + 300}ms` }} />

      {selected && (
        <div className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}

      {/* Lead type + grade badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{leadType.icon}</span>
        <span className="text-xs font-semibold text-foreground">{leadType.label}</span>
        {lead.reference_code && (
          <span className="text-[9px] text-muted-foreground font-mono-timer">#{lead.reference_code}</span>
        )}
        {lead.quality_grade && (
          <span className={cn(
            "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider font-mono-timer",
            gradeColors[lead.quality_grade.toLowerCase()] ?? gradeColors.c
          )}>
            {lead.quality_grade}
          </span>
        )}
      </div>

      {/* Contact info — blurred until purchased, at the top */}
      <div className="space-y-0.5 mb-1.5">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className={cn("text-xs font-medium", revealed ? "text-foreground" : "text-muted-foreground select-none")} style={!revealed ? { filter: "blur(5px)" } : undefined}>
            {lead.first_name} {lead.last_name?.charAt(0)}.
          </span>
          {!revealed && <Tooltip><TooltipTrigger asChild><Lock className="h-2.5 w-2.5 text-muted-foreground/60 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Purchase to reveal</TooltipContent></Tooltip>}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
          {revealed ? (
            <span className="text-xs truncate min-w-0 text-foreground">{lead.phone}</span>
          ) : lead.phone ? (
            <>
              <span className="text-xs text-foreground">{lead.phone.slice(0, -7)}</span>
              <span className="text-xs text-muted-foreground select-none">{"*".repeat(Math.min(7, lead.phone.length))}</span>
              <Tooltip><TooltipTrigger asChild><Lock className="h-2.5 w-2.5 text-muted-foreground/60 cursor-help shrink-0" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Purchase to reveal</TooltipContent></Tooltip>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className={cn("text-xs truncate min-w-0", revealed ? "text-foreground" : "text-muted-foreground select-none")} style={!revealed ? { filter: "blur(5px)" } : undefined}>
            {lead.email}
          </span>
          {!revealed && <Tooltip><TooltipTrigger asChild><Lock className="h-2.5 w-2.5 text-muted-foreground/60 cursor-help shrink-0" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Purchase to reveal</TooltipContent></Tooltip>}
        </div>
      </div>

      {/* Buyer type */}
      <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
        {buyerIcon}
        <span className="text-xs">{buyerLabel}</span>
      </div>

      {/* Vehicle preference */}
      {lead.vehicle_preference && (
        <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
          <Car className="h-3.5 w-3.5" />
          <span className="text-xs truncate">{lead.vehicle_preference}</span>
        </div>
      )}

      {/* Trade-In */}
      {lead.trade_in && (
        <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
          <Car className="h-3.5 w-3.5" />
          <span className="text-xs text-emerald-400 font-medium">Trade-In</span>
        </div>
      )}

      {/* Vehicle mileage */}
      {lead.vehicle_mileage != null && (
        <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          <span className="text-xs font-mono-timer">{Number(lead.vehicle_mileage).toLocaleString()} km</span>
        </div>
      )}

      {/* Location */}
      {location && (
        <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="text-xs">{location}</span>
        </div>
      )}

      {/* Income */}
      {incomeDisplay && (
        <div className="flex items-center gap-1.5 mb-0.5 text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          <span className="text-xs">{incomeDisplay}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="pt-2 border-t border-border/50 space-y-1.5">
        {/* Documents row */}
        <div className="flex items-center gap-1 flex-wrap">
          {(lead.documents ?? []).slice(0, 5).map((d: string, i: number) => (
            <span
              key={i}
              className="h-6 px-1 rounded border border-border/60 flex items-center justify-center text-muted-foreground gap-0.5"
              title={d}
            >
              {docLabels[d]?.icon ?? <FileText className="h-3 w-3" />}
            </span>
          ))}
          {lead.ai_score != null && (
            <span className="badge-blue text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto font-mono-timer tracking-wider">
              AI {lead.ai_score}
            </span>
          )}
        </div>

        {/* Status + Price + Buy row */}
        <div className="flex items-center justify-between">
          {isLocked ? (
            <span className="badge-amber text-[10px] font-medium px-2 py-1 rounded flex items-center gap-1 font-mono-timer">
              <Clock className="h-2.5 w-2.5" /> {display}
            </span>
          ) : (
            <span className="badge-green text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">Available</span>
          )}
          <div className="flex items-center gap-2">
            {promoPrice != null ? (
              <>
                {promoType === "percentage" && (
                  <span className="text-xs text-muted-foreground line-through font-mono-timer">${Number(lead.price).toFixed(0)}</span>
                )}
                <span className={cn("text-base font-bold font-mono-timer", promoType === "percentage" ? "text-primary" : "text-foreground")}>${promoPrice.toFixed(0)}</span>
              </>
            ) : (
              <span className="text-base font-bold text-foreground font-mono-timer">${Number(lead.price).toFixed(0)}</span>
            )}
            <button
              className="gradient-cta-buy text-foreground px-4 py-1.5 rounded text-[10px] font-semibold tracking-wide hover:opacity-90 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
            >
              BUY &nbsp;&rsaquo;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
