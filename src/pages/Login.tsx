import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Crosshair, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/mayax-logo.jpg";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#050510] relative overflow-hidden">
      {/* Starfield */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 2.5 + 0.5}px`,
              height: `${Math.random() * 2.5 + 0.5}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.1,
              backgroundColor: "rgba(255,255,255,0.7)",
            }}
          />
        ))}
      </div>

      {/* Left Brand Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative z-10">
        <div className="text-center max-w-lg">
          {/* Logo */}
          <div className="mb-6">
            <img
              src={logo}
              alt="MayaX Lead Hub"
              className="w-56 h-56 lg:w-72 lg:h-72 object-contain mx-auto drop-shadow-[0_0_40px_rgba(139,92,246,0.3)]"
            />
          </div>

          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
            Buy Verified Auto Leads Instantly
          </h2>
          <p className="text-muted-foreground mb-10 leading-relaxed text-sm lg:text-base">
            AI-verified buyers. Real income. Real intent.{"\n"}Delivered directly to your CRM.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2.5 rounded-xl px-4 py-3 border border-white/10 bg-white/5 backdrop-blur-sm"
              >
                <badge.icon className="w-4 h-4 text-primary" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-primary tracking-wide">{badge.label}</p>
                  <p className="text-[11px] text-muted-foreground">{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Login Section */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 relative z-10">
        <div
          className="w-full max-w-md rounded-2xl p-8 border border-primary/20 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, rgba(15,23,41,0.95), rgba(10,15,30,0.98))",
            boxShadow: "0 0 60px rgba(59,130,246,0.08), 0 0 120px rgba(139,92,246,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Top glow line */}
          <div
            className="absolute top-0 left-1/4 right-1/4 h-[1px]"
            style={{ background: "linear-gradient(90deg, transparent, hsl(192,91%,42%), hsl(263,70%,66%), transparent)" }}
          />

          <h3 className="text-2xl font-bold text-foreground text-center mb-2">Sign In or Create Account</h3>
          <p className="text-muted-foreground text-center text-sm mb-8">Access your dealer dashboard</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/40"
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
                className="pl-11 h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/40"
                required
              />
            </div>

            <div className="text-right">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold rounded-xl border-0 text-white"
              style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
            >
              {loading ? "Signing in..." : "Login to Dashboard"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-white/10" />
            <span className="px-4 text-sm text-muted-foreground">OR</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-base border-white/15 text-foreground hover:bg-white/5 rounded-xl"
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
  );
};

export default Login;
