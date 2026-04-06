import { useState, useEffect } from "react";
import { Shield, MapPin, Clock, FileText, User, Home, Monitor, Building2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const docIcons: Record<string, React.ReactNode> = {
  license: <FileText className="h-3.5 w-3.5" />,
  paystub: <Monitor className="h-3.5 w-3.5" />,
  bank_statement: <Building2 className="h-3.5 w-3.5" />,
  credit_report: <FileText className="h-3.5 w-3.5" />,
  pre_approval: <Shield className="h-3.5 w-3.5" />,
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

  return (
    <div
      className={cn(
        "glass-card p-5 cursor-pointer relative z-10",
        selected && "glass-card-selected"
      )}
      style={{ animationDelay: staggerDelay }}
      onClick={() => onSelect?.(lead)}
    >
      {/* Shimmer sweep on entrance */}
      <div className="shimmer-sweep" style={{ animationDelay: `${index * 80 + 300}ms` }} />

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      {/* Lead type label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{leadType.icon}</span>
        <span className="text-sm font-semibold text-foreground">{leadType.label}</span>
      </div>

      {/* Buyer type */}
      <div className="flex items-center gap-2 mb-4 text-muted-foreground">
        {buyerIcon}
        <span className="text-sm">{buyerLabel}</span>
      </div>

      {/* Credit score — large & bold */}
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-destructive" />
        <span className="text-xl font-bold text-foreground font-mono-timer">{creditRange}</span>
      </div>

      {/* Location */}
      {location && (
        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">{location}</span>
        </div>
      )}

      {/* Bottom section: docs + action */}
      <div className="flex items-end justify-between mt-auto pt-3 border-t border-border/50">
        {/* Documents row */}
        <div className="flex items-center gap-1.5">
          {(lead.documents ?? []).slice(0, 5).map((d: string, i: number) => (
            <span
              key={i}
              className="w-7 h-7 rounded border border-border/60 flex items-center justify-center text-muted-foreground"
              title={d}
            >
              {docIcons[d] ?? <FileText className="h-3.5 w-3.5" />}
            </span>
          ))}
        </div>

        {/* Right side: price + action */}
        <div className="flex flex-col items-end gap-1.5">
          {isLocked ? (
            <>
              <span className="badge-amber text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono-timer">
                <Clock className="h-3 w-3" /> Unlocks in {display}
              </span>
              <span className="text-lg font-bold text-foreground font-mono-timer">${Number(lead.price).toFixed(0)}</span>
            </>
          ) : (
            <>
              {lead.ai_score != null && (
                <span className="badge-blue text-xs font-medium px-2.5 py-1 rounded-md font-mono-timer">
                  AI SCORE {lead.ai_score}
                </span>
              )}
              <span className="badge-green text-xs font-medium px-2 py-0.5 rounded-md mb-1">Available Now</span>
              <button
                className="gradient-cta-buy text-foreground px-5 py-2 rounded-lg text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
              >
                BUY LEAD &nbsp;&rsaquo;
              </button>
            </>
          )}
        </div>
      </div>

      {/* Price shown large for available leads without AI score */}
      {!isLocked && lead.ai_score == null && (
        <div className="absolute bottom-5 right-5">
          <span className="text-lg font-bold text-foreground font-mono-timer">${Number(lead.price).toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}
