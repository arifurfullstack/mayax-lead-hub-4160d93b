import { useState, useEffect } from "react";
import {
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  Mail,
  Phone,
  User,
  MapPin,
  CreditCard,
  Car,
  FileText,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LeadDetail {
  reference_code: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  buyer_type: string | null;
  credit_range_min: number | null;
  credit_range_max: number | null;
  income: number | null;
  city: string | null;
  province: string | null;
  vehicle_preference: string | null;
  vehicle_mileage: number | null;
  vehicle_price: number | null;
  documents: string[] | null;
  ai_score: number | null;
  quality_grade: string | null;
  price: number;
}

interface OrderRow {
  id: string;
  price_paid: number;
  purchased_at: string;
  delivery_status: string;
  delivery_method: string | null;
  dealer_tier_at_purchase: string | null;
  lead_id: string;
  leads: LeadDetail | null;
}

const deliveryStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  delivered: { icon: CheckCircle2, color: "text-success", label: "Delivered" },
  pending: { icon: Clock, color: "text-warning", label: "Pending" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
  retrying: { icon: RefreshCw, color: "text-cyan", label: "Retrying" },
};

const gradeBadge: Record<string, string> = {
  "A+": "bg-gold/20 text-gold border-gold/30",
  A: "bg-primary/20 text-primary border-primary/30",
  B: "bg-cyan/20 text-cyan border-cyan/30",
  C: "bg-muted text-muted-foreground border-border",
};

const Orders = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: dealer } = await supabase
        .from("dealers")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (!dealer) return;

      const { data } = await supabase
        .from("purchases")
        .select(`
          id, price_paid, purchased_at, delivery_status, delivery_method, dealer_tier_at_purchase, lead_id,
          leads(reference_code, first_name, last_name, phone, email, buyer_type, credit_range_min, credit_range_max, income, city, province, vehicle_preference, vehicle_mileage, vehicle_price, documents, ai_score, quality_grade, price)
        `)
        .eq("dealer_id", dealer.id)
        .order("purchased_at", { ascending: false });

      setOrders((data as unknown as OrderRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.delivery_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const lead = o.leads;
      return (
        lead?.reference_code?.toLowerCase().includes(q) ||
        lead?.first_name?.toLowerCase().includes(q) ||
        lead?.last_name?.toLowerCase().includes(q) ||
        lead?.city?.toLowerCase().includes(q) ||
        lead?.province?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalSpent = orders.reduce((s, o) => s + Number(o.price_paid), 0);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-card rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your purchase history — {orders.length} leads · ${totalSpent.toFixed(2)} invested
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ref code, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="retrying">Retrying</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10" />
              <TableHead>Reference</TableHead>
              <TableHead>Lead Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Price Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {orders.length === 0 ? "No orders yet. Visit the marketplace to purchase your first lead!" : "No orders match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const lead = order.leads;
                const isExpanded = expandedId === order.id;
                const status = deliveryStatusConfig[order.delivery_status] ?? deliveryStatusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <>
                    <TableRow
                      key={order.id}
                      className={cn(
                        "cursor-pointer border-border transition-colors",
                        isExpanded && "bg-muted/30"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <TableCell className="w-10">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-foreground">{lead?.reference_code ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {lead ? `${lead.first_name} ${lead.last_name}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {lead?.city && lead?.province ? `${lead.city}, ${lead.province}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lead?.quality_grade && (
                          <Badge className={cn("text-[10px] px-1.5 py-0 border", gradeBadge[lead.quality_grade] ?? "bg-muted text-muted-foreground border-border")}>
                            {lead.quality_grade}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">${Number(order.price_paid).toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn("h-3.5 w-3.5", status.color)} />
                          <span className={cn("text-xs", status.color)}>{status.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.purchased_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                    </TableRow>

                    {isExpanded && lead && (
                      <TableRow key={`${order.id}-detail`} className="bg-muted/20 border-border hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Contact Info */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-foreground">{lead.first_name} {lead.last_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-foreground">{lead.phone || "Not provided"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-foreground">{lead.email || "Not provided"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-foreground">
                                    {lead.city && lead.province ? `${lead.city}, ${lead.province}` : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Financial */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Profile</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <CreditCard className="h-3.5 w-3.5 text-cyan" />
                                  <span className="text-muted-foreground">Credit:</span>
                                  <span className="text-foreground">
                                    {lead.credit_range_min && lead.credit_range_max
                                      ? `${lead.credit_range_min} – ${lead.credit_range_max}`
                                      : "—"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="h-3.5 w-3.5 text-cyan" />
                                  <span className="text-muted-foreground">Income:</span>
                                  <span className="text-foreground">
                                    {lead.income ? `$${Number(lead.income).toLocaleString()}` : "—"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Package className="h-3.5 w-3.5 text-cyan" />
                                  <span className="text-muted-foreground">Buyer Type:</span>
                                  <span className="text-foreground capitalize">{lead.buyer_type || "—"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Vehicle */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle Interest</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Car className="h-3.5 w-3.5 text-secondary" />
                                  <span className="text-muted-foreground">Preference:</span>
                                  <span className="text-foreground capitalize">{lead.vehicle_preference || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Car className="h-3.5 w-3.5 text-secondary" />
                                  <span className="text-muted-foreground">Budget:</span>
                                  <span className="text-foreground">
                                    {lead.vehicle_price ? `$${Number(lead.vehicle_price).toLocaleString()}` : "—"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Car className="h-3.5 w-3.5 text-secondary" />
                                  <span className="text-muted-foreground">Max Mileage:</span>
                                  <span className="text-foreground">
                                    {lead.vehicle_mileage ? `${lead.vehicle_mileage.toLocaleString()} km` : "—"}
                                  </span>
                                </div>
                                {lead.documents && lead.documents.length > 0 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <FileText className="h-3.5 w-3.5 text-secondary" />
                                    <span className="text-muted-foreground">Documents:</span>
                                    <span className="text-foreground">{lead.documents.length} attached</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Purchase Meta */}
                            <div className="md:col-span-2 lg:col-span-3 pt-3 border-t border-border">
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>AI Score: <strong className="text-foreground">{lead.ai_score ?? "—"}</strong></span>
                                <span>Lead Price: <strong className="text-foreground">${Number(lead.price).toFixed(2)}</strong></span>
                                <span>You Paid: <strong className="text-foreground">${Number(order.price_paid).toFixed(2)}</strong></span>
                                <span>Delivery: <strong className="text-foreground capitalize">{order.delivery_method || "email"}</strong></span>
                                {order.dealer_tier_at_purchase && (
                                  <span>Tier at Purchase: <strong className="text-foreground capitalize">{order.dealer_tier_at_purchase}</strong></span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Orders;
