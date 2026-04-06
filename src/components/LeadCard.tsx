import { useState, useEffect } from "react";
import { Shield, MapPin, Clock, FileText, User, Home, Monitor, Building2, CheckCircle2, Coins, Lock } from "lucide-react";
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
}

function getLeadType(lead: any): { label: string; icon: React.ReactNode } {
  const grade = lead.quality_grade?.toLowerCase?.() ?? "";
  if (grade === "a+" || grade === "a") return { label: "Credit/Finance Lead", icon: <Building2 className="h-4 w-4" /> };
  if (grade === "b") return { label: "Marketplace Lead", icon: <Home className="h-4 w-4" /> };
  return { label: "Referral Lead", icon: <User className="h-4 w-4" /> };
}

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
  license: { icon: <FileText className="h-3.5 w-3.5" />, short: "DL" },
  paystub: { icon: <Monitor className="h-3.5 w-3.5" />, short: "PS" },
  bank_statement: { icon: <Building2 className="h-3.5 w-3.5" />, short: "BS" },
  credit_report: { icon: <FileText className="h-3.5 w-3.5" />, short: "CR" },
  pre_approval: { icon: <Shield className="h-3.5 w-3.5" />, short: "PA" },
};

export function LeadCard({ lead, locked, unlockAt, onBuy, selected, onSelect, index = 0 }: LeadCardProps) {
  const { remaining, display } = useCountdown(unlockAt);
  const leadType = getLeadType(lead);
  const buyerLabel = lead.buyer_type === "walk-in" ? "In-Store Buyer" : "Online Buyer";
  const buyerIcon = lead.buyer_type === "walk-in" ? <Home className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />;
  const creditRange = lead.credit_range_min != null && lead.credit_range_max != null
    ? `${lead.credit_range_min}-${lead.credit_range_max}`
    : "N/A";
  const location = [lead.city, lead.province].filter(Boolean).join(", ");
  const isLocked = locked && remaining > 0;
  const staggerDelay = `${index * 80}ms`;

  const incomeDisplay = lead.income != null ? `${Number(lead.income).toLocaleString()} LD` : null;

  return (
    <div
      className={cn(
        "glass-card p-5 cursor-pointer relative z-10 flex flex-col",
        selected && "glass-card-selected"
      )}
      style={{ animationDelay: staggerDelay }}
      onClick={() => onSelect?.(lead)}
    >
      <div className="shimmer-sweep" style={{ animationDelay: `${index * 80 + 300}ms` }} />

      {selected && (
        <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Lead type */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-muted-foreground">{leadType.icon}</span>
        <span className="text-sm font-semibold text-foreground">{leadType.label}</span>
      </div>

      {/* Buyer type */}
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        {buyerIcon}
        <span className="text-sm">{buyerLabel}</span>
      </div>

      {/* Credit score — blurred */}
      <div className="flex items-center gap-2 mb-1.5">
        <Shield className="h-4 w-4 text-destructive" />
        <span className="text-xl font-bold text-foreground font-mono-timer select-none" style={{ filter: "blur(6px)" }}>
          {creditRange}
        </span>
        <Lock className="h-3 w-3 text-muted-foreground/60" />
      </div>

      {/* Location — blurred */}
      {location && (
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm select-none" style={{ filter: "blur(5px)" }}>{location}</span>
          <Lock className="h-3 w-3 text-muted-foreground/60" />
        </div>
      )}

      {/* Income — blurred */}
      {incomeDisplay && (
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Coins className="h-4 w-4 text-[hsl(var(--gold))]" />
          <span className="text-sm font-medium font-mono-timer select-none" style={{ filter: "blur(5px)" }}>{incomeDisplay}</span>
          <Lock className="h-3 w-3 text-muted-foreground/60" />
        </div>
      )}

      {/* Spacer to push bottom section down */}
      <div className="flex-1" />

      {/* Bottom section */}
      <div className="pt-3 border-t border-border/50 space-y-3">
        {/* Documents row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(lead.documents ?? []).slice(0, 5).map((d: string, i: number) => (
            <span
              key={i}
              className="h-7 px-1.5 rounded border border-border/60 flex items-center justify-center text-muted-foreground gap-1"
              title={d}
            >
              {docLabels[d]?.icon ?? <FileText className="h-3.5 w-3.5" />}
            </span>
          ))}
          {lead.ai_score != null && (
            <span className="badge-blue text-[10px] font-bold px-2 py-1 rounded ml-auto font-mono-timer tracking-wider">
              AI SCORE {lead.ai_score}
            </span>
          )}
        </div>

        {/* Action row */}
        {isLocked ? (
          <div className="flex items-center justify-between">
            <span className="badge-amber text-xs font-medium px-2.5 py-1.5 rounded flex items-center gap-1.5 font-mono-timer">
              <Clock className="h-3 w-3" /> Unlocks in {display}
            </span>
            <button
              className="gradient-cta-buy text-foreground px-5 py-2 rounded text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
            >
              BUY LEAD &nbsp;&rsaquo;
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="badge-green text-xs font-medium px-2 py-1 rounded whitespace-nowrap">Available Now</span>
            <button
              className="gradient-cta-buy text-foreground px-5 py-2 rounded text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
            >
              BUY LEAD &nbsp;&rsaquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
