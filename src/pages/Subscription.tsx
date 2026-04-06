import { Check, Clock, Zap, BadgeCheck, Users, ShieldCheck, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
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

const Subscription = () => {
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);

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

  // Fetch dealer's current tier
  useEffect(() => {
    const fetchTier = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dealers")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .single();
      if (data) setCurrentTier(data.subscription_tier);
    };
    fetchTier();
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    setSubscribing(plan.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: dealer } = await supabase
        .from("dealers")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!dealer) throw new Error("Dealer not found");

      // Update dealer tier
      await supabase
        .from("dealers")
        .update({ subscription_tier: plan.name.toLowerCase() })
        .eq("id", dealer.id);

      // Upsert subscription record
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("dealer_id", dealer.id)
        .eq("status", "active")
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from("subscriptions")
          .update({ tier: plan.name.toLowerCase(), price: plan.price })
          .eq("id", existingSub.id);
      } else {
        await supabase.from("subscriptions").insert({
          dealer_id: dealer.id,
          tier: plan.name.toLowerCase(),
          price: plan.price,
          status: "active",
        });
      }

      setCurrentTier(plan.name.toLowerCase());
      toast({ title: "Subscribed!", description: `You are now on the ${plan.name} plan.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubscribing(null);
    }
  };

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
          <p className="text-[15px] font-light max-w-2xl mx-auto mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Select a plan that suits your needs and unlock access to verified auto leads
          </p>
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
                  {tier.is_popular && (
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
                    onClick={() => handleSubscribe(tier)}
                  >
                    {subscribing === tier.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : isCurrentPlan ? (
                      "CURRENT PLAN"
                    ) : (
                      `CHOOSE ${tier.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm font-light" style={{ color: "rgba(255,255,255,0.4)" }}>
          Renew, upgrade, or downgrade anytime. Month-to-month, cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Subscription;
