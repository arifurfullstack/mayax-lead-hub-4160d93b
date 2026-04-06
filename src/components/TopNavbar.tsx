import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Wallet, Bell, Settings, LogOut, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  dealerId?: string | null;
}

const TopNavbar = ({
  dealerName = "Dealer",
  tier = "basic",
  walletBalance = 0,
  onLogout,
  profilePictureUrl,
  dealerId = null,
}: TopNavbarProps) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications(dealerId);

  const initials = dealerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleNotificationClick = (notif: {
    id: string;
    read: boolean;
    link: string | null;
  }) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

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
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    markAllAsRead();
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                {notifications.map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "flex flex-col items-start gap-1 px-3 py-2.5 cursor-pointer",
                      !notif.read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {notif.title}
                      </span>
                    </div>
                    {notif.message && (
                      <span className="text-xs text-muted-foreground line-clamp-2 pl-4">
                        {notif.message}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 pl-4">
                      {formatDistanceToNow(new Date(notif.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Avatar with Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="focus:outline-none">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border hover:ring-primary/50 transition-all">
                {profilePictureUrl ? (
                  <AvatarImage src={profilePictureUrl} alt={dealerName} />
                ) : null}
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
