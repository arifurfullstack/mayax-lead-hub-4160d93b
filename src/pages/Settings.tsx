import { useState, useEffect, useRef } from "react";
import {
  User,
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Bell,
  Webhook,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Copy,
  Check,
  Camera,
  Loader2,
  Tag,
  X,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface DealerProfile {
  id: string;
  user_id: string;
  dealership_name: string;
  contact_person: string;
  email: string;
  phone: string | null;
  address: string | null;
  province: string | null;
  website: string | null;
  business_type: string | null;
  notification_email: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  autopay_enabled: boolean | null;
  profile_picture_url: string | null;
}

interface ActivePromo {
  id: string;
  code: string;
  discount_type: string;
  flat_price: number;
  discount_value: number;
  expires_at: string | null;
}

const provinces = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
  "Northwest Territories", "Nunavut", "Yukon",
];

const Settings = () => {
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [deliveryLogs, setDeliveryLogs] = useState<Array<{
    id: string;
    success: boolean | null;
    response_code: number | null;
    error_details: string | null;
    payload_summary: string | null;
    endpoint: string | null;
    attempted_at: string;
  }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Promo state
  const [promoInput, setPromoInput] = useState("");
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [activePromo, setActivePromo] = useState<ActivePromo | null>(null);
  const [removingPromo, setRemovingPromo] = useState(false);

  // Form state
  const [form, setForm] = useState({
    dealership_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    province: "",
    website: "",
    business_type: "independent",
    notification_email: "",
    webhook_url: "",
    webhook_secret: "",
  });

  const loadActivePromo = async (dealerId: string) => {
    const { data: dealerPromo } = await supabase
      .from("dealer_promo_codes")
      .select("promo_code_id")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (dealerPromo) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("id, code, flat_price, discount_type, discount_value, expires_at, is_active")
        .eq("id", dealerPromo.promo_code_id)
        .single();

      if (promo && promo.is_active) {
        const notExpired = !promo.expires_at || new Date(promo.expires_at) > new Date();
        if (notExpired) {
          setActivePromo({
            id: promo.id,
            code: promo.code,
            discount_type: (promo as any).discount_type || "flat",
            flat_price: Number(promo.flat_price),
            discount_value: Number((promo as any).discount_value || 0),
            expires_at: promo.expires_at,
          });
          return;
        }
      }
    }
    setActivePromo(null);
  };

  const loadDeliveryLogs = async (dealerId: string) => {
    setLoadingLogs(true);
    const { data: purchases } = await supabase
      .from("purchases")
      .select("id")
      .eq("dealer_id", dealerId);
    const ids = (purchases || []).map((p) => p.id);
    if (!ids.length) {
      setDeliveryLogs([]);
      setLoadingLogs(false);
      return;
    }
    const { data: logs } = await supabase
      .from("delivery_logs")
      .select("id, success, response_code, error_details, payload_summary, endpoint, attempted_at")
      .eq("channel", "webhook")
      .in("purchase_id", ids)
      .order("attempted_at", { ascending: false })
      .limit(20);
    setDeliveryLogs((logs as any) || []);
    setLoadingLogs(false);
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("dealers")
        .select("id, user_id, dealership_name, contact_person, email, phone, address, province, website, business_type, notification_email, webhook_url, webhook_secret, autopay_enabled, profile_picture_url")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setDealer(data as DealerProfile);
        setAvatarUrl(data.profile_picture_url || null);
        setForm({
          dealership_name: data.dealership_name || "",
          contact_person: data.contact_person || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          province: data.province || "",
          website: data.website || "",
          business_type: data.business_type || "independent",
          notification_email: data.notification_email || "",
          webhook_url: data.webhook_url || "",
          webhook_secret: data.webhook_secret || "",
        });
        await loadActivePromo(data.id);
        loadDeliveryLogs(data.id);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    if (!dealer) return;
    setSaving(true);

    const { error } = await supabase
      .from("dealers")
      .update({
        dealership_name: form.dealership_name,
        contact_person: form.contact_person,
        phone: form.phone || null,
        address: form.address || null,
        province: form.province || null,
        website: form.website || null,
        business_type: form.business_type,
      })
      .eq("id", dealer.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Profile updated successfully." });
    }
  };

  const saveNotifications = async () => {
    if (!dealer) return;
    setSaving(true);

    const { error } = await supabase
      .from("dealers")
      .update({ notification_email: form.notification_email || null })
      .eq("id", dealer.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to update notification settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Notification preferences updated." });
    }
  };

  const saveWebhook = async () => {
    if (!dealer) return;
    setSaving(true);

    const { error } = await supabase
      .from("dealers")
      .update({
        webhook_url: form.webhook_url || null,
        webhook_secret: form.webhook_secret || null,
      })
      .eq("id", dealer.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to update webhook settings.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Webhook configuration updated." });
    }
  };

  const generateSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let secret = "whsec_";
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateField("webhook_secret", secret);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(form.webhook_secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const sendTestWebhook = async () => {
    if (!form.webhook_url) {
      toast({ title: "Webhook URL required", description: "Add and save a webhook URL first.", variant: "destructive" });
      return;
    }
    setTestingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-webhook");
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Test webhook delivered ✓",
          description: `${data.endpoint} responded with ${data.response_code}${data.signed ? " (signed)" : ""}.`,
        });
      } else {
        toast({
          title: `Test failed${data?.response_code ? ` (HTTP ${data.response_code})` : ""}`,
          description: data?.error || "Your endpoint did not accept the payload.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err?.message || "Could not send test payload.", variant: "destructive" });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dealer) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 2MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const filePath = `${dealer.user_id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase
      .from("dealers")
      .update({ profile_picture_url: publicUrl })
      .eq("id", dealer.id);

    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    toast({ title: "Updated", description: "Profile picture updated successfully." });
  };

  const applyPromoCode = async () => {
    if (!dealer || !promoInput.trim()) return;
    setApplyingPromo(true);

    // Look up the promo code
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("id, code, flat_price, discount_type, discount_value, is_active, max_uses, times_used, expires_at")
      .eq("code", promoInput.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !promo) {
      toast({ title: "Invalid Code", description: "Promo code not found or inactive.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }

    // Check expiry
    if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
      toast({ title: "Expired", description: "This promo code has expired.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }

    // Check max uses
    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      toast({ title: "Maxed Out", description: "This promo code has reached its usage limit.", variant: "destructive" });
      setApplyingPromo(false);
      return;
    }

    // Remove existing promo if any
    await supabase.from("dealer_promo_codes").delete().eq("dealer_id", dealer.id);

    // Apply new promo
    const { error: insertErr } = await supabase.from("dealer_promo_codes").insert({
      dealer_id: dealer.id,
      promo_code_id: promo.id,
    });

    if (insertErr) {
      toast({ title: "Error", description: "Failed to apply promo code.", variant: "destructive" });
    } else {
      setActivePromo({
        id: promo.id,
        code: promo.code,
        discount_type: (promo as any).discount_type || "flat",
        flat_price: Number(promo.flat_price),
        discount_value: Number((promo as any).discount_value || 0),
        expires_at: promo.expires_at,
      });
      setPromoInput("");
      toast({ title: "Applied!", description: `Promo code ${promo.code} is now active on your account.` });
    }
    setApplyingPromo(false);
  };

  const removePromoCode = async () => {
    if (!dealer) return;
    setRemovingPromo(true);
    await supabase.from("dealer_promo_codes").delete().eq("dealer_id", dealer.id);
    setActivePromo(null);
    setRemovingPromo(false);
    toast({ title: "Removed", description: "Promo code removed from your account." });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your dealership profile, notifications, and integrations
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Avatar Upload */}
          <div className="glass-card p-6 flex items-center gap-6">
            <div className="relative group">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-muted ring-2 ring-border">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/20 text-primary text-2xl font-bold">
                    {(dealer?.dealership_name || "D").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-foreground" /> : <Camera className="h-5 w-5 text-foreground" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{dealer?.dealership_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Click the avatar to upload a new photo (max 2MB)</p>
            </div>
          </div>

          {/* Business Info */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Business Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Dealership Name</Label>
                <Input
                  value={form.dealership_name}
                  onChange={(e) => updateField("dealership_name", e.target.value)}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Contact Person</Label>
                <Input
                  value={form.contact_person}
                  onChange={(e) => updateField("contact_person", e.target.value)}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Business Type</Label>
                <Select value={form.business_type} onValueChange={(v) => updateField("business_type", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">Independent</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                    <SelectItem value="group">Dealer Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://..."
                    className="pl-9 bg-card border-border"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact & Location */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-cyan" />
              <h2 className="text-sm font-semibold text-foreground">Contact & Location</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.email}
                    disabled
                    className="pl-9 bg-muted/30 border-border text-muted-foreground cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Email cannot be changed. Contact support.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+1-XXX-XXX-XXXX"
                    className="pl-9 bg-card border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Province</Label>
                <Select value={form.province} onValueChange={(v) => updateField("province", v)}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-secondary" />
              <h2 className="text-sm font-semibold text-foreground">Email Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notification Email</Label>
                <p className="text-[10px] text-muted-foreground">
                  Lead delivery notifications will be sent here. Leave blank to use your primary email.
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.notification_email}
                    onChange={(e) => updateField("notification_email", e.target.value)}
                    placeholder={form.email || "your@email.com"}
                    className="pl-9 bg-card border-border"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notification Types</h3>
                <div className="space-y-3">
                  {[
                    { label: "New lead purchased", desc: "Get notified when a lead is purchased from the marketplace", defaultOn: true },
                    { label: "Delivery status updates", desc: "Alerts when lead delivery succeeds or fails", defaultOn: true },
                    { label: "Wallet balance low", desc: "Warning when your wallet drops below $10", defaultOn: true },
                    { label: "Subscription renewal", desc: "Reminder before your subscription renews", defaultOn: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                      <div>
                        <p className="text-sm text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch defaultChecked={item.defaultOn} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveNotifications} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Notifications"}
            </Button>
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Webhook className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-foreground">Webhook Configuration</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure a webhook endpoint to receive lead data automatically when a purchase is made.
              We'll send a POST request with the full lead details to your endpoint.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={form.webhook_url}
                      onChange={(e) => updateField("webhook_url", e.target.value)}
                      placeholder="https://your-crm.com/api/leads"
                      className="pl-9 bg-card border-border"
                      autoComplete="off"
                      name="mx-webhook-url"
                      data-lpignore="true"
                      data-1p-ignore="true"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={sendTestWebhook}
                    disabled={testingWebhook || !form.webhook_url}
                  >
                    {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {testingWebhook ? "Sending…" : "Send test"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Sends a sample <code className="font-mono">lead.purchased</code> payload to your URL using your saved secret.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Webhook Secret</Label>
                <p className="text-[10px] text-muted-foreground">
                  Used to sign payloads so you can verify they came from MayaX.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={form.webhook_secret}
                      onChange={(e) => updateField("webhook_secret", e.target.value)}
                      type={showWebhookSecret ? "text" : "password"}
                      placeholder="whsec_..."
                      className="pl-9 pr-20 bg-card border-border font-mono text-xs"
                      autoComplete="off"
                      name="mx-webhook-secret"
                      data-lpignore="true"
                      data-1p-ignore="true"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      >
                        {showWebhookSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={copySecret}
                        disabled={!form.webhook_secret}
                      >
                        {copiedSecret ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={generateSecret}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                </div>
              </div>

              {/* Payload Preview */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">Example Payload</Label>
                <pre className="bg-muted/30 border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto">
{`{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john@example.com",
  "phone": "+1-416-555-0100",
  "city": "Toronto",
  "province": "Ontario",
  "income": 5500,
  "credit_range_min": 700,
  "credit_range_max": 750,
  "vehicle_preference": "SUV",
  "trade_in": true,
  "trade_in vehicle": "2018 Honda Civic",
  "bankruptcy": "",
  "notes": "Looking for financing"
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Recent Delivery Attempts */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-cyan" />
                <h2 className="text-sm font-semibold text-foreground">Recent Delivery Attempts</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => dealer && loadDeliveryLogs(dealer.id)}
                disabled={loadingLogs || !dealer}
              >
                {loadingLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 20 webhook deliveries triggered by lead purchases. Use this to debug why your CRM isn't receiving payloads.
            </p>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : deliveryLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No webhook deliveries yet. Buy a lead from the marketplace to trigger one.
              </div>
            ) : (
              <div className="space-y-2">
                {deliveryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3"
                  >
                    <div className="shrink-0 mt-0.5">
                      {log.success ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono",
                            log.success
                              ? "border-success/40 text-success"
                              : "border-destructive/40 text-destructive",
                          )}
                        >
                          {log.response_code ?? "—"}
                        </Badge>
                        <span className="text-xs font-medium text-foreground truncate">
                          {log.payload_summary || "lead.purchased"}
                        </span>
                      </div>
                      {log.endpoint && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {log.endpoint}
                        </div>
                      )}
                      {log.error_details && (
                        <div className="text-[11px] text-destructive break-words">
                          {log.error_details}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.attempted_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={saveWebhook} disabled={saving} className="gradient-blue-cyan text-foreground gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Webhook"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
