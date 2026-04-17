import { useEffect, useState, useMemo } from "react";
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
  BarChart3,
  Webhook,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

const GRADE_COLORS: Record<string, string> = {
  "A+": "#C8A84E",
  A: "#3B82F6",
  B: "#06B6D4",
  C: "#64748B",
};

const CustomTooltipStyle = {
  backgroundColor: "hsl(220, 43%, 20%)",
  border: "1px solid hsl(215, 28%, 27%)",
  borderRadius: "8px",
  color: "hsl(210, 40%, 98%)",
  fontSize: "12px",
  padding: "8px 12px",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [dealer, setDealer] = useState<DealerData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [allPurchases, setAllPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subInfo, setSubInfo] = useState<{ tier: string; leads_used: number; leads_limit: number; end_date: string; auto_renew: boolean; price: number } | null>(null);

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

      // Fetch active subscription + usage
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("tier, end_date, auto_renew, price, leads_per_month")
        .eq("dealer_id", d.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        const now = new Date();
        const periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const { data: usageData } = await supabase
          .from("dealer_subscription_usage")
          .select("leads_used, leads_limit")
          .eq("dealer_id", d.id)
          .eq("period_start", periodStr)
          .maybeSingle();

        setSubInfo({
          tier: sub.tier,
          leads_used: usageData?.leads_used ?? 0,
          leads_limit: usageData?.leads_limit ?? sub.leads_per_month ?? 0,
          end_date: sub.end_date ?? "",
          auto_renew: sub.auto_renew ?? false,
          price: Number(sub.price),
        });
      }

      // Fetch all purchases for charts
      const { data: all } = await supabase
        .from("purchases")
        .select("id, price_paid, purchased_at, delivery_status, delivery_method, lead_id, leads(reference_code, quality_grade, city, province)")
        .eq("dealer_id", d.id)
        .order("purchased_at", { ascending: false });

      const allData = (all as unknown as PurchaseRow[]) ?? [];
      setAllPurchases(allData);
      setPurchases(allData.slice(0, 10));
      setLoading(false);
    };
    load();
  }, []);

  // Chart data computations
  const { spendingData, purchaseTrendData, gradeData } = useMemo(() => {
    if (allPurchases.length === 0) {
      return { spendingData: [], purchaseTrendData: [], gradeData: [] };
    }

    // Group by date for spending and purchase trends
    const byDate = new Map<string, { spending: number; count: number }>();
    allPurchases.forEach((p) => {
      const date = new Date(p.purchased_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const existing = byDate.get(date) || { spending: 0, count: 0 };
      existing.spending += Number(p.price_paid);
      existing.count += 1;
      byDate.set(date, existing);
    });

    const spendingData = Array.from(byDate.entries())
      .map(([date, { spending }]) => ({ date, spending: Math.round(spending * 100) / 100 }))
      .reverse();

    const purchaseTrendData = Array.from(byDate.entries())
      .map(([date, { count }]) => ({ date, leads: count }))
      .reverse();

    // Grade distribution
    const gradeCount = new Map<string, number>();
    allPurchases.forEach((p) => {
      const grade = p.leads?.quality_grade || "Unknown";
      gradeCount.set(grade, (gradeCount.get(grade) || 0) + 1);
    });

    const gradeData = Array.from(gradeCount.entries())
      .map(([name, value]) => ({ name, value, color: GRADE_COLORS[name] || "#64748B" }))
      .sort((a, b) => b.value - a.value);

    return { spendingData, purchaseTrendData, gradeData };
  }, [allPurchases]);

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
  const totalSpent = allPurchases.reduce((s, p) => s + Number(p.price_paid), 0);
  const deliveryStats = {
    delivered: allPurchases.filter((p) => p.delivery_status === "delivered").length,
    pending: allPurchases.filter((p) => p.delivery_status === "pending").length,
    failed: allPurchases.filter((p) => p.delivery_status === "failed").length,
  };
  const deliveryRate = allPurchases.length > 0 ? Math.round((deliveryStats.delivered / allPurchases.length) * 100) : 100;
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
          <p className="text-2xl font-bold text-foreground">{allPurchases.length}</p>
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

      {/* Subscription Status Card */}
      {subInfo && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Crown className="h-4 w-4 text-secondary" />
              Subscription Status
            </h2>
            <Button variant="link" className="p-0 h-auto text-xs text-secondary" onClick={() => navigate("/subscription")}>
              Manage <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current Plan */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Plan</p>
              <p className={cn("text-xl font-bold capitalize", tierConfig[subInfo.tier]?.color ?? "text-foreground")}>
                {tierConfig[subInfo.tier]?.icon} {tierConfig[subInfo.tier]?.label ?? subInfo.tier}
              </p>
              <p className="text-xs text-muted-foreground mt-1">${subInfo.price}/mo</p>
            </div>

            {/* Leads Remaining */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Leads Remaining</p>
              <p className="text-xl font-bold text-foreground">
                {subInfo.leads_limit - subInfo.leads_used}
                <span className="text-sm font-normal text-muted-foreground">/{subInfo.leads_limit}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (subInfo.leads_used / Math.max(1, subInfo.leads_limit)) * 100)}%`,
                    background: subInfo.leads_used >= subInfo.leads_limit ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                  }}
                />
              </div>
            </div>

            {/* Renewal Date */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Renewal Date</p>
              <p className="text-xl font-bold text-foreground">
                {subInfo.end_date ? new Date(subInfo.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {subInfo.end_date ? `${Math.max(0, Math.ceil((new Date(subInfo.end_date + "T00:00:00").getTime() - Date.now()) / 86400000))} days left` : ""}
              </p>
            </div>

            {/* Auto-Renew */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Auto-Renew</p>
              <div className="flex items-center gap-2 mt-1">
                {subInfo.auto_renew ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-lg font-bold text-success">Active</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-lg font-bold text-muted-foreground">Off</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {subInfo.auto_renew ? "Wallet will be charged" : "Plan will expire"}
              </p>
            </div>
          </div>
        </div>
      )}

      {allPurchases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spending Over Time */}
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Spending Over Time
              </h2>
            </div>
            <div className="p-4 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendingData}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 28%, 27%)" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={CustomTooltipStyle} formatter={(value: number) => [`$${value.toFixed(2)}`, "Spent"]} />
                  <Area type="monotone" dataKey="spending" stroke="#3B82F6" strokeWidth={2} fill="url(#spendGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold" />
                Lead Grade Distribution
              </h2>
            </div>
            <div className="p-4 h-[220px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {gradeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CustomTooltipStyle}
                    formatter={(value: number, name: string) => [value, `Grade ${name}`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-4 pb-4 flex flex-wrap gap-3 justify-center">
              {gradeData.map((g) => (
                <div key={g.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  <span>{g.name}</span>
                  <span className="font-semibold text-foreground">{g.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Trend Bar Chart */}
      {allPurchases.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-cyan" />
              Lead Purchase Trend
            </h2>
          </div>
          <div className="p-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={purchaseTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 28%, 27%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CustomTooltipStyle} formatter={(value: number) => [value, "Leads"]} />
                <Bar dataKey="leads" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
              <Button variant="outline" className="w-full justify-start gap-3 h-11 text-sm" onClick={() => navigate("/marketplace")}>
                <Store className="h-4 w-4 text-primary" />
                Browse Marketplace
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-11 text-sm" onClick={() => navigate("/wallet")}>
                <CreditCard className="h-4 w-4 text-cyan" />
                Add Funds
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-11 text-sm" onClick={() => navigate("/subscription")}>
                <Zap className="h-4 w-4 text-secondary" />
                Upgrade Tier
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-11 text-sm" onClick={() => navigate("/orders")}>
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
