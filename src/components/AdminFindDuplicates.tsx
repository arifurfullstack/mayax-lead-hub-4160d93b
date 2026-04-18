import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type LeadRow = {
  id: string;
  reference_code: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  sold_status: string;
  sold_to_dealer_id: string | null;
  created_at: string;
  price: number | null;
};

type DupeGroup = {
  key: string;
  matchType: "email" | "phone";
  leads: LeadRow[];
};

function normalizePhone(raw: string | null): string {
  const d = (raw || "").replace(/[^0-9]/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export const AdminFindDuplicates = () => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [pendingDelete, setPendingDelete] = useState<LeadRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("id, reference_code, first_name, last_name, email, phone, sold_status, sold_to_dealer_id, created_at, price")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      toast({ title: "Failed to load leads", description: error.message, variant: "destructive" });
    } else {
      setLeads((data || []) as LeadRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const { emailGroups, phoneGroups } = useMemo(() => {
    const byEmail = new Map<string, LeadRow[]>();
    const byPhone = new Map<string, LeadRow[]>();
    for (const l of leads) {
      const e = (l.email || "").trim().toLowerCase();
      if (e) {
        const arr = byEmail.get(e) ?? [];
        arr.push(l);
        byEmail.set(e, arr);
      }
      const p = normalizePhone(l.phone);
      if (p && p.length >= 7) {
        const arr = byPhone.get(p) ?? [];
        arr.push(l);
        byPhone.set(p, arr);
      }
    }
    const emailGroups: DupeGroup[] = Array.from(byEmail.entries())
      .filter(([_, v]) => v.length > 1)
      .map(([key, v]) => ({ key, matchType: "email" as const, leads: v }))
      .sort((a, b) => b.leads.length - a.leads.length);
    const phoneGroups: DupeGroup[] = Array.from(byPhone.entries())
      .filter(([_, v]) => v.length > 1)
      .map(([key, v]) => ({ key, matchType: "phone" as const, leads: v }))
      .sort((a, b) => b.leads.length - a.leads.length);
    return { emailGroups, phoneGroups };
  }, [leads]);

  const totalEmailDupes = emailGroups.reduce((s, g) => s + (g.leads.length - 1), 0);
  const totalPhoneDupes = phoneGroups.reduce((s, g) => s + (g.leads.length - 1), 0);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", pendingDelete.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead deleted", description: pendingDelete.reference_code });
      setLeads((prev) => prev.filter((l) => l.id !== pendingDelete.id));
    }
    setDeleting(false);
    setPendingDelete(null);
  };

  const renderGroup = (g: DupeGroup) => {
    // Sort: oldest first (likely the original), then by created_at asc
    const sorted = [...g.leads].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const original = sorted[0];
    return (
      <div key={`${g.matchType}-${g.key}`} className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="uppercase text-[10px]">{g.matchType}</Badge>
            <span className="font-mono text-foreground">{g.key}</span>
            <Badge variant="outline" className="text-[10px]">{g.leads.length} leads</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">Oldest = likely original (kept by default)</span>
        </div>
        <div className="space-y-2">
          {sorted.map((l) => {
            const isOriginal = l.id === original.id;
            const isSold = l.sold_status !== "available";
            return (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-card/40"
              >
                <div className="flex items-center gap-3 flex-wrap text-sm min-w-0">
                  <span className="font-mono text-primary text-xs">{l.reference_code}</span>
                  <span className="text-foreground truncate">
                    {(l.first_name || "") + " " + (l.last_name || "")}
                  </span>
                  <span className="text-muted-foreground text-xs truncate">{l.email || "—"}</span>
                  <span className="text-muted-foreground text-xs">{l.phone || "—"}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(l.created_at).toLocaleDateString()}
                  </span>
                  {isOriginal && (
                    <Badge variant="secondary" className="text-[10px]">Original</Badge>
                  )}
                  {isSold && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                      Sold
                    </Badge>
                  )}
                  {!isSold && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                      Available
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingDelete(l)}
                  disabled={isSold}
                  title={isSold ? "Cannot delete a sold lead" : "Delete this duplicate"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Find Duplicate Leads</h3>
            <p className="text-xs text-muted-foreground">
              Detects leads sharing the same email (case-insensitive) or phone number (last 10 digits).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            {totalEmailDupes} email + {totalPhoneDupes} phone duplicates
          </Badge>
          <Button size="sm" variant="outline" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Scanning leads…</div>
      ) : emailGroups.length === 0 && phoneGroups.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="text-foreground font-medium">No duplicates found 🎉</div>
          <div className="text-xs text-muted-foreground mt-1">
            Every lead has a unique email and phone number.
          </div>
        </div>
      ) : (
        <Tabs defaultValue="email">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="email" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              By Email ({emailGroups.length})
            </TabsTrigger>
            <TabsTrigger value="phone" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              By Phone ({phoneGroups.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-3 mt-4">
            {emailGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No email duplicates.</div>
            ) : (
              emailGroups.map(renderGroup)
            )}
          </TabsContent>
          <TabsContent value="phone" className="space-y-3 mt-4">
            {phoneGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No phone duplicates.</div>
            ) : (
              phoneGroups.map(renderGroup)
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete duplicate lead?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes lead{" "}
              <span className="font-mono text-primary">{pendingDelete?.reference_code}</span>{" "}
              ({pendingDelete?.first_name} {pendingDelete?.last_name}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
