import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Building2, Settings2, CheckCircle2, XCircle, DollarSign, Zap, Loader2, BookOpen, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import PaymentAuditLog from "@/components/PaymentAuditLog";

const gatewayIcons: Record<string, typeof CreditCard> = {
  stripe: CreditCard,
  paypal: DollarSign,
  bank_transfer: Building2,
};

const AdminPaymentManager = () => {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<any>(null);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [webhookGuideOpen, setWebhookGuideOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const STRIPE_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-webhook?provider=stripe`;
  const STRIPE_WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "checkout.session.expired",
    "checkout.session.async_payment_failed",
    "payment_intent.payment_failed",
  ];

  const reconcileStripePending = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-stripe-session", {
        body: { all: true },
      });
      if (error) throw error;
      const credited = data?.credited ?? 0;
      const failed = data?.failed ?? 0;
      const pending = data?.pending ?? 0;
      toast({
        title: "Reconciliation complete",
        description: `Checked ${data?.checked ?? 0} • Credited ${credited} • Failed ${failed} • Still pending ${pending}`,
      });
      queryClient.invalidateQueries({ queryKey: ["pending-payment-requests"] });
    } catch (e: any) {
      toast({
        title: "Reconciliation failed",
        description: e?.message || "Could not reach Stripe.",
        variant: "destructive",
      });
    } finally {
      setReconciling(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  const { data: gateways, isLoading } = useQuery({
    queryKey: ["payment-gateways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateways")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ["pending-payment-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("gateway", "bank_transfer")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch dealer names
      if (data && data.length > 0) {
        const dealerIds = [...new Set(data.map((r) => r.dealer_id))];
        const { data: dealers } = await supabase
          .from("dealers")
          .select("id, dealership_name")
          .in("id", dealerIds);
        const dealerMap = Object.fromEntries((dealers ?? []).map((d) => [d.id, d.dealership_name]));
        return data.map((r) => ({ ...r, dealership_name: dealerMap[r.dealer_id] || "Unknown" }));
      }
      return data ?? [];
    },
  });

  const toggleGateway = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("payment_gateways")
      .update({ enabled })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Gateway ${enabled ? "enabled" : "disabled"}.` });
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
    }
  };

  const openConfig = (gw: any) => {
    setSelectedGateway(gw);
    const config = (gw.config || {}) as Record<string, string>;
    setConfigForm({ ...config });
    setTestResult(null);
    setConfigOpen(true);
  };

  const testConnection = async () => {
    if (!selectedGateway) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-gateway", {
        body: { gateway: selectedGateway.id, config: configForm },
      });
      if (error) throw error;
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection test failed" });
    }
    setTesting(false);
  };

  const saveConfig = async () => {
    if (!selectedGateway) return;
    setSaving(true);
    const { error } = await supabase
      .from("payment_gateways")
      .update({ config: configForm })
      .eq("id", selectedGateway.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Gateway configuration updated." });
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
    }
    setSaving(false);
  };

  const handleApprove = async (request: any) => {
    // Credit wallet via service role — use edge function or direct update
    const { data: dealer } = await supabase
      .from("dealers")
      .select("wallet_balance, dealership_name, email, notification_email")
      .eq("id", request.dealer_id)
      .single();

    if (!dealer) {
      toast({ title: "Error", description: "Dealer not found.", variant: "destructive" });
      return;
    }

    const newBalance = Number(dealer.wallet_balance) + Number(request.amount);

    // Update balance
    await supabase.from("dealers").update({ wallet_balance: newBalance }).eq("id", request.dealer_id);

    // Insert wallet transaction
    await supabase.from("wallet_transactions").insert({
      dealer_id: request.dealer_id,
      type: "deposit",
      amount: Number(request.amount),
      balance_after: newBalance,
      description: `Bank transfer deposit approved - $${Number(request.amount).toFixed(2)}`,
      reference_id: request.id,
    });

    // Update payment request
    await supabase.from("payment_requests").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      admin_notes: "Approved by admin",
    }).eq("id", request.id);

    // Send wallet top-up confirmation email (non-blocking)
    const recipient = (dealer as any).notification_email || (dealer as any).email;
    if (recipient) {
      supabase.functions.invoke("send-smtp-email", {
        body: {
          templateName: "wallet-topup",
          recipientEmail: recipient,
          idempotencyKey: `wallet-topup-${request.id}`,
          templateData: {
            dealership_name: (dealer as any).dealership_name,
            amount: Number(request.amount),
            new_balance: newBalance,
            gateway: "bank_transfer",
            reference: request.gateway_reference || request.id,
            date: new Date().toLocaleString(),
          },
        },
      }).catch((e) => console.error("wallet-topup email failed:", e));
    }

    toast({ title: "Approved", description: `$${Number(request.amount).toFixed(2)} credited to dealer wallet.` });
    queryClient.invalidateQueries({ queryKey: ["pending-payment-requests"] });
  };

  const handleReject = async (request: any) => {
    await supabase.from("payment_requests").update({
      status: "failed",
      admin_notes: "Rejected by admin",
    }).eq("id", request.id);

    toast({ title: "Rejected", description: "Payment request rejected." });
    queryClient.invalidateQueries({ queryKey: ["pending-payment-requests"] });
  };

  return (
    <div className="space-y-6">
      {/* Gateway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center text-muted-foreground py-8">Loading...</div>
        ) : (gateways ?? []).map((gw) => {
          const Icon = gatewayIcons[gw.id] || CreditCard;
          return (
            <div key={gw.id} className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{gw.display_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{gw.id.replace("_", " ")}</p>
                  </div>
                </div>
                <Switch
                  checked={gw.enabled}
                  onCheckedChange={(v) => toggleGateway(gw.id, v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Badge className={cn("border-0 text-[10px]", gw.enabled ? "bg-success/20 text-success" : "bg-muted text-muted-foreground")}>
                  {gw.enabled ? "Active" : "Disabled"}
                </Badge>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openConfig(gw)}>
                  <Settings2 className="h-3 w-3" /> Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Bank Transfers */}
      <div className="glass-card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Reconcile Stripe pending deposits
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Manually checks every pending Stripe top-up against Stripe and credits any that succeeded.
            Use this if the webhook is missing or delayed.
          </p>
        </div>
        <Button onClick={reconcileStripePending} disabled={reconciling} className="gap-1.5 shrink-0">
          {reconciling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {reconciling ? "Checking…" : "Run reconciliation"}
        </Button>
      </div>

      <PaymentAuditLog />

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Pending Bank Transfers</h3>
        </div>
        {(!pendingRequests || pendingRequests.length === 0) ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No pending transfers.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Date</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Dealer</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Reference</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">Amount</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-foreground">{req.dealership_name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{req.gateway_reference || "—"}</td>
                    <td className="p-3 text-right font-mono text-foreground">${Number(req.amount).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-success border-success/30" onClick={() => handleApprove(req)}>
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive border-destructive/30" onClick={() => handleReject(req)}>
                          <XCircle className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {selectedGateway?.display_name}</DialogTitle>
          </DialogHeader>
          {selectedGateway && (
            <div className="space-y-4">
              {selectedGateway.id === "stripe" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Secret Key</Label>
                    <Input
                      type="password"
                      value={configForm.secret_key || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, secret_key: e.target.value }))}
                      placeholder="sk_live_... or sk_test_..."
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Publishable Key</Label>
                    <Input
                      value={configForm.publishable_key || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, publishable_key: e.target.value }))}
                      placeholder="pk_live_... or pk_test_..."
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Webhook Secret</Label>
                      <button
                        type="button"
                        onClick={() => setWebhookGuideOpen(true)}
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <BookOpen className="h-3 w-3" /> Setup guide
                      </button>
                    </div>
                    <Input
                      type="password"
                      value={configForm.webhook_secret || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, webhook_secret: e.target.value }))}
                      placeholder="whsec_..."
                      className="bg-background font-mono text-xs"
                    />
                    {!configForm.webhook_secret && (
                      <p className="text-[11px] text-warning mt-1">
                        Required — without this, Stripe payments will not credit wallets.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find these in your <span className="font-medium">Stripe Dashboard → Developers → API Keys</span>. Use test keys for sandbox mode.
                  </p>
                </div>
              )}
              {selectedGateway.id === "paypal" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Client ID</Label>
                    <Input
                      value={configForm.client_id || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, client_id: e.target.value }))}
                      placeholder="AV3g..."
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Client Secret</Label>
                    <Input
                      type="password"
                      value={configForm.client_secret || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, client_secret: e.target.value }))}
                      placeholder="EK..."
                      className="bg-background font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mode</Label>
                    <Select
                      value={configForm.mode || "sandbox"}
                      onValueChange={(v) => setConfigForm((f) => ({ ...f, mode: v }))}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="live">Live (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find these in your <span className="font-medium">PayPal Developer Dashboard → Apps & Credentials</span>.
                  </p>
                </div>
              )}
              {selectedGateway.id === "bank_transfer" && (
                <div className="space-y-3">
                  {[
                    { key: "bank_name", label: "Bank Name", placeholder: "e.g. Chase Bank" },
                    { key: "account_name", label: "Account Name", placeholder: "e.g. MayaX Inc." },
                    { key: "account_number", label: "Account Number", placeholder: "e.g. 1234567890" },
                    { key: "routing_number", label: "Routing Number", placeholder: "e.g. 021000021" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={configForm[key] || ""}
                        onChange={(e) => setConfigForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="bg-background"
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs">Instructions</Label>
                    <Textarea
                      value={configForm.instructions || ""}
                      onChange={(e) => setConfigForm((f) => ({ ...f, instructions: e.target.value }))}
                      placeholder="Additional transfer instructions..."
                      className="bg-background"
                      rows={3}
                    />
                  </div>
                </div>
              )}
              {testResult && (
                <div className={cn(
                  "p-3 rounded-lg text-xs flex items-start gap-2",
                  testResult.success ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                )}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={testConnection} disabled={testing}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                <Button className="flex-1" onClick={saveConfig} disabled={saving}>
                  {saving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stripe Webhook Setup Guide */}
      <Dialog open={webhookGuideOpen} onOpenChange={setWebhookGuideOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Stripe Webhook Setup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <p className="text-muted-foreground">
              Stripe needs to notify us when payments succeed or fail. Without this webhook, customers
              will pay but their wallets will <span className="text-warning font-medium">never be credited</span>.
              Follow these steps once — it takes about 2 minutes.
            </p>

            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">1</span>
                <p className="font-medium text-foreground">Open the Stripe Webhooks page</p>
              </div>
              <a
                href="https://dashboard.stripe.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-8 inline-flex items-center gap-1.5 text-primary hover:underline text-xs"
              >
                dashboard.stripe.com/webhooks <ExternalLink className="h-3 w-3" />
              </a>
              <p className="ml-8 text-xs text-muted-foreground">Click <span className="font-medium text-foreground">+ Add endpoint</span>.</p>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">2</span>
                <p className="font-medium text-foreground">Paste this Endpoint URL</p>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-background border border-border rounded px-3 py-2 font-mono text-xs break-all">
                  {STRIPE_WEBHOOK_URL}
                </code>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => copyToClipboard(STRIPE_WEBHOOK_URL, "Endpoint URL")}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">3</span>
                <p className="font-medium text-foreground">Select these events to listen for</p>
              </div>
              <div className="ml-8 space-y-1.5">
                <p className="text-xs text-muted-foreground">In <span className="font-medium text-foreground">Select events</span>, search and check each:</p>
                <ul className="space-y-1">
                  {STRIPE_WEBHOOK_EVENTS.map((evt) => (
                    <li key={evt} className="flex items-center gap-2">
                      <code className="flex-1 bg-background border border-border rounded px-2 py-1 font-mono text-xs">{evt}</code>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyToClipboard(evt, evt)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => copyToClipboard(STRIPE_WEBHOOK_EVENTS.join("\n"), "All event names")}>
                  <Copy className="h-3.5 w-3.5" /> Copy all event names
                </Button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">4</span>
                <p className="font-medium text-foreground">Reveal & copy the Signing secret</p>
              </div>
              <p className="ml-8 text-xs text-muted-foreground">
                After creating the endpoint, click it open. Under <span className="font-medium text-foreground">Signing secret</span>,
                click <span className="font-medium text-foreground">Reveal</span>. It looks like:
              </p>
              <code className="ml-8 block bg-background border border-border rounded px-3 py-2 font-mono text-xs text-muted-foreground">
                whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
              </code>
            </div>

            {/* Step 5 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">5</span>
                <p className="font-medium text-foreground">Paste it into Webhook Secret here</p>
              </div>
              <p className="ml-8 text-xs text-muted-foreground">
                Close this guide, paste the <code className="font-mono text-foreground">whsec_…</code> value into the
                <span className="font-medium text-foreground"> Webhook Secret</span> field, then click
                <span className="font-medium text-foreground"> Save Configuration</span>. You're done.
              </p>
            </div>

            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success-foreground">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
                <span>
                  <span className="font-medium text-success">Tip:</span> Use a Live-mode webhook with your live secret key,
                  or a Test-mode webhook with your test key. They must match.
                </span>
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setWebhookGuideOpen(false)}>Got it</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentManager;
