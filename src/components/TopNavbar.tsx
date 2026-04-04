import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Wallet, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const tierColors: Record<string, string> = {
  basic: "bg-muted text-muted-foreground",
  pro: "bg-primary/20 text-primary",
  elite: "bg-secondary/20 text-secondary",
  vip: "bg-gold/20 text-gold",
};

interface TopNavbarProps {
  dealerName?: string;
  tier?: string;
  walletBalance?: number;
}

const TopNavbar = ({
  dealerName = "Dealer",
  tier = "basic",
  walletBalance = 0,
}: TopNavbarProps) => {
  return (
    <header className="h-14 flex items-center justify-between border-b border-border bg-card/60 backdrop-blur-md px-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
            MayaX
          </span>
          <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase hidden sm:inline">
            Lead Hub
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet */}
        <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span className="font-semibold text-foreground">
            ${walletBalance.toFixed(2)}
          </span>
        </div>

        {/* Tier Badge */}
        <Badge
          className={cn(
            "text-xs font-semibold uppercase tracking-wide border-0",
            tierColors[tier] || tierColors.basic
          )}
        >
          {tier}
        </Badge>

        {/* Notifications */}
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
          <Bell className="h-4 w-4" />
        </button>

        {/* Dealer name */}
        <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-[140px]">
          {dealerName}
        </span>
      </div>
    </header>
  );
};

export default TopNavbar;
