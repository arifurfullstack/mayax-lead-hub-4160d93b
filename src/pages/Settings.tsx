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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setDealer(data);
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
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.webhook_url}
                    onChange={(e) => updateField("webhook_url", e.target.value)}
                    placeholder="https://your-crm.com/api/leads"
                    className="pl-9 bg-card border-border"
                  />
                </div>
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
  "event": "lead.purchased",
  "timestamp": "2026-04-04T12:00:00Z",
  "data": {
    "reference_code": "MX-2026-001",
    "first_name": "John",
    "last_name": "Smith",
    "phone": "+1-416-555-0100",
    "email": "john@example.com",
    "credit_range": "700-750",
    "vehicle_preference": "SUV",
    "price_paid": 45.00
  }
}`}
                </pre>
              </div>
            </div>
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
