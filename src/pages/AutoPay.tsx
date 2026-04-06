import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Save,
  Clock,
  DollarSign,
  MapPin,
  Car,
  CreditCard,
  Users,
  Calendar,
  Lock,
  Crown,
  ArrowRight,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const provinces = [
  "All Provinces", "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
];

const daysOfWeek = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
  { label: "Sat", value: "saturday" },
  { label: "Sun", value: "sunday" },
];

const carTypes = [
  { label: "Sedan", value: "sedan" },
  { label: "SUV", value: "suv" },
  { label: "Truck", value: "truck" },
  { label: "Coupe", value: "coupe" },
  { label: "Hatchback", value: "hatchback" },
  { label: "Van", value: "van" },
  { label: "Luxury", value: "luxury" },
  { label: "Electric", value: "electric" },
];

interface AutoPayData {
  id?: string;
  enabled: boolean;
  leads_per_day: number;
  start_time: string;
  end_time: string;
  active_days: string[];
  state: string;
  credit_score_min: number;
  credit_score_max: number;
  price_range_min: number;
  price_range_max: number;
  car_type: string[];
  loan_type: string;
  age_range: string;
  distance: string;
  make: string;
  model: string;
}

const defaultSettings: AutoPayData = {
  enabled: false,
  leads_per_day: 10,
  start_time: "08:00",
  end_time: "18:00",
  active_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  state: "All Provinces",
  credit_score_min: 600,
  credit_score_max: 850,
  price_range_min: 10,
  price_range_max: 100,
  car_type: [],
  loan_type: "",
  age_range: "",
  distance: "",
  make: "",
  model: "",
};

const AutoPay = () => {
  const navigate = useNavigate();
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [tier, setTier] = useState("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutoPayData>(defaultSettings);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [todayPurchases, setTodayPurchases] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [monthUsage, setMonthUsage] = useState<{ used: number; limit: number | null }>({ used: 0, limit: null });
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);

  const isEligible = tier === "elite" || tier === "vip";

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: dealer } = await supabase
        .from("dealers")
        .select("id, subscription_tier, wallet_balance")
        .eq("user_id", session.user.id)
        .single();

      if (!dealer) return;
      setDealerId(dealer.id);
      setTier(dealer.subscription_tier);
      setWalletBalance(Number(dealer.wallet_balance));

      // Load autopay settings
      const { data: ap } = await supabase
        .from("autopay_settings")
        .select("*")
        .eq("dealer_id", dealer.id)
        .maybeSingle();

      if (ap) {
        setExistingId(ap.id);
        setSettings({
          enabled: ap.enabled ?? false,
          leads_per_day: ap.leads_per_day ?? 10,
          start_time: ap.start_time ?? "08:00",
          end_time: ap.end_time ?? "18:00",
          active_days: (ap.active_days as string[]) ?? defaultSettings.active_days,
          state: ap.state ?? "All Provinces",
          credit_score_min: ap.credit_score_min ?? 600,
          credit_score_max: ap.credit_score_max ?? 850,
          price_range_min: ap.price_range_min ?? 10,
          price_range_max: ap.price_range_max ?? 100,
          car_type: (ap.car_type as string[]) ?? [],
          loan_type: ap.loan_type ?? "",
          age_range: ap.age_range ?? "",
          distance: ap.distance ?? "",
          make: ap.make ?? "",
          model: ap.model ?? "",
        });
      }

      // Load today's autopay purchases
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: todayTxns } = await supabase
        .from("wallet_transactions")
        .select("amount, created_at, description")
        .eq("dealer_id", dealer.id)
        .eq("type", "autopay")
        .gte("created_at", `${todayStr}T00:00:00.000Z`)
        .order("created_at", { ascending: false });

      if (todayTxns) {
        setTodayPurchases(todayTxns.length);
        setTodaySpent(todayTxns.reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
      }

      // Load recent autopay purchases (last 10)
      const { data: recent } = await supabase
        .from("wallet_transactions")
        .select("amount, created_at, description")
        .eq("dealer_id", dealer.id)
        .eq("type", "autopay")
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentPurchases(recent ?? []);

      // Load monthly usage
      const now = new Date();
      const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: usage } = await supabase
        .from("dealer_subscription_usage")
        .select("leads_used, leads_limit")
        .eq("dealer_id", dealer.id)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (usage) {
        setMonthUsage({ used: usage.leads_used, limit: usage.leads_limit });
      }

      setLoading(false);
    };
    load();
  }, []);

  const update = <K extends keyof AutoPayData>(key: K, value: AutoPayData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      active_days: prev.active_days.includes(day)
        ? prev.active_days.filter((d) => d !== day)
        : [...prev.active_days, day],
    }));
  };

  const toggleCarType = (type: string) => {
    setSettings((prev) => ({
      ...prev,
      car_type: prev.car_type.includes(type)
        ? prev.car_type.filter((t) => t !== type)
        : [...prev.car_type, type],
    }));
  };

  const save = async () => {
    if (!dealerId) return;
    setSaving(true);

    const payload = {
      dealer_id: dealerId,
      enabled: settings.enabled,
      leads_per_day: settings.leads_per_day,
      start_time: settings.start_time,
      end_time: settings.end_time,
      active_days: settings.active_days,
      state: settings.state === "All Provinces" ? null : settings.state,
      credit_score_min: settings.credit_score_min,
      credit_score_max: settings.credit_score_max,
      price_range_min: settings.price_range_min,
      price_range_max: settings.price_range_max,
      car_type: settings.car_type.length > 0 ? settings.car_type : null,
      loan_type: settings.loan_type || null,
      age_range: settings.age_range || null,
      distance: settings.distance || null,
      make: settings.make || null,
      model: settings.model || null,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("autopay_settings").update(payload).eq("id", existingId));
    } else {
      const { data, error: e } = await supabase.from("autopay_settings").insert(payload).select("id").single();
      error = e;
      if (data) setExistingId(data.id);
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save AutoPay settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "AutoPay settings updated successfully." });
    }
  };

  const runNow = async () => {
    if (!dealerId) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-autopay", {
        body: { time: new Date().toISOString() },
      });
      if (error) throw error;
      const purchased = data?.total_purchased ?? 0;
      const myResult = data?.results?.find((r: any) => r.dealer_id === dealerId);
      const myPurchased = myResult?.purchased ?? 0;
      const skipped = myResult?.skipped || "";

      if (myPurchased > 0) {
        toast({ title: "AutoPay Complete", description: `Purchased ${myPurchased} lead${myPurchased > 1 ? "s" : ""} matching your criteria.` });
        // Refresh stats
        const { data: dealer } = await supabase
          .from("dealers")
          .select("wallet_balance")
          .eq("id", dealerId)
          .single();
        if (dealer) setWalletBalance(Number(dealer.wallet_balance));

        const todayStr = new Date().toISOString().split("T")[0];
        const { data: todayTxns } = await supabase
          .from("wallet_transactions")
          .select("amount, created_at, description")
          .eq("dealer_id", dealerId)
          .eq("type", "autopay")
          .gte("created_at", `${todayStr}T00:00:00.000Z`)
          .order("created_at", { ascending: false });
        if (todayTxns) {
          setTodayPurchases(todayTxns.length);
          setTodaySpent(todayTxns.reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
        }

        const { data: recent } = await supabase
          .from("wallet_transactions")
          .select("amount, created_at, description")
          .eq("dealer_id", dealerId)
          .eq("type", "autopay")
          .order("created_at", { ascending: false })
          .limit(10);
        setRecentPurchases(recent ?? []);
      } else if (skipped) {
        toast({ title: "No Purchases", description: skipped });
      } else {
        toast({ title: "No Purchases", description: "No matching leads found right now." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to run AutoPay.", variant: "destructive" });
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    );
  }

  // Gate for non-eligible tiers
  if (!isEligible) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass-card p-8 text-center space-y-5">
          <div className="h-16 w-16 rounded-2xl bg-gold/15 flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AutoPay is an Elite & VIP Feature</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            AutoPay automatically purchases leads matching your criteria so you never miss a hot opportunity.
            Upgrade to Elite or VIP to unlock this feature.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">
              <Crown className="h-3 w-3 mr-1" /> Elite
            </Badge>
            <span>or</span>
            <Badge className="bg-gold/20 text-gold border-gold/30 text-xs">
              <Crown className="h-3 w-3 mr-1" /> VIP
            </Badge>
          </div>
          <Button
            onClick={() => navigate("/subscription")}
            className="gradient-blue-cyan text-foreground gap-2"
          >
            Upgrade Now <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-gold" />
            AutoPay
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automatically purchase leads that match your criteria
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={runNow}
            disabled={running || !settings.enabled}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <Play className="h-3.5 w-3.5" />
            {running ? "Running…" : "Run Now"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {settings.enabled ? "Active" : "Paused"}
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => update("enabled", v)}
            className="data-[state=checked]:bg-success"
          />
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <DollarSign className="h-3.5 w-3.5" />
            Wallet Balance
          </div>
          <p className="text-lg font-bold text-foreground">${walletBalance.toFixed(2)}</p>
        </div>
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Zap className="h-3.5 w-3.5" />
            Today's Purchases
          </div>
          <p className="text-lg font-bold text-foreground">
            {todayPurchases}
            <span className="text-xs font-normal text-muted-foreground">/{settings.leads_per_day}</span>
          </p>
        </div>
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <DollarSign className="h-3.5 w-3.5" />
            Spent Today
          </div>
          <p className="text-lg font-bold text-foreground">${todaySpent.toFixed(2)}</p>
        </div>
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Users className="h-3.5 w-3.5" />
            Monthly Usage
          </div>
          <p className="text-lg font-bold text-foreground">
            {monthUsage.used}
            {monthUsage.limit !== null && (
              <span className="text-xs font-normal text-muted-foreground">/{monthUsage.limit}</span>
            )}
          </p>
        </div>
      </div>

      <div className={cn("space-y-6 transition-opacity", !settings.enabled && "opacity-50 pointer-events-none")}>
        {/* Schedule */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Schedule & Limits</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Leads Per Day</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.leads_per_day}
                onChange={(e) => update("leads_per_day", parseInt(e.target.value) || 1)}
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Start Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={settings.start_time}
                  onChange={(e) => update("start_time", e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">End Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={settings.end_time}
                  onChange={(e) => update("end_time", e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Active Days</Label>
            <div className="flex gap-2 flex-wrap">
              {daysOfWeek.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    settings.active_days.includes(day.value)
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lead Filters */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-cyan" />
            <h2 className="text-sm font-semibold text-foreground">Financial Filters</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Credit Score Range</Label>
                <span className="text-xs font-mono text-foreground">
                  {settings.credit_score_min} – {settings.credit_score_max}
                </span>
              </div>
              <Slider
                min={300}
                max={900}
                step={10}
                value={[settings.credit_score_min, settings.credit_score_max]}
                onValueChange={([min, max]) => {
                  update("credit_score_min", min);
                  update("credit_score_max", max);
                }}
                className="py-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Lead Price Range ($)</Label>
                  <span className="text-xs font-mono text-foreground">
                    ${settings.price_range_min} – ${settings.price_range_max}
                  </span>
                </div>
                <Slider
                  min={5}
                  max={200}
                  step={5}
                  value={[settings.price_range_min, settings.price_range_max]}
                  onValueChange={([min, max]) => {
                    update("price_range_min", min);
                    update("price_range_max", max);
                  }}
                  className="py-2"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Loan Type</Label>
                <Select value={settings.loan_type} onValueChange={(v) => update("loan_type", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Any loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="new">New Vehicle</SelectItem>
                    <SelectItem value="used">Used Vehicle</SelectItem>
                    <SelectItem value="refinance">Refinance</SelectItem>
                    <SelectItem value="lease">Lease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle & Location */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Car className="h-4 w-4 text-secondary" />
            <h2 className="text-sm font-semibold text-foreground">Vehicle & Location</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Vehicle Types</Label>
              <div className="flex gap-2 flex-wrap">
                {carTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => toggleCarType(type.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      settings.car_type.includes(type.value)
                        ? "bg-secondary/20 text-secondary border-secondary/30"
                        : "bg-card text-muted-foreground border-border hover:border-secondary/30"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Make</Label>
                <Input
                  value={settings.make}
                  onChange={(e) => update("make", e.target.value)}
                  placeholder="e.g. Toyota"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Input
                  value={settings.model}
                  onChange={(e) => update("model", e.target.value)}
                  placeholder="e.g. Camry"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Province</Label>
                <Select value={settings.state} onValueChange={(v) => update("state", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Distance from Dealership</Label>
                <Select value={settings.distance} onValueChange={(v) => update("distance", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Any distance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Distance</SelectItem>
                    <SelectItem value="25km">Within 25 km</SelectItem>
                    <SelectItem value="50km">Within 50 km</SelectItem>
                    <SelectItem value="100km">Within 100 km</SelectItem>
                    <SelectItem value="200km">Within 200 km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Buyer Age Range</Label>
                <Select value={settings.age_range} onValueChange={(v) => update("age_range", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Any age" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Age</SelectItem>
                    <SelectItem value="18-25">18–25</SelectItem>
                    <SelectItem value="26-35">26–35</SelectItem>
                    <SelectItem value="36-45">36–45</SelectItem>
                    <SelectItem value="46-55">46–55</SelectItem>
                    <SelectItem value="56+">56+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent AutoPay Activity */}
      {recentPurchases.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent AutoPay Activity
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentPurchases.map((txn, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">{txn.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(txn.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-sm font-mono text-destructive">
                  -${Math.abs(Number(txn.amount)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save AutoPay Settings"}
        </Button>
      </div>
    </div>
  );
};

export default AutoPay;
