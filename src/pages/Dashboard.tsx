import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ShoppingCart,
  TrendingUp,
  Crown,
  ArrowRight,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Zap,
  CreditCard,
  Store,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tierConfig: Record<string, { color: string; icon: string; label: string }> = {
  basic: { color: "text-muted-foreground", icon: "🥉", label: "Basic" },
  pro: { color: "text-primary", icon: "🥈", label: "Pro" },
  elite: { color: "text-secondary", icon: "🥇", label: "Elite" },
  vip: { color: "text-gold", icon: "👑", label: "VIP" },
};

const deliveryStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  delivered: { icon: CheckCircle2, color: "text-success" },
  pending: { icon: Clock, color: "text-warning" },
  failed: { icon: XCircle, color: "text-destructive" },
  retrying: { icon: RefreshCw, color: "text-cyan" },
};

interface DealerData {
  id: string;
  dealership_name: string;
  subscription_tier: string;
  wallet_balance: number;
}

interface PurchaseRow {
  id: string;
  price_paid: number;
  purchased_at: string;
  delivery_status: string;
  delivery_method: string | null;
  lead_id: string;
  leads: { reference_code: string; quality_grade: string | null; city: string | null; province: string | null } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [dealer, setDealer] = useState<DealerData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: d } = await supabase
        .from("dealers")
        .select("id, dealership_name, subscription_tier, wallet_balance")
        .eq("user_id", session.user.id)
        .single();

      if (!d) return;
      setDealer(d);

      const { data: p } = await supabase
        .from("purchases")
        .select("id, price_paid, purchased_at, delivery_status, delivery_method, lead_id, leads(reference_code, quality_grade, city, province)")
        .eq("dealer_id", d.id)
        .order("purchased_at", { ascending: false })
        .limit(10);

      setPurchases((p as unknown as PurchaseRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !dealer) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-card rounded-xl" />)}
        </div>
      </div>
    );
  }

  const tier = tierConfig[dealer.subscription_tier] ?? tierConfig.basic;
  const totalSpent = purchases.reduce((s, p) => s + Number(p.price_paid), 0);
  const deliveryStats = {
    delivered: purchases.filter((p) => p.delivery_status === "delivered").length,
    pending: purchases.filter((p) => p.delivery_status === "pending").length,
    failed: purchases.filter((p) => p.delivery_status === "failed").length,
  };
  const deliveryRate = purchases.length > 0 ? Math.round((deliveryStats.delivered / purchases.length) * 100) : 100;
  const recentFive = purchases.slice(0, 5);

  const gradeBadge: Record<string, string> = {
    "A+": "bg-gold/20 text-gold",
    A: "bg-primary/20 text-primary",
    B: "bg-cyan/20 text-cyan",
    C: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {dealer.dealership_name}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's your lead acquisition overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wallet Balance */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Wallet Balance</span>
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">${Number(dealer.wallet_balance).toFixed(2)}</p>
          <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate("/wallet")}>
            Add Funds <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {/* Subscription Tier */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Subscription</span>
            <div className="h-8 w-8 rounded-lg bg-secondary/15 flex items-center justify-center">
              <Crown className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className={cn("text-2xl font-bold", tier.color)}>
            {tier.icon} {tier.label}
          </p>
          <Button variant="link" className="p-0 h-auto text-xs text-secondary" onClick={() => navigate("/subscription")}>
            Manage Plan <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {/* Leads Purchased */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Leads Purchased</span>
            <div className="h-8 w-8 rounded-lg bg-cyan/15 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-cyan" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{purchases.length}</p>
          <p className="text-xs text-muted-foreground">
            ${totalSpent.toFixed(2)} total invested
          </p>
        </div>

        {/* Delivery Health */}
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Delivery Rate</span>
            <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className={cn("text-2xl font-bold", deliveryRate >= 80 ? "text-success" : deliveryRate >= 50 ? "text-warning" : "text-destructive")}>
            {deliveryRate}%
          </p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="text-success">{deliveryStats.delivered} ok</span>
            <span className="text-warning">{deliveryStats.pending} pending</span>
            {deliveryStats.failed > 0 && <span className="text-destructive">{deliveryStats.failed} failed</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Purchases */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Purchases</h2>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/orders")}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {recentFive.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No purchases yet. Visit the marketplace to buy your first lead!
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentFive.map((p) => {
                const StatusIcon = deliveryStatusConfig[p.delivery_status]?.icon ?? Clock;
                const statusColor = deliveryStatusConfig[p.delivery_status]?.color ?? "text-muted-foreground";
                const lead = p.leads;
                return (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground font-mono">
                            {lead?.reference_code ?? "—"}
                          </span>
                          {lead?.quality_grade && (
                            <Badge className={cn("text-[10px] px-1.5 py-0 border-0", gradeBadge[lead.quality_grade] ?? "bg-muted text-muted-foreground")}>
                              {lead.quality_grade}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead?.city && lead?.province ? `${lead.city}, ${lead.province}` : "Location hidden"}
                          {" · "}
                          {new Date(p.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground">${Number(p.price_paid).toFixed(2)}</span>
                      <StatusIcon className={cn("h-4 w-4", statusColor)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => navigate("/marketplace")}
              >
                <Store className="h-4 w-4 text-primary" />
                Browse Marketplace
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => navigate("/wallet")}
              >
                <CreditCard className="h-4 w-4 text-cyan" />
                Add Funds
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => navigate("/subscription")}
              >
                <Zap className="h-4 w-4 text-secondary" />
                Upgrade Tier
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-sm"
                onClick={() => navigate("/orders")}
              >
                <Package className="h-4 w-4 text-gold" />
                View Orders
              </Button>
            </div>
          </div>

          {/* Tier Benefits */}
          <div className="glass-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Tier Benefits</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Lead access delay</span>
                <span className={cn("font-semibold", tier.color)}>
                  {dealer.subscription_tier === "vip" ? "Instant" : dealer.subscription_tier === "elite" ? "6h" : dealer.subscription_tier === "pro" ? "12h" : "24h"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Priority support</span>
                <span className={cn("font-semibold", dealer.subscription_tier === "basic" ? "text-muted-foreground" : tier.color)}>
                  {dealer.subscription_tier === "basic" ? "—" : "✓"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>AutoPay</span>
                <span className={cn("font-semibold", ["elite", "vip"].includes(dealer.subscription_tier) ? tier.color : "text-muted-foreground")}>
                  {["elite", "vip"].includes(dealer.subscription_tier) ? "✓" : "—"}
                </span>
              </div>
            </div>
            {dealer.subscription_tier !== "vip" && (
              <Button size="sm" className="w-full gradient-blue-cyan text-foreground text-xs mt-2" onClick={() => navigate("/subscription")}>
                Upgrade to {dealer.subscription_tier === "basic" ? "Pro" : dealer.subscription_tier === "pro" ? "Elite" : "VIP"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
