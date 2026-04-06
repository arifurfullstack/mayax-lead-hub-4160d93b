import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Wallet, Bell, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  onLogout?: () => void;
  profilePictureUrl?: string | null;
}

const TopNavbar = ({
  dealerName = "Dealer",
  tier = "basic",
  walletBalance = 0,
  onLogout,
}: TopNavbarProps) => {
  const navigate = useNavigate();
  const initials = dealerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
        {/* Wallet — clickable */}
        <Link
          to="/wallet"
          className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Wallet className="h-4 w-4" />
          <span className="font-semibold text-foreground">
            ${walletBalance.toFixed(2)}
          </span>
        </Link>

        {/* Tier Badge */}
        <Badge
          className={cn(
            "text-xs font-semibold uppercase tracking-wide border-0",
            tierColors[tier] || tierColors.basic
          )}
        >
          {tier}
        </Badge>

        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
              <Bell className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Avatar with Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border hover:ring-primary/50 transition-all">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate">{dealerName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopNavbar;
