import { useState, useEffect, useRef } from "react";
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, CreditCard, Building2, Clock, Copy, CheckCircle2, Receipt, Printer, AlertTriangle, RotateCw, X, ShieldCheck } from "lucide-react";
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
import { ToastAction } from "@/components/ui/toast";

const presetAmounts = [100, 250, 500, 1000];
const MIN_CUSTOM = 10;
const MAX_CUSTOM = 10000;

const gatewayIcons: Record<string, typeof CreditCard> = {
  stripe: CreditCard,
  paypal: DollarSign,
  bank_transfer: Building2,
};

type StripeVerificationResult = {
  status: string;
  session_id?: string;
  payment_intent?: string;
  session_status?: string;
  payment_status?: string;
  error?: string;
  at: string;
};

const StripeVerificationBlock = ({ result }: { result: StripeVerificationResult }) => {
  const isOk = result.status === "completed";
  const isFail = result.status === "failed" || result.status === "error";
  const tone = isOk
    ? "border-success/40 bg-success/5"
    : isFail
      ? "border-destructive/40 bg-destructive/5"
      : "border-warning/40 bg-warning/5";
  const label = isOk
    ? "Verified — Paid"
    : isFail
      ? "Verification failed"
      : "Still pending";
  const labelTone = isOk ? "text-success" : isFail ? "text-destructive" : "text-warning";
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 text-xs ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
          Stripe Verification
        </span>
        <span className={`font-semibold ${labelTone}`}>{label}</span>
      </div>
      {result.session_id && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground shrink-0">Session ID</span>
          <span className="font-mono text-foreground truncate" title={result.session_id}>
            {result.session_id}
          </span>
        </div>
      )}
      {result.payment_intent && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground shrink-0">Payment Intent</span>
          <span className="font-mono text-foreground truncate" title={result.payment_intent}>
            {result.payment_intent}
          </span>
        </div>
      )}
      {(result.session_status || result.payment_status) && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground shrink-0">Stripe Status</span>
          <span className="text-foreground">
            {result.session_status ?? "—"} / {result.payment_status ?? "—"}
          </span>
        </div>
      )}
      {result.error && (
        <div className="text-destructive">{result.error}</div>
      )}
      <div className="flex justify-between gap-3 pt-1">
        <span className="text-muted-foreground shrink-0">Checked</span>
        <span className="text-foreground">{new Date(result.at).toLocaleString()}</span>
      </div>
    </div>
  );
};

const WalletPage = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [processing, setProcessing] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [failedDeposits, setFailedDeposits] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const receiptRef = useRef<any | null>(null);
  useEffect(() => { receiptRef.current = receipt; }, [receipt]);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    pendingIdsRef.current = new Set(pendingDeposits.map((p) => p.id));
  }, [pendingDeposits]);

  const [page, setPage] = useState(0);
  const perPage = 10;
  const [highlightTxnId, setHighlightTxnId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  // Handle return from Stripe / PayPal checkout — open receipt dialog on success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("payment");
    const pr = params.get("pr");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);

    if (status === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "You cancelled the checkout. No funds were charged.",
      });
      return;
    }

    if (status === "success" && pr) {
      setReceiptLoading(true);
      setReceipt({ id: pr, pending: true });

      // Realtime is the primary signal; poll is just a slim fallback (3 tries / ~9s)
      const MAX_ATTEMPTS = 3;
      let attempts = 0;
      let settled = false;

      const interval = setInterval(async () => {
        if (settled) return;
        attempts++;
        const { data } = await supabase
          .from("payment_requests")
          .select("*")
          .eq("id", pr)
          .maybeSingle();

        if (data?.status === "completed" || data?.status === "failed") {
          settled = true;
          clearInterval(interval);
          setReceipt(data);
          setReceiptLoading(false);
        } else if (attempts >= MAX_ATTEMPTS) {
          settled = true;
          clearInterval(interval);
          setReceipt({ ...(data ?? { id: pr }), pending: true, timedOut: true });
          setReceiptLoading(false);
        }
      }, 3000);
    }
  }, []);

  const refreshReceipt = async () => {
    if (!receipt?.id) return;
    setReceiptLoading(true);
    const { data } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", receipt.id)
      .maybeSingle();
    if (data?.status === "completed" || data?.status === "failed") {
      setReceipt(data);
    } else {
      setReceipt({ ...(data ?? receipt), pending: true, timedOut: true });
    }
    setReceiptLoading(false);
    fetchData();
  };

  const openReceiptForTxn = async (txn: any) => {
    if (!txn.reference_id) {
      toast({ title: "No receipt", description: "This transaction has no associated receipt." });
      return;
    }
    setReceiptLoading(true);
    setReceipt({ id: txn.reference_id, pending: true });
    const { data } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", txn.reference_id)
      .maybeSingle();
    setReceipt(data ?? { id: txn.reference_id, pending: true });
    setReceiptLoading(false);
  };

  const handleRetryFailed = (dep: any) => {
    const amt = Number(dep.amount);
    const isPreset = presetAmounts.includes(amt);
    setSelectedAmount(amt);
    setIsCustom(!isPreset);
    setCustomAmount(isPreset ? "" : String(amt));
    setSelectedGateway(null);
    setStep(1);
    setAddFundsOpen(true);
  };

  const handleDismissFailed = async (id: string) => {
    setFailedDeposits((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("payment_requests").update({ status: "dismissed" }).eq("id", id);
  };

  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyPhase, setVerifyPhase] = useState<"contacting" | "checking" | "crediting" | "done" | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, {
    status: string;
    session_id?: string;
    payment_intent?: string;
    session_status?: string;
    payment_status?: string;
    error?: string;
    at: string;
  }>>({});

  const handleVerifyWithStripe = async (paymentRequestId: string) => {
    setVerifyingId(paymentRequestId);
    setVerifyPhase("contacting");
    try {
      // Brief phase progression so the user sees what's happening
      setTimeout(() => setVerifyPhase((p) => (p === "contacting" ? "checking" : p)), 400);
      const { data, error } = await supabase.functions.invoke("reconcile-stripe-session", {
        body: { payment_request_id: paymentRequestId },
      });
      if (error) throw error;
      const outcome = {
        status: data?.status ?? "unknown",
        session_id: data?.session_id,
        payment_intent: data?.payment_intent,
        session_status: data?.session_status,
        payment_status: data?.payment_status,
        error: data?.error,
        at: new Date().toISOString(),
      };
      setVerifyResults((prev) => ({ ...prev, [paymentRequestId]: outcome }));
      if (data?.status === "completed") {
        setVerifyPhase("crediting");
        toast({
          title: "Payment confirmed ✅",
          description: "Stripe confirmed the charge — your wallet has been credited.",
        });
        await fetchData();
        if (receipt?.id === paymentRequestId) {
          await refreshReceipt();
        }
      } else if (data?.status === "failed") {
        toast({
          title: "Payment failed",
          description: data?.error || "Stripe reports this checkout did not complete.",
          variant: "destructive",
        });
        await fetchData();
      } else {
        toast({
          title: "Still pending",
          description: `Stripe status: ${data?.session_status ?? "unknown"} (${data?.payment_status ?? "—"}). Try again in a moment.`,
        });
      }
      setVerifyPhase("done");
    } catch (e: any) {
      setVerifyResults((prev) => ({
        ...prev,
        [paymentRequestId]: {
          status: "error",
          error: e?.message || "Could not reach Stripe.",
          at: new Date().toISOString(),
        },
      }));
      toast({
        title: "Verification error",
        description: e?.message || "Could not reach Stripe.",
        variant: "destructive",
      });
      setVerifyPhase(null);
    } finally {
      setVerifyingId(null);
      setTimeout(() => setVerifyPhase(null), 1500);
    }
  };

  // Realtime: instant updates when wallet balance, transactions, or pending deposits change
  useEffect(() => {
    if (!dealerId) return;

    const channel = supabase
      .channel(`wallet-${dealerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dealers", filter: `id=eq.${dealerId}` },
        (payload) => {
          const newBal = Number((payload.new as any)?.wallet_balance ?? 0);
          setBalance((prev) => {
            if (newBal > prev) {
              toast({
                title: "Wallet topped up",
                description: `New balance: $${newBal.toFixed(2)}`,
              });
            }
            return newBal;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `dealer_id=eq.${dealerId}` },
        (payload) => {
          const row = payload.new as any;
          setTransactions((prev) => {
            // Dedupe in case fetchData() also picked up this row
            if (prev.some((t) => t.id === row.id)) return prev;
            return [row, ...prev];
          });
          // Jump to the first page so the new row is visible
          setPage(0);
          // Brief highlight on the freshly inserted row
          setHighlightTxnId(row.id);
          setTimeout(() => {
            setHighlightTxnId((cur) => (cur === row.id ? null : cur));
          }, 2500);
          if (row.type === "purchase") {
            toast({
              title: "Lead purchased",
              description: `-$${Math.abs(Number(row.amount)).toFixed(2)} • New balance $${Number(row.balance_after).toFixed(2)}`,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests", filter: `dealer_id=eq.${dealerId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          const newStatus = (payload.new as any)?.status;
          // REPLICA IDENTITY DEFAULT only sends PK in payload.old, so detect
          // transitions by checking if we were tracking this row as pending.
          const wasPending = pendingIdsRef.current.has(row.id);

          setPendingDeposits((prev) => {
            const filtered = prev.filter((p) => p.id !== row.id);
            if (payload.eventType !== "DELETE" && newStatus === "pending") {
              return [payload.new as any, ...filtered];
            }
            return filtered;
          });
          setFailedDeposits((prev) => {
            const filtered = prev.filter((p) => p.id !== row.id);
            if (payload.eventType !== "DELETE" && newStatus === "failed") {
              return [payload.new as any, ...filtered].slice(0, 5);
            }
            return filtered;
          });

          // Pending → completed: announce, refresh transactions, auto-update open receipt
          if (wasPending && newStatus === "completed") {
            toast({
              title: "Top-up confirmed ✅",
              description: `$${Number(row.amount).toFixed(2)} via ${String(row.gateway).replace("_", " ")} was credited.`,
              action: (
                <ToastAction
                  altText="View receipt"
                  onClick={() => openReceiptForTxn({ reference_id: row.id })}
                >
                  View receipt
                </ToastAction>
              ),
            });
            // Refresh full transaction list (covers cases where INSERT event was missed)
            fetchData();
            // If the receipt dialog is open for this exact request, swap pending → final
            if (receiptRef.current?.id === row.id) {
              setReceipt({ ...(payload.new as any) });
              setReceiptLoading(false);
            }
          }

          // Pending → failed: announce + refresh open receipt
          if (wasPending && newStatus === "failed") {
            toast({
              title: "Top-up failed",
              description: (payload.new as any)?.error_message || "The payment could not be completed.",
              variant: "destructive",
              action: (
                <ToastAction
                  altText="View details"
                  onClick={() => openReceiptForTxn({ reference_id: row.id })}
                >
                  View details
                </ToastAction>
              ),
            });
            if (receiptRef.current?.id === row.id) {
              setReceipt({ ...(payload.new as any) });
              setReceiptLoading(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealerId]);

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

      const [{ data: txns }, { data: gws }, { data: deposits }, { data: failed }] = await Promise.all([
        supabase.from("wallet_transactions").select("*").eq("dealer_id", dealer.id).order("created_at", { ascending: false }),
        supabase.from("payment_gateways").select("*").eq("enabled", true).order("sort_order"),
        supabase.from("payment_requests").select("*").eq("dealer_id", dealer.id).eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("payment_requests").select("*").eq("dealer_id", dealer.id).eq("status", "failed").order("created_at", { ascending: false }).limit(5),
      ]);

      setTransactions(txns || []);
      setGateways(gws || []);
      setPendingDeposits(deposits || []);
      setFailedDeposits(failed || []);
    }
    setLoading(false);
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedAmount(null);
    setCustomAmount("");
    setIsCustom(false);
    setSelectedGateway(null);
    setBankDetails(null);
    setProcessing(false);
  };

  const handlePresetSelect = (amt: number) => {
    setSelectedAmount(amt);
    setIsCustom(false);
    setCustomAmount("");
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleCustomChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    setCustomAmount(cleaned);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= MIN_CUSTOM && num <= MAX_CUSTOM) {
      setSelectedAmount(num);
    } else {
      setSelectedAmount(null);
    }
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
                      onClick={() => handlePresetSelect(amt)}
                      className={cn(
                        "glass-card p-4 text-center rounded-lg transition-all cursor-pointer",
                        selectedAmount === amt && !isCustom
                          ? "border-primary glow-blue text-primary"
                          : "text-muted-foreground hover:text-foreground hover:border-primary/30"
                      )}
                    >
                      <p className="text-2xl font-bold">${amt}</p>
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <button
                  onClick={handleCustomToggle}
                  className={cn(
                    "w-full glass-card p-3 rounded-lg text-center transition-all cursor-pointer",
                    isCustom
                      ? "border-primary glow-blue text-primary"
                      : "text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  Custom Amount
                </button>
                {isCustom && (
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={`${MIN_CUSTOM} – ${MAX_CUSTOM.toLocaleString()}`}
                        value={customAmount}
                        onChange={(e) => handleCustomChange(e.target.value)}
                        autoFocus
                        className="w-full pl-8 pr-4 py-3 rounded-lg bg-background border border-border text-foreground text-lg font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {customAmount && (parseFloat(customAmount) < MIN_CUSTOM || parseFloat(customAmount) > MAX_CUSTOM) && (
                      <p className="text-xs text-destructive">Enter an amount between ${MIN_CUSTOM} and ${MAX_CUSTOM.toLocaleString()}</p>
                    )}
                  </div>
                )}

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

      {/* Failed Deposits */}
      {failedDeposits.length > 0 && (
        <div className="glass-card p-4 mb-4 border border-destructive/40">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Failed Top-Ups
          </h3>
          <div className="space-y-2">
            {failedDeposits.map((dep) => (
              <div
                key={dep.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">
                      {String(dep.gateway).replace("_", " ")}
                    </Badge>
                    <span className="text-sm font-mono text-foreground">
                      ${Number(dep.amount).toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dep.created_at).toLocaleString()}
                    </span>
                  </div>
                  {dep.error_message && (
                    <p className="text-xs text-destructive break-words">
                      {dep.error_message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="gradient-blue-cyan text-foreground gap-1.5"
                    onClick={() => handleRetryFailed(dep)}
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Dismiss"
                    onClick={() => handleDismissFailed(dep.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Deposits */}
      {pendingDeposits.length > 0 && (
        <div className="glass-card p-4 mb-8 border border-warning/30">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning animate-pulse" /> Pending Top-Ups
            <Badge className="bg-warning/20 text-warning border-0 text-[10px] ml-1">
              {pendingDeposits.length}
            </Badge>
          </h3>
          <div className="space-y-2">
            {pendingDeposits.map((dep) => {
              const created = new Date(dep.created_at);
              const ageMin = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
              const ageLabel = ageMin < 1 ? "just now" : ageMin < 60 ? `${ageMin} min ago` : `${Math.floor(ageMin / 60)} h ago`;
              const statusLabel =
                dep.gateway === "bank_transfer"
                  ? "Awaiting bank transfer & admin approval"
                  : dep.gateway === "stripe"
                  ? "Awaiting card confirmation"
                  : dep.gateway === "paypal"
                  ? "Awaiting PayPal confirmation"
                  : "Awaiting confirmation";
              return (
                <div
                  key={dep.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className="bg-warning/20 text-warning border-0 text-[10px] capitalize">
                        {String(dep.gateway).replace("_", " ")}
                      </Badge>
                      <span className="text-sm text-foreground font-mono font-semibold">
                        ${Number(dep.amount).toFixed(2)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                        Pending
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{statusLabel}</p>
                    {dep.gateway_reference && (
                      <p
                        className="text-[10px] text-muted-foreground/70 font-mono truncate mt-0.5"
                        title={dep.gateway_reference}
                      >
                        Ref: {dep.gateway_reference}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{ageLabel}</span>
                    {dep.gateway === "stripe" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={verifyingId === dep.id}
                        onClick={() => handleVerifyWithStripe(dep.id)}
                      >
                        {verifyingId === dep.id ? (
                          <RotateCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        {verifyingId === dep.id
                          ? verifyPhase === "contacting"
                            ? "Contacting Stripe…"
                            : verifyPhase === "checking"
                              ? "Checking session…"
                              : verifyPhase === "crediting"
                                ? "Crediting wallet…"
                                : "Verifying…"
                          : "Verify with Stripe"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View details"
                      onClick={() => openReceiptForTxn({ reference_id: dep.id })}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
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
                    <TableHead className="text-muted-foreground text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTxns.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className={`border-border transition-colors ${
                      highlightTxnId === txn.id ? "bg-primary/10 animate-pulse" : ""
                    }`}
                  >
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
                      <TableCell className="text-right">
                        {txn.type === "deposit" && txn.reference_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View receipt"
                            onClick={() => openReceiptForTxn(txn)}
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
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

      {/* Receipt Dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null); }}>
        <DialogContent className="glass border-border print:bg-white print:text-black">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Wallet Top-Up Receipt
            </DialogTitle>
          </DialogHeader>

          {receiptLoading ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Confirming payment with the bank…</p>
            </div>
          ) : receipt?.pending && receipt?.timedOut ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <Clock className="h-10 w-10 text-warning" />
              <p className="text-sm text-foreground font-medium">Still confirming with your bank</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                This is taking longer than usual. Your funds will appear automatically once the
                payment processor confirms — or refresh now to check again.
              </p>
              <div className="flex gap-2 w-full mt-2">
                {receipt?.gateway === "stripe" || (!receipt?.gateway && receipt?.id) ? (
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={verifyingId === receipt.id}
                    onClick={() => handleVerifyWithStripe(receipt.id)}
                  >
                    {verifyingId === receipt.id ? (
                      <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {verifyingId === receipt.id
                      ? verifyPhase === "contacting"
                        ? "Contacting Stripe…"
                        : verifyPhase === "checking"
                          ? "Checking session…"
                          : verifyPhase === "crediting"
                            ? "Crediting wallet…"
                            : "Verifying…"
                      : "Verify with Stripe"}
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1" onClick={refreshReceipt}>
                    <RotateCw className="h-4 w-4 mr-2" /> Refresh
                  </Button>
                )}
                <Button className="flex-1" onClick={() => setReceipt(null)}>
                  Close
                </Button>
              </div>
              {verifyResults[receipt.id] && (
                <StripeVerificationBlock result={verifyResults[receipt.id]} />
              )}
            </div>
          ) : receipt ? (
            <div className="space-y-5 mt-2">
              <div className="flex flex-col items-center text-center gap-1 py-2">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="text-sm text-muted-foreground">Amount Charged</p>
                <p className="text-3xl font-extrabold text-foreground">
                  ${Number(receipt.amount ?? 0).toFixed(2)}
                </p>
                <Badge className="bg-success/20 text-success border-0 mt-1">
                  {receipt.status === "completed" ? "Paid" : receipt.status}
                </Badge>
              </div>

              <div className="glass-card p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-foreground">
                    {new Date(receipt.completed_at || receipt.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="text-foreground capitalize">
                    {String(receipt.gateway || "").replace("_", " ")}
                  </span>
                </div>
                {receipt.gateway_reference && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground shrink-0">
                      {receipt.gateway === "stripe" ? "Stripe Session" : "Reference"}
                    </span>
                    <span className="text-foreground font-mono text-xs truncate" title={receipt.gateway_reference}>
                      {receipt.gateway_reference}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt ID</span>
                  <span className="text-foreground font-mono text-xs">{receipt.id}</span>
                </div>
              </div>

              {verifyResults[receipt.id] && (
                <StripeVerificationBlock result={verifyResults[receipt.id]} />
              )}

              <p className="text-xs text-muted-foreground text-center">
                A copy of this receipt has been emailed to you.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
                </Button>
                <Button className="flex-1 gradient-blue-cyan text-foreground" onClick={() => setReceipt(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletPage;
