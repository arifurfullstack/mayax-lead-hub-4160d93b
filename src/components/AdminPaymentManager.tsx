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
import { CreditCard, Building2, Settings2, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
    setConfigOpen(true);
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
      .select("wallet_balance")
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
                <p className="text-sm text-muted-foreground">
                  Stripe uses server-side secrets. No additional configuration needed here — just enable/disable the gateway.
                </p>
              )}
              {selectedGateway.id === "paypal" && (
                <div>
                  <Label>Mode</Label>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    PayPal API keys are configured as server secrets.
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
              <Button className="w-full" onClick={saveConfig} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentManager;
