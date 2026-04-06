import { Check, Clock, Zap, BadgeCheck, ShieldCheck, Loader2, Wallet, AlertCircle, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import carLotBg from "@/assets/car-lot-bg.jpg";

interface PlanFeature {
  id: string;
  feature_text: string;
  sort_order: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  leads_per_month: number;
  delay_hours: number;
  glow_color: string;
  accent_color: string;
  is_popular: boolean;
  sort_order: number;
  plan_features: PlanFeature[];
}

interface DealerInfo {
  id: string;
  subscription_tier: string;
  wallet_balance: number;
}

const Subscription = () => {
  const [dealer, setDealer] = useState<DealerInfo | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ leads_used: number; leads_limit: number } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*, plan_features(*)")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as SubscriptionPlan[]).map((p) => ({
        ...p,
        plan_features: (p.plan_features ?? []).sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });

  useEffect(() => {
    const fetchDealer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dealers")
        .select("id, subscription_tier, wallet_balance")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setDealer(data);
        // Fetch current month usage
        const periodStart = new Date();
        periodStart.setDate(1);
        const periodStr = periodStart.toISOString().split("T")[0];
        const { data: usageData } = await supabase
          .from("dealer_subscription_usage")
          .select("leads_used, leads_limit")
          .eq("dealer_id", data.id)
          .eq("period_start", periodStr)
          .maybeSingle();
        if (usageData) setUsage(usageData);
      }
    };
    fetchDealer();
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!dealer) return;
    setSubscribing(plan.id);
    try {
      // Check wallet balance
      if (dealer.wallet_balance < plan.price) {
        toast({
          title: "Insufficient Balance",
          description: `You need $${plan.price.toFixed(2)} but have $${dealer.wallet_balance.toFixed(2)}. Add funds first.`,
          variant: "destructive",
        });
        return;
      }

      const newBalance = dealer.wallet_balance - plan.price;
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Deduct from wallet
      await supabase
        .from("dealers")
        .update({
          wallet_balance: newBalance,
          subscription_tier: plan.name.toLowerCase(),
        })
        .eq("id", dealer.id);

      // Record wallet transaction
      await supabase.from("wallet_transactions").insert({
        dealer_id: dealer.id,
        type: "purchase",
        amount: -plan.price,
        balance_after: newBalance,
        description: `Subscription: ${plan.name} plan ($${plan.price}/mo)`,
      });

      // Upsert subscription record with plan snapshot
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("dealer_id", dealer.id)
        .eq("status", "active")
        .maybeSingle();

      const subData = {
        tier: plan.name.toLowerCase(),
        price: plan.price,
        plan_id: plan.id,
        leads_per_month: plan.leads_per_month,
        delay_hours: plan.delay_hours,
        start_date: periodStart.toISOString().split("T")[0],
        end_date: periodEnd.toISOString().split("T")[0],
      };

      if (existingSub) {
        await supabase.from("subscriptions").update(subData).eq("id", existingSub.id);
      } else {
        await supabase.from("subscriptions").insert({
          dealer_id: dealer.id,
          status: "active",
          ...subData,
        });
      }

      // Upsert usage tracking for current month
      const periodStr = periodStart.toISOString().split("T")[0];
      const { data: existingUsage } = await supabase
        .from("dealer_subscription_usage")
        .select("id")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStr)
        .maybeSingle();

      if (existingUsage) {
        await supabase
          .from("dealer_subscription_usage")
          .update({ leads_limit: plan.leads_per_month })
          .eq("id", existingUsage.id);
      } else {
        await supabase.from("dealer_subscription_usage").insert({
          dealer_id: dealer.id,
          period_start: periodStr,
          leads_used: 0,
          leads_limit: plan.leads_per_month,
        });
      }

      setDealer({ ...dealer, subscription_tier: plan.name.toLowerCase(), wallet_balance: newBalance });
      setUsage({ leads_used: usage?.leads_used ?? 0, leads_limit: plan.leads_per_month });
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });

      toast({ title: "Subscribed!", description: `You are now on the ${plan.name} plan. $${plan.price.toFixed(2)} deducted from your wallet.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubscribing(null);
    }
  };

  const currentTier = dealer?.subscription_tier ?? null;

  return (
    <div
      className="relative min-h-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #080c18 0%, #0d1225 30%, #111830 60%, #0a1020 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[20%] right-[-8%] w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.6) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.09]" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(0,210,210,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />

        <div className="absolute top-[10%] right-[8%] w-[280px] h-[2px] rotate-[-15deg] opacity-[0.25]" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)" }} />
        <div className="absolute top-[14%] right-[12%] w-[200px] h-[2px] rotate-[-12deg] opacity-[0.18]" style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.7), transparent)" }} />
        <div className="absolute top-[8%] left-[15%] w-[250px] h-[2px] rotate-[8deg] opacity-[0.2]" style={{ background: "linear-gradient(90deg, transparent, rgba(0,210,210,0.7), transparent)" }} />
        <div className="absolute top-[18%] left-[30%] w-[180px] h-[2px] rotate-[-5deg] opacity-[0.15]" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)" }} />

        <div
          className="absolute bottom-0 left-0 right-0 h-[400px]"
          style={{
            backgroundImage: `url(${carLotBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            opacity: 0.35,
            maskImage: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[200px]" style={{ background: "linear-gradient(0deg, rgba(8,12,24,0.95) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-6 md:px-10 py-12 md:py-[50px] max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[26px] md:text-[36px] font-bold text-foreground mb-3">
            Choose Your Subscription
          </h1>
          <p className="text-[15px] font-light max-w-2xl mx-auto mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Select a plan that suits your needs and unlock access to verified auto leads
          </p>

          {/* Wallet Balance & Usage Info */}
          {dealer && (
            <div className="flex items-center justify-center gap-6 flex-wrap mb-6">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Wallet:</span>
                <span className="text-sm font-bold text-foreground">${dealer.wallet_balance.toFixed(2)}</span>
              </div>
              {usage && (
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <AlertCircle className="h-4 w-4 text-cyan" />
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Leads:</span>
                  <span className="text-sm font-bold text-foreground">{usage.leads_used}/{usage.leads_limit} used</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-9 flex-wrap">
            <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              <ShieldCheck className="h-6 w-6 text-success" />
              <span>Verified Leads</span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              <Zap className="h-6 w-6 text-warning" />
              <span>Fast Access</span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              <BadgeCheck className="h-6 w-6 text-success" />
              <span>Trusted Buyers</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[380px] rounded-2xl bg-card/30" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {(plans ?? []).map((tier) => {
              const DelayIcon = tier.delay_hours === 0 ? Zap : Clock;
              const delayText = tier.delay_hours === 0
                ? "Instant access"
                : `Access leads\nafter ${tier.delay_hours} hours`;
              const borderColor = `rgba(${tier.glow_color}, 0.6)`;
              const isCurrentPlan = currentTier === tier.name.toLowerCase();
              const canAfford = dealer ? dealer.wallet_balance >= tier.price : false;

              return (
                <div
                  key={tier.id}
                  className="relative flex flex-col rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5 group"
                  style={{
                    background: "rgba(15, 20, 50, 0.7)",
                    backdropFilter: "blur(16px)",
                    border: `1.5px solid ${borderColor}`,
                    boxShadow: `0 0 25px rgba(${tier.glow_color}, 0.2), 0 0 60px rgba(${tier.glow_color}, 0.08), inset 0 0 30px rgba(${tier.glow_color}, 0.05)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 40px rgba(${tier.glow_color}, 0.35), 0 0 80px rgba(${tier.glow_color}, 0.15), inset 0 0 40px rgba(${tier.glow_color}, 0.08)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 25px rgba(${tier.glow_color}, 0.2), 0 0 60px rgba(${tier.glow_color}, 0.08), inset 0 0 30px rgba(${tier.glow_color}, 0.05)`;
                  }}
                >
                  {/* Top edge glow */}
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 right-0 h-[50%]" style={{ background: `linear-gradient(180deg, rgba(${tier.glow_color}, 0.2) 0%, transparent 100%)` }} />
                  </div>

                  {/* Most Popular tag */}
                  {tier.is_popular && !isCurrentPlan && (
                    <div className="absolute -top-[1.5px] right-4 z-10">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[1.2px] px-4 py-1.5 block"
                        style={{
                          background: "rgba(234,179,8,0.15)",
                          border: "1px solid rgba(234,179,8,0.5)",
                          borderTop: "none",
                          borderRadius: "0 0 10px 10px",
                          color: "#fbbf24",
                        }}
                      >
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Current Plan badge */}
                  {isCurrentPlan && (
                    <div className="absolute -top-[1.5px] left-4 z-10">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[1.2px] px-4 py-1.5 block"
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid rgba(34,197,94,0.5)",
                          borderTop: "none",
                          borderRadius: "0 0 10px 10px",
                          color: "#22c55e",
                        }}
                      >
                        Current Plan
                      </span>
                    </div>
                  )}

                  {/* Tier Name */}
                  <h2
                    className="relative text-2xl font-extrabold tracking-wider mb-5 text-center uppercase"
                    style={{
                      color: tier.is_popular ? tier.accent_color : "#ffffff",
                      letterSpacing: "1px",
                    }}
                  >
                    {tier.name}
                  </h2>

                  {/* Access Delay */}
                  <div className="relative flex items-center gap-2.5 mb-5">
                    <div className="p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <DelayIcon className="h-5 w-5" style={{ color: tier.accent_color }} />
                    </div>
                    <span className="text-[13px] whitespace-pre-line leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {delayText}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="relative mb-6">
                    <span className="text-[42px] font-extrabold text-foreground">${tier.price}</span>
                    <span className="text-base ml-1" style={{ color: "rgba(255,255,255,0.45)" }}>/ mo</span>
                  </div>

                  {/* Features */}
                  <ul className="relative w-full space-y-3 mb-6 flex-1">
                    {tier.plan_features.map((feature) => (
                      <li key={feature.id} className="flex items-center gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <Check className="w-4 h-4 shrink-0" style={{ color: tier.accent_color }} />
                        <span>{feature.feature_text}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <Check className="w-4 h-4 shrink-0" style={{ color: tier.accent_color }} />
                      <span>
                        <span className="font-bold text-foreground">{tier.leads_per_month}</span>{" "}
                        <span>Leads / mo</span>
                      </span>
                    </li>
                  </ul>

                  {/* CTA Button */}
                  <button
                    className="relative w-full py-3 rounded-[10px] font-bold text-[13px] uppercase tracking-[1.5px] transition-all duration-200 disabled:opacity-50"
                    disabled={isCurrentPlan || subscribing === tier.id}
                    style={{
                      background: `linear-gradient(135deg, rgba(${tier.glow_color}, 0.25), rgba(${tier.glow_color}, 0.12))`,
                      border: `1px solid rgba(${tier.glow_color}, 0.5)`,
                      color: tier.accent_color,
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrentPlan) e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glow_color}, 0.4), rgba(${tier.glow_color}, 0.25))`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glow_color}, 0.25), rgba(${tier.glow_color}, 0.12))`;
                    }}
                    onClick={() => {
                      if (!canAfford && !isCurrentPlan) {
                        toast({
                          title: "Insufficient Balance",
                          description: `You need $${tier.price.toFixed(2)} but have $${dealer?.wallet_balance.toFixed(2) ?? "0.00"}. Add funds to your wallet first.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      handleSubscribe(tier);
                    }}
                  >
                    {subscribing === tier.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : isCurrentPlan ? (
                      "CURRENT PLAN"
                    ) : !canAfford ? (
                      "INSUFFICIENT FUNDS"
                    ) : (
                      `CHOOSE ${tier.name} — $${tier.price}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm font-light" style={{ color: "rgba(255,255,255,0.4)" }}>
          Pay from your wallet balance. Upgrade or downgrade anytime.
        </p>
      </div>
    </div>
  );
};

export default Subscription;
