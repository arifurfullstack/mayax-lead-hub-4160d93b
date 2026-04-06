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

function getGrade(creditMin: number | null): { grade: string; color: string; bg: string; border: string; avatar: string } {
  const score = creditMin ?? 0;
  if (score >= 700) return { grade: "A+", color: "text-green-700", bg: "bg-green-100", border: "border-l-green-500", avatar: "bg-green-600" };
  if (score >= 650) return { grade: "A", color: "text-blue-700", bg: "bg-blue-100", border: "border-l-blue-500", avatar: "bg-blue-600" };
  if (score >= 580) return { grade: "B", color: "text-amber-700", bg: "bg-amber-100", border: "border-l-amber-400", avatar: "bg-amber-500" };
  return { grade: "C", color: "text-gray-600", bg: "bg-gray-200", border: "border-l-gray-400", avatar: "bg-gray-500" };
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
  const gradeInfo = getGrade(lead.credit_range_min);
  const initials = `${(lead.first_name?.[0] ?? "").toUpperCase()}${(lead.last_name?.[0] ?? "").toUpperCase()}`;
  const buyerLabel = lead.buyer_type === "walk-in" ? "In-Store Buyer" : "Online Buyer";
  const creditRange = lead.credit_range_min != null && lead.credit_range_max != null
    ? `${lead.credit_range_min}-${lead.credit_range_max}`
    : "N/A";
  const location = [lead.city, lead.province].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "relative rounded-xl border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer",
        gradeInfo.border,
        selected && "ring-2 ring-green-500"
      )}
      onClick={() => onSelect?.(lead)}
    >
      {/* Grade badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("text-lg font-bold", gradeInfo.color)}>{gradeInfo.grade}</span>
        {gradeInfo.grade === "A+" && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700 font-medium">
            A+ Verified
          </span>
        )}
      </div>

      {/* Avatar + Name */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold", gradeInfo.avatar)}>
          {initials}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{initials}</p>
          <p className="text-xs text-gray-500">{buyerLabel}</p>
        </div>
      </div>

      {/* Credit + Location */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <Shield className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-medium">{creditRange}</span>
        </div>
        {location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPin className="h-3.5 w-3.5 text-green-500" />
            <span>{location}</span>
          </div>
        )}
      </div>

      {/* Documents + AI Score + Price row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {(lead.documents ?? []).slice(0, 3).map((d: string, i: number) => (
            <span key={i} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs" title={d}>
              {docIcons[d] ?? <FileText className="h-3 w-3 text-gray-400" />}
            </span>
          ))}
        </div>
        {lead.ai_score != null && (
          <span className="text-xs text-gray-500 font-mono">
            AI SCORE <span className="text-gray-800 font-semibold">{lead.ai_score}</span> &gt;
          </span>
        )}
        <span className="font-semibold text-gray-800">${Number(lead.price).toFixed(0)}</span>
      </div>

      {/* Status + Action */}
      {locked && remaining > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Unlocks in {display}
            </span>
            <span className="font-semibold text-gray-800">${Number(lead.price).toFixed(0)}</span>
          </div>
          <button
            className={cn(
              "w-full py-2 rounded-lg text-sm font-semibold border transition-colors",
              gradeInfo.grade === "A+" || gradeInfo.grade === "A"
                ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                : "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
            )}
            onClick={(e) => { e.stopPropagation(); }}
          >
            Upgrade to Unlock {gradeInfo.grade !== "A+" && `$5`}
            {(gradeInfo.grade === "A+" || gradeInfo.grade === "A") && " >"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              Available Now
            </span>
          </div>
          <button
            className="w-full py-2 rounded-lg text-sm font-semibold bg-green-700 text-white hover:bg-green-800 transition-colors"
            onClick={(e) => { e.stopPropagation(); onBuy(lead); }}
          >
            BUY LEAD
          </button>
        </div>
      )}
    </div>
  );
}
