import { Check, Crown, Zap, Shield, Star, Clock, BadgeCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import subscriptionBg from "@/assets/subscription-bg.jpg";

const tiers = [
  {
    name: "BASIC",
    price: 249,
    icon: Shield,
    delayIcon: Clock,
    delayText: "Access leads\nafter 24 hours",
    glowColor: "rgba(6, 182, 212, 0.5)",
    borderColor: "border-cyan/50",
    nameColor: "text-cyan",
    ctaClass: "bg-cyan/20 text-cyan border border-cyan/40 hover:bg-cyan/30",
    features: [
      "Normal priority",
      "Standard support",
    ],
    leadCount: "100",
    cta: "CHOOSE BASIC",
  },
  {
    name: "PRO",
    price: 499,
    icon: Zap,
    delayIcon: Clock,
    delayText: "Access leads\nafter 12 hours",
    glowColor: "rgba(59, 130, 246, 0.5)",
    borderColor: "border-primary/50",
    nameColor: "text-primary",
    ctaClass: "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30",
    features: [
      "Faster access",
      "Priority support",
    ],
    leadCount: "250",
    cta: "CHOOSE PRO",
  },
  {
    name: "ELITE",
    price: 999,
    icon: Star,
    delayIcon: Clock,
    delayText: "Access leads\nafter 6 hours",
    glowColor: "rgba(139, 92, 246, 0.5)",
    borderColor: "border-secondary/50",
    nameColor: "text-secondary",
    ctaClass: "bg-secondary/20 text-secondary border border-secondary/40 hover:bg-secondary/30",
    features: [
      "Early access",
      "Priority support",
    ],
    leadCount: "500",
    cta: "CHOOSE ELITE",
  },
  {
    name: "VIP",
    price: 1799,
    icon: Crown,
    delayIcon: Zap,
    delayText: "Instant access",
    glowColor: "rgba(200, 168, 78, 0.5)",
    borderColor: "border-gold/50",
    nameColor: "text-gold",
    ctaClass: "bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30",
    popular: true,
    features: [
      "Instant access to leads",
      "Priority placement",
    ],
    leadCount: "1000",
    cta: "CHOOSE VIP",
  },
];

const Subscription = () => {
  return (
    <div className="relative p-6 md:p-10 min-h-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={subscriptionBg}
          alt=""
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Choose Your Subscription
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto mb-6">
            Select a plan that suits your needs and unlock access to verified auto leads
          </p>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <BadgeCheck className="h-5 w-5 text-success" />
              <span>Verified Leads</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Zap className="h-5 w-5 text-warning" />
              <span>Fast Access</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Users className="h-5 w-5 text-success" />
              <span>Trusted Buyers</span>
            </div>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {tiers.map((tier) => {
            const DelayIcon = tier.delayIcon;
            return (
              <div
                key={tier.name}
                className={cn(
                  "relative flex flex-col items-center rounded-2xl border-2 p-6 pt-8 transition-transform hover:scale-[1.03]",
                  tier.borderColor
                )}
                style={{
                  background: "linear-gradient(180deg, rgba(15, 23, 41, 0.95) 0%, rgba(27, 42, 74, 0.7) 100%)",
                  boxShadow: `0 0 25px ${tier.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-gradient-to-r from-gold via-warning to-gold text-background text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier Name */}
                <h2 className={cn("text-2xl font-extrabold tracking-wider mb-5", tier.nameColor)}>
                  {tier.name}
                </h2>

                {/* Access Delay */}
                <div className="flex items-center gap-2.5 mb-5">
                  <div className={cn("p-1.5 rounded-full", tier.nameColor === "text-gold" ? "bg-gold/15" : "bg-muted")}>
                    <DelayIcon className={cn("h-5 w-5", tier.nameColor)} />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-pre-line leading-tight">
                    {tier.delayText}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-foreground">${tier.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/ mo</span>
                </div>

                {/* Features */}
                <ul className="w-full space-y-3 mb-4 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-foreground/85">
                      <Check className="w-4 h-4 text-success shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2.5 text-sm text-foreground font-semibold">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    <span>{tier.leadCount} <span className="font-normal text-foreground/85">Leads / mo</span></span>
                  </li>
                </ul>

                {/* CTA */}
                <button
                  className={cn(
                    "w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-colors mt-2",
                    tier.ctaClass
                  )}
                >
                  {tier.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-sm mt-10">
          Renew, upgrade, or downgrade anytime. Month-to-month, cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Subscription;
