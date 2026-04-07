import { useState, useEffect, useRef } from "react";
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, CreditCard, Building2, Clock, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const presetAmounts = [100, 250, 500, 1000];
const MIN_CUSTOM = 10;
const MAX_CUSTOM = 10000;

const gatewayIcons: Record<string, typeof CreditCard> = {
  stripe: CreditCard,
  paypal: DollarSign,
  bank_transfer: Building2,
};

const WalletPage = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [processing, setProcessing] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);

  const [page, setPage] = useState(0);
  const perPage = 10;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: dealer } = await supabase
      .from("dealers")
      .select("id, wallet_balance")
      .eq("user_id", session.user.id)
      .single();

    if (dealer) {
      setDealerId(dealer.id);
      setBalance(dealer.wallet_balance);

      const [{ data: txns }, { data: gws }, { data: deposits }] = await Promise.all([
        supabase.from("wallet_transactions").select("*").eq("dealer_id", dealer.id).order("created_at", { ascending: false }),
        supabase.from("payment_gateways").select("*").eq("enabled", true).order("sort_order"),
        supabase.from("payment_requests").select("*").eq("dealer_id", dealer.id).eq("status", "pending").order("created_at", { ascending: false }),
      ]);

      setTransactions(txns || []);
      setGateways(gws || []);
      setPendingDeposits(deposits || []);
    }
    setLoading(false);
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedAmount(null);
    setSelectedGateway(null);
    setBankDetails(null);
    setProcessing(false);
  };

  const handleOpenChange = (open: boolean) => {
    setAddFundsOpen(open);
    if (!open) resetDialog();
  };

  const handleProceedToGateway = () => {
    if (!selectedAmount) return;
    if (gateways.length === 0) {
      toast({ title: "No Payment Methods", description: "No payment methods are currently available. Please contact support.", variant: "destructive" });
      return;
    }
    if (gateways.length === 1) {
      setSelectedGateway(gateways[0].id);
      setStep(3);
      if (gateways[0].id === "bank_transfer") {
        handleBankTransfer(gateways[0]);
      }
    } else {
      setStep(2);
    }
  };

  const handleSelectGateway = (gwId: string) => {
    setSelectedGateway(gwId);
    setStep(3);
    if (gwId === "bank_transfer") {
      const gw = gateways.find((g) => g.id === "bank_transfer");
      handleBankTransfer(gw);
    }
  };

  const handleBankTransfer = async (gw?: any) => {
    if (!selectedAmount || !dealerId) return;
    setProcessing(true);

    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { gateway: "bank_transfer", amount: selectedAmount },
    });

    if (error || !data) {
      toast({ title: "Error", description: "Failed to create bank transfer request.", variant: "destructive" });
      setProcessing(false);
      return;
    }

    setBankDetails({ ...data.bank_details, reference_code: data.reference_code });
    setProcessing(false);
  };

  const handleStripeCheckout = async () => {
    if (!selectedAmount || !dealerId) return;
    setProcessing(true);

    const origin = window.location.origin;
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        gateway: "stripe",
        amount: selectedAmount,
        success_url: `${origin}/wallet?payment=success`,
        cancel_url: `${origin}/wallet?payment=cancelled`,
      },
    });

    if (error || !data?.url) {
      toast({ title: "Error", description: data?.error || "Failed to create checkout session.", variant: "destructive" });
      setProcessing(false);
      return;
    }

    window.location.href = data.url;
  };

  const handlePayPalCheckout = async () => {
    if (!selectedAmount || !dealerId) return;
    setProcessing(true);

    const origin = window.location.origin;
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        gateway: "paypal",
        amount: selectedAmount,
        success_url: `${origin}/wallet?payment=success`,
        cancel_url: `${origin}/wallet?payment=cancelled`,
      },
    });

    if (error || !data?.url) {
      toast({ title: "Error", description: data?.error || "Failed to create PayPal order.", variant: "destructive" });
      setProcessing(false);
      return;
    }

    window.location.href = data.url;
  };

  const copyRef = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Reference code copied to clipboard." });
  };

  const paginatedTxns = transactions.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(transactions.length / perPage);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Balance Card */}
      <div className="glass-card p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4" /> Available Balance
          </p>
          <p className="text-4xl font-extrabold text-foreground">${balance.toFixed(2)}</p>
        </div>
        <Dialog open={addFundsOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gradient-blue-cyan text-foreground gap-2">
              <Plus className="h-4 w-4" /> Add Funds
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {step === 1 && "Select Amount"}
                {step === 2 && "Choose Payment Method"}
                {step === 3 && selectedGateway === "bank_transfer" && "Bank Transfer Details"}
                {step === 3 && selectedGateway === "stripe" && "Card Payment"}
                {step === 3 && selectedGateway === "paypal" && "PayPal Payment"}
              </DialogTitle>
            </DialogHeader>

            {/* Step 1: Amount */}
            {step === 1 && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  {presetAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setSelectedAmount(amt)}
                      className={cn(
                        "glass-card p-4 text-center rounded-lg transition-all cursor-pointer",
                        selectedAmount === amt
                          ? "border-primary glow-blue text-primary"
                          : "text-muted-foreground hover:text-foreground hover:border-primary/30"
                      )}
                    >
                      <p className="text-2xl font-bold">${amt}</p>
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full gradient-blue-cyan text-foreground"
                  disabled={!selectedAmount}
                  onClick={handleProceedToGateway}
                >
                  Continue — ${selectedAmount ?? 0}
                </Button>
              </div>
            )}

            {/* Step 2: Gateway Selection */}
            {step === 2 && (
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">Deposit: <span className="text-foreground font-semibold">${selectedAmount}</span></p>
                {gateways.map((gw) => {
                  const Icon = gatewayIcons[gw.id] || CreditCard;
                  return (
                    <button
                      key={gw.id}
                      onClick={() => handleSelectGateway(gw.id)}
                      className={cn(
                        "w-full glass-card p-4 rounded-lg flex items-center gap-4 transition-all cursor-pointer",
                        selectedGateway === gw.id
                          ? "border-primary glow-blue"
                          : "hover:border-primary/30"
                      )}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{gw.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {gw.id === "stripe" && "Pay with credit or debit card"}
                          {gw.id === "paypal" && "Pay with your PayPal account"}
                          {gw.id === "bank_transfer" && "Manual bank transfer"}
                        </p>
                      </div>
                    </button>
                  );
                })}
                <Button variant="outline" className="w-full" onClick={() => setStep(1)}>
                  Back
                </Button>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && selectedGateway === "stripe" && (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">Amount: <span className="text-foreground font-semibold">${selectedAmount}</span></p>
                <p className="text-sm text-muted-foreground">You'll be redirected to Stripe's secure checkout to complete your payment.</p>
                <Button
                  className="w-full gradient-blue-cyan text-foreground"
                  disabled={processing}
                  onClick={handleStripeCheckout}
                >
                  {processing ? "Redirecting..." : `Pay $${selectedAmount} with Card`}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep(gateways.length > 1 ? 2 : 1)}>
                  Back
                </Button>
              </div>
            )}

            {step === 3 && selectedGateway === "paypal" && (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">Amount: <span className="text-foreground font-semibold">${selectedAmount}</span></p>
                <p className="text-sm text-muted-foreground">You'll be redirected to PayPal to complete your payment.</p>
                <Button
                  className="w-full gradient-blue-cyan text-foreground"
                  disabled={processing}
                  onClick={handlePayPalCheckout}
                >
                  {processing ? "Redirecting..." : `Pay $${selectedAmount} with PayPal`}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep(gateways.length > 1 ? 2 : 1)}>
                  Back
                </Button>
              </div>
            )}

            {step === 3 && selectedGateway === "bank_transfer" && (
              <div className="space-y-4 mt-2">
                {processing ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : bankDetails ? (
                  <>
                    <p className="text-sm text-muted-foreground">Transfer <span className="text-foreground font-semibold">${selectedAmount}</span> to:</p>
                    <div className="glass-card p-4 space-y-2 text-sm">
                      {bankDetails.bank_name && <div><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{bankDetails.bank_name}</span></div>}
                      {bankDetails.account_name && <div><span className="text-muted-foreground">Account Name:</span> <span className="text-foreground">{bankDetails.account_name}</span></div>}
                      {bankDetails.account_number && <div><span className="text-muted-foreground">Account #:</span> <span className="text-foreground font-mono">{bankDetails.account_number}</span></div>}
                      {bankDetails.routing_number && <div><span className="text-muted-foreground">Routing #:</span> <span className="text-foreground font-mono">{bankDetails.routing_number}</span></div>}
                    </div>
                    <div className="glass-card p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Reference Code</p>
                        <p className="font-mono text-sm text-foreground">{bankDetails.reference_code}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyRef(bankDetails.reference_code)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {bankDetails.instructions && (
                      <p className="text-xs text-muted-foreground">{bankDetails.instructions}</p>
                    )}
                    <p className="text-xs text-warning flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Include the reference code in your transfer memo. Funds will be credited after admin approval.
                    </p>
                    <Button className="w-full" onClick={() => { handleOpenChange(false); fetchData(); }}>
                      Done
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading bank details...</p>
                )}
                {!processing && !bankDetails && (
                  <Button variant="outline" className="w-full" onClick={() => setStep(gateways.length > 1 ? 2 : 1)}>
                    Back
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Deposits */}
      {pendingDeposits.length > 0 && (
        <div className="glass-card p-4 mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" /> Pending Deposits
          </h3>
          <div className="space-y-2">
            {pendingDeposits.map((dep) => (
              <div key={dep.id} className="flex items-center justify-between p-3 bg-warning/5 rounded-lg border border-warning/20">
                <div className="flex items-center gap-3">
                  <Badge className="bg-warning/20 text-warning border-0 text-[10px]">{dep.gateway.replace("_", " ")}</Badge>
                  <span className="text-sm text-foreground font-mono">${Number(dep.amount).toFixed(2)}</span>
                  {dep.gateway_reference && <span className="text-xs text-muted-foreground font-mono">{dep.gateway_reference}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(dep.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Deposited", icon: ArrowDownLeft, value: transactions.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0), color: "text-success" },
          { label: "Total Spent", icon: ArrowUpRight, value: transactions.filter(t => t.type === "purchase").reduce((s, t) => s + Math.abs(Number(t.amount)), 0), color: "text-destructive" },
          { label: "Transactions", icon: TrendingUp, value: transactions.length, color: "text-primary", isCurrency: false },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <stat.icon className="h-3 w-3" />
              {stat.label}
            </div>
            <p className={cn("text-xl font-bold", stat.color)}>
              {stat.isCurrency === false ? stat.value : `$${stat.value.toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>

      {/* Transaction History */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No transactions yet. Add funds to get started.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Description</TableHead>
                  <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                  <TableHead className="text-muted-foreground text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTxns.map((txn) => (
                  <TableRow key={txn.id} className="border-border">
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-xs border-0",
                          txn.type === "deposit" ? "bg-success/20 text-success" :
                          txn.type === "purchase" ? "bg-destructive/20 text-destructive" :
                          "bg-muted text-muted-foreground"
                        )}
                      >
                        {txn.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{txn.description || "—"}</TableCell>
                    <TableCell className={cn("text-sm text-right font-semibold", txn.type === "deposit" ? "text-success" : "text-destructive")}>
                      {txn.type === "deposit" ? "+" : "-"}${Math.abs(Number(txn.amount)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      ${Number(txn.balance_after).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
