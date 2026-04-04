import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/mayax-logo.jpg";

const Starfield = () => (
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
);

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast({ title: "Password updated successfully" });
      setTimeout(() => navigate("/login"), 3000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050510] relative overflow-hidden">
      <Starfield />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-8 border border-primary/20 overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(15,23,41,0.95), rgba(10,15,30,0.98))",
          boxShadow: "0 0 60px rgba(59,130,246,0.08), 0 0 120px rgba(139,92,246,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute top-0 left-1/4 right-1/4 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, hsl(192,91%,42%), hsl(263,70%,66%), transparent)" }}
        />

        <div className="flex justify-center mb-6">
          <img src={logo} alt="MayaX Lead Hub" className="w-20 h-20 object-contain" />
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Password Updated!</h3>
            <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-foreground text-center mb-2">Set New Password</h3>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Enter your new password below
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/40"
                  required
                  minLength={6}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-11 h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/40"
                  required
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold rounded-xl border-0 text-white"
                style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="text-xs font-bold text-foreground">TRUSTED</p>
            <p className="text-[10px] text-muted-foreground">Quality Buyers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
