import { useState, useEffect } from "react";
import { DollarSign, ArrowUpRight, ArrowDownLeft, Plus, TrendingUp } from "lucide-react";
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

const WalletPage = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const perPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

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

      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("dealer_id", dealer.id)
        .order("created_at", { ascending: false });

      setTransactions(txns || []);
    }
    setLoading(false);
  };

  const handleAddFunds = async () => {
    if (!selectedAmount || !dealerId) return;
    setAdding(true);

    const newBalance = balance + selectedAmount;

    const { error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        dealer_id: dealerId,
        type: "deposit",
        amount: selectedAmount,
        balance_after: newBalance,
        description: `Added $${selectedAmount} to wallet`,
      });

    if (txError) {
      toast({ title: "Error", description: "Failed to add funds.", variant: "destructive" });
      setAdding(false);
      return;
    }

    // Update dealer balance
    await supabase
      .from("dealers")
      .update({ wallet_balance: newBalance })
      .eq("id", dealerId);

    setBalance(newBalance);
    setAddFundsOpen(false);
    setSelectedAmount(null);
    setAdding(false);
    toast({ title: "Funds Added", description: `$${selectedAmount.toFixed(2)} has been added to your wallet.` });
    fetchData();
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
        <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-blue-cyan text-foreground gap-2">
              <Plus className="h-4 w-4" /> Add Funds
            </Button>
          </DialogTrigger>
          <DialogContent className="glass border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Funds to Wallet</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
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
              className="w-full mt-4 gradient-blue-cyan text-foreground"
              disabled={!selectedAmount || adding}
              onClick={handleAddFunds}
            >
              {adding ? "Processing..." : `Add $${selectedAmount ?? 0}`}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

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
