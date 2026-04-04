import { Check, Crown, Zap, Shield, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Basic",
    price: 49,
    icon: Shield,
    glowClass: "",
    borderClass: "border-muted-foreground/30",
    badgeClass: "bg-muted text-muted-foreground",
    delay: "24h",
    features: [
      "Access to verified leads",
      "24-hour early access delay",
      "Email lead delivery",
      "Basic lead filters",
      "5 leads/day autopay limit",
    ],
    cta: "Get Started",
  },
  {
    name: "Pro",
    price: 149,
    icon: Zap,
    glowClass: "glow-blue",
    borderClass: "border-primary/40",
    badgeClass: "bg-primary/20 text-primary",
    delay: "12h",
    features: [
      "Everything in Basic",
      "12-hour early access delay",
      "Email + webhook delivery",
      "Advanced lead filters",
      "15 leads/day autopay limit",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
  },
  {
    name: "Elite",
    price: 299,
    icon: Star,
    glowClass: "glow-purple",
    borderClass: "border-secondary/40",
    badgeClass: "bg-secondary/20 text-secondary",
    delay: "6h",
    features: [
      "Everything in Pro",
      "6-hour early access delay",
      "Real-time webhook delivery",
      "All lead filters + saved searches",
      "30 leads/day autopay limit",
      "Dedicated account manager",
      "Custom lead scoring",
    ],
    cta: "Upgrade to Elite",
  },
  {
    name: "VIP",
    price: 599,
    icon: Crown,
    glowClass: "glow-gold",
    borderClass: "border-gold/40",
    badgeClass: "bg-gold/20 text-gold",
    delay: "Instant",
    popular: true,
    features: [
      "Everything in Elite",
      "Instant lead access — no delay",
      "All delivery channels",
      "Unlimited autopay",
      "White-glove onboarding",
      "API access",
      "Custom integrations",
      "Volume discounts on leads",
    ],
    cta: "Go VIP",
  },
];

const Subscription = () => {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Unlock faster access to premium, AI-verified buyer leads. Higher tiers get earlier access and more powerful tools.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.name}
                className={cn(
                  "glass-card relative flex flex-col p-6 border transition-transform hover:scale-[1.02]",
                  tier.borderClass,
                  tier.glowClass
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gold text-background text-xs font-bold px-3 py-1 rounded-full animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-gold via-warning to-gold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Tier Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2 rounded-lg", tier.badgeClass)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{tier.name}</h2>
                </div>

                {/* Pricing */}
                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-foreground">${tier.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Lead access delay:{" "}
                  <span className="font-mono text-cyan font-semibold">{tier.delay}</span>
                </p>

                {/* Features */}
                <ul className="flex-1 space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className={cn(
                    "w-full py-2.5 rounded-lg font-semibold text-sm transition-colors",
                    tier.name === "VIP"
                      ? "bg-gradient-to-r from-gold to-warning text-background hover:opacity-90"
                      : tier.name === "Elite"
                        ? "gradient-purple-blue text-foreground hover:opacity-90"
                        : tier.name === "Pro"
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  {tier.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Subscription;
