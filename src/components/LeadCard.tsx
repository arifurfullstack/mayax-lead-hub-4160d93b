import { useState, useEffect } from "react";
import { Shield, MapPin, Clock, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: any;
  locked: boolean;
  unlockAt: number;
  onBuy: (lead: any) => void;
  selected?: boolean;
  onSelect?: (lead: any) => void;
}

function getLeadType(lead: any): { label: string; color: string } {
  const grade = lead.quality_grade?.toLowerCase?.() ?? "";
  if (grade === "a+" || grade === "a") return { label: "Credit/Finance Lead", color: "text-emerald-400" };
  if (grade === "b") return { label: "Marketplace Lead", color: "text-blue-400" };
  return { label: "Referral Lead", color: "text-amber-400" };
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
  return { remaining: diff, display: `${h}h ${String(m).padStart(2, "0")}m` };
}

const docIcons: Record<string, string> = {
  license: "🪪",
  paystub: "📊",
  bank_statement: "🏦",
  credit_report: "📋",
  pre_approval: "✅",
};

export function LeadCard({ lead, locked, unlockAt, onBuy, selected, onSelect }: LeadCardProps) {
  const { remaining, display } = useCountdown(unlockAt);
  const leadType = getLeadType(lead);
  const initials = `${(lead.first_name?.[0] ?? "").toUpperCase()}${(lead.last_name?.[0] ?? "").toUpperCase()}`;
  const buyerLabel = lead.buyer_type === "walk-in" ? "In-Store Buyer" : "Online Buyer";
  const creditRange = lead.credit_range_min != null && lead.credit_range_max != null
    ? `${lead.credit_range_min}-${lead.credit_range_max}`
    : "N/A";
  const location = [lead.city, lead.province].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "glass-card p-5 cursor-pointer transition-all duration-200 hover:border-white/20",
        selected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect?.(lead)}
    >
      {/* Lead type label */}
      <p className={cn("text-xs font-semibold uppercase tracking-wider mb-3", leadType.color)}>
        {leadType.label}
      </p>

      {/* Avatar + Name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground text-sm font-bold">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{initials}</p>
          <p className="text-xs text-muted-foreground">{buyerLabel}</p>
        </div>
      </div>

      {/* Credit + Location */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{creditRange}</span>
        </div>
        {location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Documents + AI Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {(lead.documents ?? []).slice(0, 4).map((d: string, i: number) => (
            <span key={i} className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs" title={d}>
              {docIcons[d] ?? <FileText className="h-3 w-3 text-muted-foreground" />}
            </span>
          ))}
        </div>
        {lead.ai_score != null && (
          <span className="text-xs text-muted-foreground font-mono-timer">
            AI SCORE <span className="text-foreground font-semibold">{lead.ai_score}</span> &gt;
          </span>
        )}
      </div>

      {/* Price + Action */}
      {locked && remaining > 0 ? (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Unlocks in {display}
          </span>
          <span className="text-lg font-bold text-foreground font-mono-timer">${Number(lead.price).toFixed(0)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-emerald-400 font-medium">Available Now</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground font-mono-timer">${Number(lead.price).toFixed(0)}</span>
            <button
              className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
            >
              BUY LEAD &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
