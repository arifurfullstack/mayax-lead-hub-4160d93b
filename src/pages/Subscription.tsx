import { Check, Clock, Zap, BadgeCheck, Users, ShieldCheck } from "lucide-react";
import carLotBg from "@/assets/car-lot-bg.jpg";

const tiers = [
  {
    name: "BASIC",
    price: 249,
    delayIcon: Clock,
    delayText: "Access leads\nafter 24 hours",
    glowColor: "0, 210, 210",
    borderColor: "rgba(0, 210, 210, 0.6)",
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
    borderColor: "rgba(167, 139, 250, 0.6)",
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
    borderColor: "rgba(56, 189, 248, 0.6)",
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
    borderColor: "rgba(251, 191, 36, 0.6)",
    accentColor: "#fbbf24",
    popular: true,
    features: ["Instant access to leads", "Priority placement"],
    leadCount: "1000",
    cta: "CHOOSE VIP",
  },
];

const Subscription = () => {
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
        {/* Radial gradient blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[20%] right-[-8%] w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.6) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.09]" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, rgba(0,210,210,0.5) 0%, transparent 70%)", filter: "blur(80px)" }} />

        {/* Neon streak lines — multiple bright flares */}
        <div className="absolute top-[10%] right-[8%] w-[280px] h-[2px] rotate-[-15deg] opacity-[0.25]" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)" }} />
        <div className="absolute top-[14%] right-[12%] w-[200px] h-[2px] rotate-[-12deg] opacity-[0.18]" style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.7), transparent)" }} />
        <div className="absolute top-[8%] left-[15%] w-[250px] h-[2px] rotate-[8deg] opacity-[0.2]" style={{ background: "linear-gradient(90deg, transparent, rgba(0,210,210,0.7), transparent)" }} />
        <div className="absolute top-[18%] left-[30%] w-[180px] h-[2px] rotate-[-5deg] opacity-[0.15]" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)" }} />
        <div className="absolute top-[25%] right-[25%] w-[160px] h-[2px] rotate-[10deg] opacity-[0.12]" style={{ background: "linear-gradient(90deg, transparent, rgba(120,80,255,0.6), transparent)" }} />
        <div className="absolute top-[6%] right-[35%] w-[220px] h-[2px] rotate-[-8deg] opacity-[0.2]" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.7), transparent)" }} />

        {/* Cinematic car lot background image at the bottom */}
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

        {/* Bottom fade overlay */}
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
                className="relative flex flex-col rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5 group"
                style={{
                  background: "rgba(15, 20, 50, 0.7)",
                  backdropFilter: "blur(16px)",
                  border: `1.5px solid ${tier.borderColor}`,
                  boxShadow: `0 0 25px rgba(${tier.glowColor}, 0.2), 0 0 60px rgba(${tier.glowColor}, 0.08), inset 0 0 30px rgba(${tier.glowColor}, 0.05)`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 40px rgba(${tier.glowColor}, 0.35), 0 0 80px rgba(${tier.glowColor}, 0.15), inset 0 0 40px rgba(${tier.glowColor}, 0.08)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 25px rgba(${tier.glowColor}, 0.2), 0 0 60px rgba(${tier.glowColor}, 0.08), inset 0 0 30px rgba(${tier.glowColor}, 0.05)`;
                }}
              >
                {/* Top edge glow — more intense */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 h-[50%]" style={{ background: `linear-gradient(180deg, rgba(${tier.glowColor}, 0.2) 0%, transparent 100%)` }} />
                </div>

                {/* Most Popular tag — capsule/pill style */}
                {tier.popular && (
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

                {/* Tier Name */}
                <h2
                  className="relative text-2xl font-extrabold tracking-wider mb-5 text-center uppercase"
                  style={{
                    color: tier.popular ? tier.accentColor : "#ffffff",
                    letterSpacing: "1px",
                  }}
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
                    background: `linear-gradient(135deg, rgba(${tier.glowColor}, 0.25), rgba(${tier.glowColor}, 0.12))`,
                    border: `1px solid rgba(${tier.glowColor}, 0.5)`,
                    color: tier.accentColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glowColor}, 0.4), rgba(${tier.glowColor}, 0.25))`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${tier.glowColor}, 0.25), rgba(${tier.glowColor}, 0.12))`;
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
