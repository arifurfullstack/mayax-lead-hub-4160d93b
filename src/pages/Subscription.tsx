import { Check, Clock, Zap, BadgeCheck, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "BASIC",
    price: 249,
    delayIcon: Clock,
    delayText: "Access leads\nafter 24 hours",
    glowColor: "0, 210, 210",
    borderColor: "rgba(0, 210, 210, 0.4)",
    accentColor: "#00d2d2",
    features: ["Normal priority", "Standard support"],
    leadCount: "100",
    cta: "CHOOSE BASIC",
  },
  {
    name: "PRO",
    price: 499,
    delayIcon: Clock,
    delayText: "Access leads\nafter 12 hours",
    glowColor: "120, 80, 255",
    borderColor: "rgba(167, 139, 250, 0.4)",
    accentColor: "#a78bfa",
    features: ["Faster access", "Priority support"],
    leadCount: "250",
    cta: "CHOOSE PRO",
  },
  {
    name: "ELITE",
    price: 999,
    delayIcon: Clock,
    delayText: "Access leads\nafter 6 hours",
    glowColor: "0, 180, 255",
    borderColor: "rgba(56, 189, 248, 0.4)",
    accentColor: "#38bdf8",
    features: ["Early access", "Priority support"],
    leadCount: "500",
    cta: "CHOOSE ELITE",
  },
  {
    name: "VIP",
    price: 1799,
    delayIcon: Zap,
    delayText: "Instant access",
    glowColor: "234, 179, 8",
    borderColor: "rgba(251, 191, 36, 0.4)",
    accentColor: "#fbbf24",
    popular: true,
    features: ["Instant access to leads", "Priority placement"],
    leadCount: "1000",
    cta: "CHOOSE VIP",
  },
];

const Subscription = () => {
  return (
    <div className="relative min-h-full overflow-hidden" style={{ background: "linear-gradient(180deg, #080c18 0%, #0d1225 30%, #111830 60%, #0a1020 100%)" }}>
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[30%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Neon streak lines */}
        <div className="absolute top-[15%] right-[10%] w-[200px] h-[2px] rotate-[-15deg] opacity-[0.15]" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />
        <div className="absolute top-[20%] right-[15%] w-[150px] h-[2px] rotate-[-12deg] opacity-[0.1]" style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)" }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[180px]" style={{ background: "linear-gradient(0deg, rgba(8,12,24,0.95) 0%, transparent 100%)" }} />
      </div>

      <div className="relative z-10 px-6 md:px-10 py-12 md:py-[50px] max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[26px] md:text-[36px] font-bold text-foreground mb-3">
            Choose Your Subscription
          </h1>
          <p className="text-[15px] font-light text-muted-foreground max-w-2xl mx-auto mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            Select a plan that suits your needs and unlock access to verified auto leads
          </p>

          {/* Trust Badges */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
          {tiers.map((tier) => {
            const DelayIcon = tier.delayIcon;
            return (
              <div
                key={tier.name}
                className="relative flex flex-col rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 group"
                style={{
                  background: "rgba(15, 20, 50, 0.7)",
                  backdropFilter: "blur(16px)",
                  border: `1.5px solid ${tier.borderColor}`,
                  boxShadow: `0 0 20px rgba(${tier.glowColor}, 0.1), inset 0 0 30px rgba(${tier.glowColor}, 0.04)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 35px rgba(${tier.glowColor}, 0.2), inset 0 0 30px rgba(${tier.glowColor}, 0.06)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 20px rgba(${tier.glowColor}, 0.1), inset 0 0 30px rgba(${tier.glowColor}, 0.04)`;
                }}
              >
                {/* Top edge glow */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 h-[40%]" style={{ background: `linear-gradient(180deg, rgba(${tier.glowColor}, 0.12) 0%, transparent 100%)` }} />
                </div>

                {/* Most Popular tag */}
                {tier.popular && (
                  <div className="absolute -top-[1.5px] right-4 z-10">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[1.2px] px-3 py-1.5 block"
                      style={{
                        background: "rgba(234,179,8,0.15)",
                        border: "1px solid rgba(234,179,8,0.4)",
                        borderTop: "none",
                        borderRadius: "0 0 8px 8px",
                        color: "#fbbf24",
                      }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier Name */}
                <h2
                  className="relative text-2xl font-extrabold tracking-wider mb-5 text-center uppercase"
                  style={{ color: tier.popular ? tier.accentColor : "#ffffff" }}
                >
                  {tier.name}
                </h2>

                {/* Access Delay */}
                <div className="relative flex items-center gap-2.5 mb-5">
                  <div className="p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <DelayIcon className="h-5 w-5" style={{ color: tier.accentColor }} />
                  </div>
                  <span className="text-[13px] whitespace-pre-line leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {tier.delayText}
                  </span>
                </div>

                {/* Price */}
                <div className="relative mb-6">
                  <span className="text-[42px] font-extrabold text-foreground">${tier.price}</span>
                  <span className="text-base ml-1" style={{ color: "rgba(255,255,255,0.45)" }}>/ mo</span>
                </div>

                {/* Features */}
                <ul className="relative w-full space-y-3 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <Check className="w-4 h-4 shrink-0" style={{ color: tier.accentColor }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: tier.accentColor }} />
                    <span>
                      <span className="font-bold text-foreground">{tier.leadCount}</span>{" "}
                      <span>Leads / mo</span>
                    </span>
                  </li>
                </ul>

                {/* CTA Button */}
                <button
                  className="relative w-full py-3 rounded-[10px] font-bold text-[13px] uppercase tracking-[1.5px] transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, rgba(${tier.glowColor}, 0.2), rgba(${tier.glowColor}, 0.1))`,
                    border: `1px solid rgba(${tier.glowColor}, 0.45)`,
                    color: tier.accentColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glowColor}, 0.35), rgba(${tier.glowColor}, 0.2))`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glowColor}, 0.2), rgba(${tier.glowColor}, 0.1))`;
                  }}
                >
                  {tier.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-sm font-light" style={{ color: "rgba(255,255,255,0.4)" }}>
          Renew, upgrade, or downgrade anytime. Month-to-month, cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Subscription;
