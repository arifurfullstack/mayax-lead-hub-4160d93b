import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

interface UsageEntry {
  id: string;
  dealer_id: string;
  promo_code_id: string;
  lead_id: string;
  price_paid: number;
  original_price: number;
  created_at: string;
  dealer_name?: string;
  promo_code?: string;
  lead_ref?: string;
}

const AdminPromoUsageHistory = () => {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("promo_code_usage")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Fetch related data
      const dealerIds = [...new Set(data.map((d: any) => d.dealer_id))];
      const promoIds = [...new Set(data.map((d: any) => d.promo_code_id))];
      const leadIds = [...new Set(data.map((d: any) => d.lead_id))];

      const [dealers, promos, leads] = await Promise.all([
        supabase.from("dealers").select("id, dealership_name").in("id", dealerIds),
        supabase.from("promo_codes").select("id, code").in("id", promoIds),
        supabase.from("leads").select("id, reference_code").in("id", leadIds),
      ]);

      const dealerMap = Object.fromEntries((dealers.data ?? []).map((d: any) => [d.id, d.dealership_name]));
      const promoMap = Object.fromEntries((promos.data ?? []).map((p: any) => [p.id, p.code]));
      const leadMap = Object.fromEntries((leads.data ?? []).map((l: any) => [l.id, l.reference_code]));

      setEntries(
        data.map((e: any) => ({
          ...e,
          dealer_name: dealerMap[e.dealer_id] ?? "Unknown",
          promo_code: promoMap[e.promo_code_id] ?? "—",
          lead_ref: leadMap[e.lead_id] ?? "—",
        }))
      );
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Loading usage history...</div>;

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <History className="h-5 w-5 text-primary" /> Promo Usage History
      </h3>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Date</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Dealer</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Promo Code</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Lead</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Original</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Paid</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Saved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No promo code usage yet.
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const saved = Number(e.original_price) - Number(e.price_paid);
              return (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-foreground font-medium">{e.dealer_name}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {e.promo_code}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{e.lead_ref}</td>
                  <td className="p-3 text-right font-mono text-muted-foreground line-through">
                    ${Number(e.original_price).toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-primary font-bold">
                    ${Number(e.price_paid).toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-success text-xs">
                    -${saved.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPromoUsageHistory;
