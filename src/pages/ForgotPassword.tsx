import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, ShieldCheck } from "lucide-react";
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

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Email sent", description: "Check your inbox for a password reset link." });
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

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h3>
            <p className="text-muted-foreground text-sm mb-6">
              We've sent a password reset link to <span className="text-foreground font-medium">{email}</span>. Click the link in the email to reset your password.
            </p>
            <Button
              onClick={() => setSent(false)}
              variant="outline"
              className="w-full h-12 border-white/15 text-foreground hover:bg-white/5 rounded-xl mb-3"
            >
              Send Again
            </Button>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-foreground text-center mb-2">Reset Password</h3>
            <p className="text-muted-foreground text-center text-sm mb-8">
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold rounded-xl border-0 text-white"
                style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
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

export default ForgotPassword;
