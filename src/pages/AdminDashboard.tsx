import { useState, useEffect } from "react";
import {
  Users,
  FileText,
  Settings2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Eye,
  Search,
  RefreshCw,
  Save,
  Shield,
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  Trash2,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import AdminPlanManager from "@/components/AdminPlanManager";
import AdminPaymentManager from "@/components/AdminPaymentManager";
import AdminBrandingSettings from "@/components/AdminBrandingSettings";
import LeadFileUploader from "@/components/LeadFileUploader";
import AdminLeadTable, { type AdminLead } from "@/components/AdminLeadTable";

/* ─── Types ─── */
interface Dealer {
  id: string;
  dealership_name: string;
  contact_person: string;
  email: string;
  phone: string | null;
  province: string | null;
  approval_status: string;
  subscription_tier: string;
  wallet_balance: number;
  created_at: string;
}

interface LeadFileEntry {
  name: string;
  path: string;
}

interface Lead extends AdminLead {}

/* ─── Helpers ─── */
const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  approved: { color: "bg-success/20 text-success", icon: CheckCircle2 },
  pending: { color: "bg-warning/20 text-warning", icon: Clock },
  rejected: { color: "bg-destructive/20 text-destructive", icon: XCircle },
  suspended: { color: "bg-muted text-muted-foreground", icon: Ban },
};

const gradeColors: Record<string, string> = {
  "A+": "bg-gold/20 text-gold",
  A: "bg-primary/20 text-primary",
  B: "bg-cyan/20 text-cyan",
  C: "bg-muted text-muted-foreground",
};

/* ─── Component ─── */
const AdminDashboard = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerSearch, setDealerSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState(""); // kept for backwards compat
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: d }, { data: l }, { data: s }] = await Promise.all([
      supabase.from("dealers").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("*"),
    ]);
    setDealers((d as Dealer[]) ?? []);
    setLeads((l as unknown as Lead[]) ?? []);
    const settingsMap: Record<string, string> = {};
    (s ?? []).forEach((row: any) => { settingsMap[row.key] = row.value ?? ""; });
    setPlatformSettings(settingsMap);
    setSettingsForm(settingsMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  /* ─── Dealer Actions ─── */
  const updateDealerStatus = async (dealerId: string, status: string) => {
    const { error } = await supabase.from("dealers").update({ approval_status: status }).eq("id", dealerId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Dealer status set to ${status}.` });
      setDealers((prev) => prev.map((d) => d.id === dealerId ? { ...d, approval_status: status } : d));
      setSelectedDealer(null);
    }
  };

  const updateDealerTier = async (dealerId: string, tier: string) => {
    const { error } = await supabase.from("dealers").update({ subscription_tier: tier }).eq("id", dealerId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Dealer tier set to ${tier}.` });
      setDealers((prev) => prev.map((d) => d.id === dealerId ? { ...d, subscription_tier: tier } : d));
    }
  };

  /* ─── Platform Settings Actions ─── */
  const savePlatformSettings = async () => {
    setSavingSettings(true);
    const entries = Object.entries(settingsForm);
    for (const [key, value] of entries) {
      if (platformSettings[key] !== undefined) {
        await supabase.from("platform_settings").update({ value }).eq("key", key);
      } else {
        await supabase.from("platform_settings").insert({ key, value });
      }
    }
    setPlatformSettings({ ...settingsForm });
    setSavingSettings(false);
    toast({ title: "Saved", description: "Platform settings updated." });
  };

  /* ─── Delete Lead ─── */
  const [deletingLead, setDeletingLead] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteLead = async (leadId: string) => {
    setDeletingLead(true);
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    setDeletingLead(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Lead has been removed." });
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelectedLead(null);
      setConfirmDelete(false);
    }
  };

  /* ─── Edit Lead ─── */
  const [editingLead, setEditingLead] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    city: "", province: "", quality_grade: "B", ai_score: "",
    price: "", sold_status: "available",
  });

  const saveLeadEdits = async () => {
    if (!selectedLead) return;
    setSavingLead(true);
    const updates = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      email: editForm.email || null,
      phone: editForm.phone || null,
      city: editForm.city || null,
      province: editForm.province || null,
      quality_grade: editForm.quality_grade,
      ai_score: editForm.ai_score ? Number(editForm.ai_score) : 0,
      price: Number(editForm.price),
      sold_status: editForm.sold_status,
    };
    const { error } = await supabase.from("leads").update(updates).eq("id", selectedLead.id);
    setSavingLead(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Lead updated successfully." });
      const updated = { ...selectedLead, ...updates };
      setSelectedLead(updated as Lead);
      setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, ...updates } as Lead : l));
      setEditingLead(false);
    }
  };

  /* ─── Filtered Data ─── */
  const filteredDealers = dealers.filter((d) => {
    const matchSearch =
      d.dealership_name.toLowerCase().includes(dealerSearch.toLowerCase()) ||
      d.email.toLowerCase().includes(dealerSearch.toLowerCase()) ||
      d.contact_person.toLowerCase().includes(dealerSearch.toLowerCase());
    const matchStatus = statusFilter === "all" || d.approval_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredLeads = leads.filter((l) =>
    l.reference_code.toLowerCase().includes(leadSearch.toLowerCase()) ||
    l.first_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
    l.last_name.toLowerCase().includes(leadSearch.toLowerCase())
  );

  /* ─── Stats ─── */
  const totalDealers = dealers.length;
  const approvedDealers = dealers.filter((d) => d.approval_status === "approved").length;
  const pendingDealers = dealers.filter((d) => d.approval_status === "pending").length;
  const totalLeads = leads.length;
  const availableLeads = leads.filter((l) => l.sold_status === "available").length;
  const totalRevenue = leads.filter((l) => l.sold_status === "sold").reduce((sum, l) => sum + Number(l.price), 0);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-card rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gold" />
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Manage dealers, leads, and platform configuration
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Dealers</span>
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalDealers}</p>
          <p className="text-xs text-muted-foreground">{approvedDealers} approved · {pendingDealers} pending</p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Leads</span>
            <div className="h-8 w-8 rounded-lg bg-cyan/15 flex items-center justify-center">
              <FileText className="h-4 w-4 text-cyan" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
          <p className="text-xs text-muted-foreground">{availableLeads} available</p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Revenue</span>
            <div className="h-8 w-8 rounded-lg bg-gold/15 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-gold" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">From sold leads</p>
        </div>
        <div className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pending Approvals</span>
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </div>
          <p className="text-2xl font-bold text-warning">{pendingDealers}</p>
          <p className="text-xs text-muted-foreground">Require review</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dealers" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="dealers" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Users className="h-4 w-4" /> Dealers
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <FileText className="h-4 w-4" /> Leads
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Settings2 className="h-4 w-4" /> Platform Settings
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <CreditCard className="h-4 w-4" /> Plans
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <DollarSign className="h-4 w-4" /> Payments
          </TabsTrigger>
        </TabsList>

        {/* ─── Dealers Tab ─── */}
        <TabsContent value="dealers" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dealers..."
                value={dealerSearch}
                onChange={(e) => setDealerSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Dealership</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Contact</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Province</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Tier</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Balance</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDealers.map((d) => {
                    const st = statusConfig[d.approval_status] ?? statusConfig.pending;
                    const StIcon = st.icon;
                    return (
                      <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{d.dealership_name}</p>
                          <p className="text-xs text-muted-foreground">{d.email}</p>
                        </td>
                        <td className="p-3 text-muted-foreground">{d.contact_person}</td>
                        <td className="p-3 text-muted-foreground">{d.province ?? "—"}</td>
                        <td className="p-3">
                          <Badge className={cn("gap-1 border-0 text-[10px]", st.color)}>
                            <StIcon className="h-3 w-3" />
                            {d.approval_status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Select value={d.subscription_tier} onValueChange={(v) => updateDealerTier(d.id, v)}>
                            <SelectTrigger className="h-7 text-xs bg-card border-border w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="elite">Elite</SelectItem>
                              <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">${Number(d.wallet_balance).toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDealer(d)}>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDealers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">No dealers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <AdminLeadTable leads={leads} onSelectLead={(l) => setSelectedLead(l)} onRefresh={fetchData} />
        </TabsContent>

        {/* ─── Platform Settings Tab ─── */}
        <TabsContent value="settings" className="space-y-6">
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Platform Configuration</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              These settings control global platform behavior, branding, and pricing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "theme_website_name", label: "Website Name", placeholder: "MayaX" },
                { key: "theme_logo_url", label: "Logo URL", placeholder: "https://..." },
                { key: "lead_base_price", label: "Base Lead Price ($)", placeholder: "25.00" },
                { key: "tier_vip_delay_hours", label: "VIP Delay (hours)", placeholder: "0" },
                { key: "tier_elite_delay_hours", label: "Elite Delay (hours)", placeholder: "6" },
                { key: "tier_pro_delay_hours", label: "Pro Delay (hours)", placeholder: "12" },
                { key: "tier_basic_delay_hours", label: "Basic Delay (hours)", placeholder: "24" },
                { key: "support_email", label: "Support Email", placeholder: "support@mayax.com" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    value={settingsForm[key] ?? ""}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="bg-card border-border"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={savePlatformSettings} disabled={savingSettings} className="gradient-blue-cyan text-foreground gap-2">
              <Save className="h-4 w-4" />
              {savingSettings ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* ─── Plans Tab ─── */}
        <TabsContent value="plans" className="space-y-4">
          <AdminPlanManager />
        </TabsContent>

        {/* ─── Payments Tab ─── */}
        <TabsContent value="payments" className="space-y-4">
          <AdminPaymentManager />
        </TabsContent>
      </Tabs>

      {/* ─── Dealer Detail Dialog ─── */}
      <Dialog open={!!selectedDealer} onOpenChange={() => setSelectedDealer(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedDealer?.dealership_name}</DialogTitle>
          </DialogHeader>
          {selectedDealer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Contact</span><p className="text-foreground">{selectedDealer.contact_person}</p></div>
                <div><span className="text-muted-foreground text-xs">Email</span><p className="text-foreground">{selectedDealer.email}</p></div>
                <div><span className="text-muted-foreground text-xs">Phone</span><p className="text-foreground">{selectedDealer.phone ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Province</span><p className="text-foreground">{selectedDealer.province ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Tier</span><p className="text-foreground capitalize">{selectedDealer.subscription_tier}</p></div>
                <div><span className="text-muted-foreground text-xs">Balance</span><p className="text-foreground">${Number(selectedDealer.wallet_balance).toFixed(2)}</p></div>
                <div><span className="text-muted-foreground text-xs">Joined</span><p className="text-foreground">{new Date(selectedDealer.created_at).toLocaleDateString()}</p></div>
                <div><span className="text-muted-foreground text-xs">Status</span>
                  <Badge className={cn("gap-1 border-0 text-[10px] mt-1", (statusConfig[selectedDealer.approval_status] ?? statusConfig.pending).color)}>
                    {selectedDealer.approval_status}
                  </Badge>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Update Status</Label>
                <div className="flex flex-wrap gap-2">
                  {["approved", "pending", "rejected", "suspended"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selectedDealer.approval_status === s ? "default" : "outline"}
                      className="capitalize text-xs"
                      onClick={() => updateDealerStatus(selectedDealer.id, s)}
                      disabled={selectedDealer.approval_status === s}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Lead Detail / Edit Dialog ─── */}
      <Dialog open={!!selectedLead} onOpenChange={() => { setSelectedLead(null); setConfirmDelete(false); setEditingLead(false); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-foreground font-mono">{selectedLead?.reference_code}</DialogTitle>
              {selectedLead && !editingLead && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  setEditForm({
                    first_name: selectedLead.first_name,
                    last_name: selectedLead.last_name,
                    email: selectedLead.email ?? "",
                    phone: selectedLead.phone ?? "",
                    city: selectedLead.city ?? "",
                    province: selectedLead.province ?? "",
                    quality_grade: selectedLead.quality_grade ?? "B",
                    ai_score: String(selectedLead.ai_score ?? ""),
                    price: String(selectedLead.price),
                    sold_status: selectedLead.sold_status,
                  });
                  setEditingLead(true);
                }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedLead && !editingLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Name</span><p className="text-foreground">{selectedLead.first_name} {selectedLead.last_name}</p></div>
                <div><span className="text-muted-foreground text-xs">Email</span><p className="text-foreground">{selectedLead.email ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Phone</span><p className="text-foreground">{selectedLead.phone ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Location</span><p className="text-foreground">{selectedLead.city && selectedLead.province ? `${selectedLead.city}, ${selectedLead.province}` : "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Grade</span>
                  <Badge className={cn("border-0 text-[10px] mt-1", gradeColors[selectedLead.quality_grade ?? ""] ?? "bg-muted text-muted-foreground")}>
                    {selectedLead.quality_grade ?? "—"}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground text-xs">AI Score</span><p className="text-foreground">{selectedLead.ai_score ?? "—"}</p></div>
                <div><span className="text-muted-foreground text-xs">Price</span><p className="text-foreground font-mono">${Number(selectedLead.price).toFixed(2)}</p></div>
                <div><span className="text-muted-foreground text-xs">Status</span><p className="text-foreground capitalize">{selectedLead.sold_status}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">Created</span><p className="text-foreground">{new Date(selectedLead.created_at).toLocaleString()}</p></div>
              </div>
              <div className="border-t border-border pt-4">
                <LeadFileUploader
                  leadId={selectedLead.id}
                  files={selectedLead.document_files ?? []}
                  onFilesChange={(files) => {
                    setSelectedLead({ ...selectedLead, document_files: files });
                    setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, document_files: files } : l));
                  }}
                />
              </div>
              <div className="border-t border-border pt-4">
                {!confirmDelete ? (
                  <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" /> Delete Lead
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-destructive">Are you sure?</p>
                    <Button variant="destructive" size="sm" disabled={deletingLead} onClick={() => deleteLead(selectedLead.id)}>
                      {deletingLead ? "Deleting…" : "Yes, Delete"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {selectedLead && editingLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">First Name</Label>
                  <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Last Name</Label>
                  <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Input value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Province</Label>
                  <Input value={editForm.province} onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quality Grade</Label>
                  <Select value={editForm.quality_grade} onValueChange={(v) => setEditForm((f) => ({ ...f, quality_grade: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A", "B", "C"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">AI Score</Label>
                  <Input type="number" min={0} max={100} value={editForm.ai_score} onChange={(e) => setEditForm((f) => ({ ...f, ai_score: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={editForm.sold_status} onValueChange={(v) => setEditForm((f) => ({ ...f, sold_status: v }))}>
                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setEditingLead(false)}>Cancel</Button>
                <Button size="sm" disabled={savingLead} className="gradient-blue-cyan text-foreground" onClick={saveLeadEdits}>
                  {savingLead ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
