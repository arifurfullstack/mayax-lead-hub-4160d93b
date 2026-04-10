import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, User, Mail, Phone, MapPin, Globe, ChevronRight, ChevronLeft, Check, Bell, Lock, Crosshair, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/mayax-logo.jpg";

const STEPS = ["Business Info", "Dealer Details"];

const trustBadges = [
  { icon: Crosshair, label: "PREMIUM", sub: "Verified Leads" },
  { icon: Zap, label: "FAST", sub: "Instant Access" },
  { icon: ShieldCheck, label: "TRUSTED", sub: "Quality Buyers" },
];

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [form, setForm] = useState({
    dealershipName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    password: "",
    businessType: "independent",
    province: "",
    heardAbout: "",
  });

  const updateField = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const canNext = () => {
    if (step === 0) return form.dealershipName && form.contactPerson && form.email && form.phone && form.address && form.password;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create account");

      const { error: dealerError } = await supabase.from("dealers").insert({
        user_id: authData.user.id,
        dealership_name: form.dealershipName,
        contact_person: form.contactPerson,
        email: form.email,
        phone: form.phone,
        address: form.address,
        website: form.website || null,
        business_type: form.businessType,
        province: form.province || null,
      });
      if (dealerError) throw dealerError;

      setShowConfirmation(true);
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050510] relative overflow-hidden">
        <Starfield />
        <div
          className="relative z-10 rounded-2xl p-10 max-w-md text-center border border-primary/20"
          style={{
            background: "linear-gradient(145deg, rgba(15,23,41,0.95), rgba(10,15,30,0.98))",
            boxShadow: "0 0 60px rgba(59,130,246,0.08), 0 0 120px rgba(139,92,246,0.05), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Application Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your application is under review. We'll notify you by email once approved.
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="w-full h-12 rounded-xl text-white border-0"
            style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#050510] relative overflow-hidden">
      <Starfield />

      {/* Left Brand Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative z-10">
        <div className="text-center max-w-lg">
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

      {/* Right Registration Section */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 relative z-10">
        <div className="w-full max-w-md">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"}`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < STEPS.length - 1 && <div className={`w-6 h-[2px] ${i < step ? "bg-primary" : "bg-white/10"}`} />}
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-8 border border-primary/20 relative overflow-hidden"
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

            <h2 className="text-2xl font-bold text-foreground mb-1">Create Dealer Account</h2>
            <p className="text-muted-foreground text-sm mb-6">{STEPS[step]}</p>

            {step === 0 && (
              <div className="space-y-4">
                <FormInput icon={Building2} placeholder="Dealership Name *" value={form.dealershipName} onChange={(v) => updateField("dealershipName", v)} />
                <FormInput icon={User} placeholder="Contact Person *" value={form.contactPerson} onChange={(v) => updateField("contactPerson", v)} />
                <FormInput icon={Mail} type="email" placeholder="Email *" value={form.email} onChange={(v) => updateField("email", v)} />
                <FormInput icon={Phone} placeholder="Phone *" value={form.phone} onChange={(v) => updateField("phone", v)} />
                <FormInput icon={MapPin} placeholder="Business Address *" value={form.address} onChange={(v) => updateField("address", v)} />
                <FormInput icon={Globe} placeholder="Website (optional)" value={form.website} onChange={(v) => updateField("website", v)} />
                <FormInput icon={Lock} type="password" placeholder="Create Password *" value={form.password} onChange={(v) => updateField("password", v)} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Dealer Type</label>
                  <Select value={form.businessType} onValueChange={(v) => updateField("businessType", v)}>
                    <SelectTrigger className="h-12 bg-white/5 border-white/10 text-foreground rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="independent">Independent</SelectItem>
                      <SelectItem value="franchise">Franchise</SelectItem>
                      <SelectItem value="subprime">Subprime</SelectItem>
                      <SelectItem value="finance">Finance-Focused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Province / State</label>
                  <Input
                    placeholder="e.g., Ontario, California"
                    value={form.province}
                    onChange={(e) => updateField("province", e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">How did you hear about us?</label>
                  <Input
                    placeholder="Optional"
                    value={form.heardAbout}
                    onChange={(e) => updateField("heardAbout", e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="border-white/15 text-foreground hover:bg-white/5 rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <div className="flex-1" />
              {step < 1 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext()}
                  className="rounded-xl text-white border-0"
                  style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-xl text-white border-0"
                  style={{ background: "linear-gradient(135deg, hsl(263,70%,50%), hsl(217,91%,50%), hsl(192,91%,42%))" }}
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
              )}
            </div>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-white/10" />
              <span className="px-4 text-sm text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-white/10" />
            </div>

            <Button
              variant="outline"
              className="w-full h-12 text-base border-white/15 text-foreground hover:bg-white/5 rounded-xl"
              onClick={() => navigate("/login")}
            >
              Sign In to Existing Account
            </Button>

            <div className="mt-6 flex items-center justify-center gap-2">
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

const FormInput = ({ icon: Icon, placeholder, value, onChange, type = "text" }: { icon: any; placeholder: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div className="relative">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-11 h-12 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/40"
    />
  </div>
);

export default Register;
