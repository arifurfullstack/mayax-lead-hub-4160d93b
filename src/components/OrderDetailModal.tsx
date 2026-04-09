import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, User, MapPin, CreditCard, Car, FileText, DollarSign, Package, Download, Loader2, Calendar, StickyNote, ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface LeadFileEntry {
  name: string;
  path: string;
}

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
  document_files: LeadFileEntry[] | null;
  ai_score: number | null;
  quality_grade: string | null;
  price: number;
  notes: string | null;
  appointment_time: string | null;
  trade_in: boolean | null;
}

interface OrderForModal {
  id: string;
  price_paid: number;
  purchased_at: string;
  delivery_status: string;
  delivery_method: string | null;
  dealer_tier_at_purchase: string | null;
  leads: LeadDetail | null;
}

const gradeBadge: Record<string, string> = {
  "A+": "bg-gold/20 text-gold border-gold/30",
  A: "bg-primary/20 text-primary border-primary/30",
  B: "bg-cyan/20 text-cyan border-cyan/30",
  C: "bg-muted text-muted-foreground border-border",
};

interface Props {
  order: OrderForModal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderDetailModal = ({ order, open, onOpenChange }: Props) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!order || !order.leads) return null;
  const lead = order.leads;
  const files = (lead.document_files ?? []) as LeadFileEntry[];

  const handleDownload = async (file: LeadFileEntry) => {
    setDownloading(file.path);
    const { data, error } = await supabase.storage
      .from("lead-documents")
      .download(file.path);
    setDownloading(null);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{lead.reference_code}</span>
            <span>{lead.first_name} {lead.last_name}</span>
            {lead.quality_grade && (
              <Badge className={cn("text-[10px] px-1.5 py-0 border", gradeBadge[lead.quality_grade] ?? "bg-muted text-muted-foreground border-border")}>
                {lead.quality_grade}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Contact */}
          <Section title="Contact Information">
            <Row icon={User} value={`${lead.first_name} ${lead.last_name}`} />
            <Row icon={Phone} value={lead.phone || "Not provided"} />
            <Row icon={Mail} value={lead.email || "Not provided"} />
            <Row icon={MapPin} value={lead.city && lead.province ? `${lead.city}, ${lead.province}` : "—"} />
          </Section>

          {/* Financial */}
          <Section title="Financial Profile">
            <Row icon={CreditCard} label="Credit" value={lead.credit_range_min && lead.credit_range_max ? `${lead.credit_range_min} – ${lead.credit_range_max}` : "—"} iconColor="text-cyan" />
            <Row icon={DollarSign} label="Income" value={lead.income ? `$${Number(lead.income).toLocaleString()}` : "—"} iconColor="text-cyan" />
            <Row icon={Package} label="Buyer Type" value={lead.buyer_type || "—"} iconColor="text-cyan" />
          </Section>

          {/* Vehicle */}
          <Section title="Vehicle Interest">
            <Row icon={Car} label="Preference" value={lead.vehicle_preference || "—"} iconColor="text-secondary" />
            <Row icon={Car} label="Budget" value={lead.vehicle_price ? `$${Number(lead.vehicle_price).toLocaleString()}` : "—"} iconColor="text-secondary" />
            <Row icon={Car} label="Max Mileage" value={lead.vehicle_mileage ? `${lead.vehicle_mileage.toLocaleString()} km` : "—"} iconColor="text-secondary" />
            {lead.documents && lead.documents.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-muted-foreground">Documents:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {lead.documents.map((doc, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] capitalize border-border text-foreground">
                      {doc.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Purchase Meta */}
          <Section title="Purchase Details">
            <Row icon={DollarSign} label="AI Score" value={String(lead.ai_score ?? "—")} iconColor="text-primary" />
            <Row icon={DollarSign} label="Lead Price" value={`$${Number(lead.price).toFixed(2)}`} iconColor="text-primary" />
            <Row icon={DollarSign} label="You Paid" value={`$${Number(order.price_paid).toFixed(2)}`} iconColor="text-primary" />
            <Row icon={Package} label="Delivery" value={order.delivery_method || "email"} iconColor="text-primary" />
            {order.dealer_tier_at_purchase && (
              <Row icon={Package} label="Tier" value={order.dealer_tier_at_purchase} iconColor="text-primary" />
            )}
          </Section>

          {/* Downloadable Files */}
          {files.length > 0 && (
            <Section title="Attached Files">
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-sm h-auto py-1.5 px-2"
                    onClick={() => handleDownload(f)}
                    disabled={downloading === f.path}
                  >
                    {downloading === f.path ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="text-foreground truncate">{f.name}</span>
                  </Button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
    <div className="space-y-2">{children}</div>
  </div>
);

const Row = ({ icon: Icon, label, value, iconColor = "text-primary" }: { icon: typeof User; label?: string; value: string; iconColor?: string }) => (
  <div className="flex items-center gap-2 text-sm">
    <Icon className={cn("h-3.5 w-3.5", iconColor)} />
    {label && <span className="text-muted-foreground">{label}:</span>}
    <span className="text-foreground capitalize">{value}</span>
  </div>
);

export default OrderDetailModal;
