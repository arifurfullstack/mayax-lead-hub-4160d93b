import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Crosshair, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import fallbackLogo from "@/assets/mayax-logo.jpg";

/* ── Fallback rows if DB fetch fails ── */
const fallbackLeads = [
  { reference_code: "CACI # AGGSTON", quality_grade: "A", price: 45, income: 8200, city: "Toronto", province: "ON", buyer_type: "online" },
  { reference_code: "CACI & LORBEN", quality_grade: "B+", price: 35, income: 5100, city: "Vancouver", province: "BC", buyer_type: "online" },
  { reference_code: "FXCI & LORBEN", quality_grade: "A+", price: 55, income: 9400, city: "Calgary", province: "AB", buyer_type: "online" },
  { reference_code: "FXCI & MAPREDIANR", quality_grade: "B", price: 30, income: 4800, city: "Montreal", province: "QC", buyer_type: "online" },
  { reference_code: "CACI & NORMION", quality_grade: "C+", price: 25, income: 3200, city: "Ottawa", province: "ON", buyer_type: "online" },
  { reference_code: "TSUF # XERSION", quality_grade: "A", price: 50, income: 7600, city: "Edmonton", province: "AB", buyer_type: "online" },
  { reference_code: "CICI & CAMP", quality_grade: "B+", price: 40, income: 6100, city: "Winnipeg", province: "MB", buyer_type: "online" },
  { reference_code: "FXCI # MAPESONR", quality_grade: "C", price: 22, income: 2900, city: "Halifax", province: "NS", buyer_type: "online" },
  { reference_code: "CACI & MEDITION", quality_grade: "A+", price: 58, income: 9900, city: "Victoria", province: "BC", buyer_type: "online" },
  { reference_code: "TUAF # XERLUN", quality_grade: "B", price: 32, income: 4500, city: "Saskatoon", province: "SK", buyer_type: "online" },
  { reference_code: "CACI & LORBEN", quality_grade: "A", price: 48, income: 7200, city: "Hamilton", province: "ON", buyer_type: "online" },
  { reference_code: "FXCI # MAPESONR", quality_grade: "B+", price: 38, income: 5800, city: "Quebec", province: "QC", buyer_type: "online" },
];

type PreviewLead = {
  reference_code: string;
  buyer_type: string | null;
  price: number;
  income: number | null;
  city: string | null;
  province: string | null;
  quality_grade: string | null;
};

const MarketplaceBg = ({ leads }: { leads: PreviewLead[] }) => (
  <div className="absolute inset-0 overflow-hidden select-none pointer-events-none" aria-hidden>
    {/* Header row */}
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
      <span className="text-sm font-bold text-white/40 tracking-wide">Leads Marketplace</span>
      <div className="flex gap-3">
        <div className="h-7 w-24 rounded bg-white/5" />
        <div className="h-7 w-28 rounded bg-white/5" />
      </div>
    </div>
    {/* Table header */}
    <div className="grid grid-cols-6 gap-2 px-6 py-2 text-[10px] uppercase tracking-widest text-white/25 border-b border-white/5">
      <span>Type</span><span>Reference</span><span>Price</span><span>Income</span><span>City</span><span>Grade</span>
    </div>
    {/* Rows */}
    {leads.map((l, i) => (
      <div
        key={i}
        className="grid grid-cols-6 gap-2 px-6 py-2.5 text-[11px] text-white/20 border-b border-white/[0.03]"
      >
        <span className="truncate">{l.buyer_type || "online"}</span>
        <span>{l.reference_code.slice(0, 8)}</span>
        <span>${l.price}</span>
        <span>${l.income?.toLocaleString() ?? "—"}</span>
        <span>{l.city ?? "—"}, {l.province ?? ""}</span>
        <span className="font-semibold">{l.quality_grade ?? "B"}</span>
      </div>
    ))}
    {/* Duplicate rows for fullness */}
    {leads.map((l, i) => (
      <div
        key={`dup-${i}`}
        className="grid grid-cols-6 gap-2 px-6 py-2.5 text-[11px] text-white/15 border-b border-white/[0.02]"
      >
        <span className="truncate">{l.buyer_type || "online"}</span>
        <span>{l.reference_code.slice(0, 8)}</span>
        <span>${l.price}</span>
        <span>${l.income?.toLocaleString() ?? "—"}</span>
        <span>{l.city ?? "—"}, {l.province ?? ""}</span>
        <span className="font-semibold">{l.quality_grade ?? "B"}</span>
      </div>
    ))}
  </div>
);
const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: settings } = usePlatformSettings();
  const logoSrc = settings?.theme_logo_url || fallbackLogo;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: dealer } = await supabase
        .from("dealers")
        .select("approval_status")
        .eq("user_id", data.user.id)
        .single();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);

      const isAdmin = roles?.some((r: any) => r.role === "admin");

      if (isAdmin) {
        navigate("/admin");
      } else if (!dealer) {
        navigate("/pending");
      } else {
        switch (dealer.approval_status) {
          case "approved": navigate("/dashboard"); break;
          case "pending": navigate("/pending"); break;
          case "rejected": navigate("/rejected"); break;
          case "suspended": navigate("/suspended"); break;
          default: navigate("/pending");
        }
      }
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const trustBadges = [
    { icon: Crosshair, label: "PREMIUM", sub: "Verified Leads" },
    { icon: Zap, label: "FAST", sub: "Instant Access" },
    { icon: ShieldCheck, label: "TRUSTED", sub: "Quality Buyers" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050510]">
      {/* ── Blurred marketplace background ── */}
      <div className="absolute inset-0" style={{ filter: "blur(1px) brightness(0.85) saturate(1.6)" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/60 via-transparent to-[#050510]" />
        <MarketplaceBg />
      </div>

      {/* Blue/purple ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple/8 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan/5 blur-[150px]" />
      </div>

      {/* ── Liquid Glass Card ── */}
      <div
        className="relative z-10 w-full max-w-[960px] mx-4 rounded-3xl border border-white/[0.12] flex flex-col lg:flex-row overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.55) 0%, rgba(20,30,60,0.45) 50%, rgba(10,18,40,0.55) 100%)",
          backdropFilter: "blur(40px) saturate(1.6)",
          WebkitBackdropFilter: "blur(40px) saturate(1.6)",
          boxShadow:
            "0 0 80px rgba(59,130,246,0.12), 0 0 160px rgba(139,92,246,0.06), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {/* Animated top border glow */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 5%, hsl(192,91%,42%) 25%, hsl(263,70%,60%) 50%, hsl(217,91%,60%) 75%, transparent 95%)",
          }}
        />
        {/* Bottom border glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 10%, hsl(217,91%,50%,0.3) 40%, hsl(192,91%,42%,0.3) 60%, transparent 90%)",
          }}
        />

        {/* ── Left: Brand ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative">
          {/* Divider line on desktop */}
          <div className="hidden lg:block absolute right-0 top-[10%] bottom-[10%] w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <img
            src={logoSrc}
            alt={settings?.theme_website_name || "MayaX Lead Hub"}
            className="w-66 h-66 lg:w-84 lg:h-84 object-contain drop-shadow-[0_0_50px_rgba(139,92,246,0.35)] mb-4"
          />

          <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2 text-center">
            Buy Verified Auto Leads Instantly
          </h2>
          <p className="text-muted-foreground text-center text-xs lg:text-sm leading-relaxed mb-8 max-w-xs">
            AI-verified buyers. Real income. Real intent.
            <br />
            Delivered directly to your CRM.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm"
              >
                <badge.icon className="w-4 h-4 text-primary" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-primary tracking-wide">{badge.label}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Login Form ── */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-sm">
            <h3 className="text-2xl font-bold text-foreground text-center mb-1">Sign In or Create Account</h3>
            <p className="text-muted-foreground text-center text-sm mb-8">Access your dealer dashboard</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 bg-white/[0.04] border-white/[0.1] text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 bg-white/[0.04] border-white/[0.1] text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:bg-white/[0.06] transition-colors"
                  required
                />
              </div>

              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold rounded-xl border-0 text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))",
                }}
              >
                {loading ? "Signing in..." : "Login to Dashboard"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-white/[0.08]" />
              <span className="px-4 text-sm text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-white/[0.08]" />
            </div>

            <Button
              variant="outline"
              className="w-full h-12 text-base border-white/[0.1] text-foreground hover:bg-white/[0.06] rounded-xl"
              onClick={() => navigate("/register")}
            >
              Create Dealer Account
            </Button>

            <div className="mt-8 flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="text-xs font-bold text-foreground">TRUSTED</p>
                <p className="text-[10px] text-muted-foreground">Quality Buyers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
