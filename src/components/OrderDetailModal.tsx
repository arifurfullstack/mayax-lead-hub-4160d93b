import { useState } from "react";
import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, User, MapPin, CreditCard, Car, FileText, DollarSign, Package, Download, Loader2, Calendar, StickyNote, ArrowRightLeft, FileDown, Eye, FileImage, FileType,
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "other">("other");

  const lead = order?.leads ?? null;
  const files = (lead?.document_files ?? []) as LeadFileEntry[];

  const handleDownloadPdf = useCallback(async () => {
    if (!order || !lead) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const w = doc.internal.pageSize.getWidth();
    let y = 20;
    const lm = 18;
    const col2 = w / 2 + 5;

    const heading = (text: string, x: number) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(text.toUpperCase(), x, y);
      y += 6;
    };

    const row = (label: string, value: string, x: number, yPos: number) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label, x, yPos);
      doc.setTextColor(30, 30, 30);
      doc.text(value, x + 35, yPos);
    };

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`${lead.reference_code}  —  ${lead.first_name} ${lead.last_name}`, lm, y);
    y += 4;
    if (lead.quality_grade) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Grade: ${lead.quality_grade}`, lm, y + 4);
      y += 4;
    }
    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(lm, y, w - lm, y);
    y += 8;

    // Contact
    const savedY = y;
    heading("Contact Information", lm);
    row("Name:", `${lead.first_name} ${lead.last_name}`, lm, y); y += 6;
    row("Phone:", lead.phone || "—", lm, y); y += 6;
    row("Email:", lead.email || "—", lm, y); y += 6;
    row("Location:", lead.city && lead.province ? `${lead.city}, ${lead.province}` : "—", lm, y); y += 6;
    const leftEnd = y;

    // Financial
    y = savedY;
    heading("Financial Profile", col2);
    const credit = lead.credit_range_min && lead.credit_range_max
      ? `${Number(lead.credit_range_min).toLocaleString()} – ${Number(lead.credit_range_max).toLocaleString()}`
      : "—";
    row("Credit:", credit, col2, y); y += 6;
    row("Income:", lead.income ? `$${Number(lead.income).toLocaleString()}` : "—", col2, y); y += 6;
    row("Buyer Type:", lead.buyer_type || "—", col2, y); y += 6;
    y = Math.max(y, leftEnd) + 6;

    doc.line(lm, y, w - lm, y);
    y += 8;

    // Vehicle
    const savedY2 = y;
    heading("Vehicle Interest", lm);
    row("Preference:", lead.vehicle_preference || "—", lm, y); y += 6;
    row("Budget:", lead.vehicle_price ? `$${Number(lead.vehicle_price).toLocaleString()}` : "—", lm, y); y += 6;
    row("Max Mileage:", lead.vehicle_mileage ? `${lead.vehicle_mileage.toLocaleString()} km` : "—", lm, y); y += 6;
    row("Trade-In:", lead.trade_in ? "Yes" : "No", lm, y); y += 6;
    const leftEnd2 = y;

    // Purchase
    y = savedY2;
    heading("Purchase Details", col2);
    row("AI Score:", String(lead.ai_score ?? "—"), col2, y); y += 6;
    row("Lead Price:", `$${Number(lead.price).toFixed(2)}`, col2, y); y += 6;
    row("You Paid:", `$${Number(order.price_paid).toFixed(2)}`, col2, y); y += 6;
    row("Delivery:", order.delivery_method || "email", col2, y); y += 6;
    if (order.dealer_tier_at_purchase) { row("Tier:", order.dealer_tier_at_purchase, col2, y); y += 6; }
    y = Math.max(y, leftEnd2) + 6;

    // Notes
    if (lead.notes) {
      doc.line(lm, y, w - lm, y);
      y += 8;
      heading("Notes", lm);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(lead.notes, w - lm * 2);
      doc.text(lines, lm, y);
    }

    doc.save(`${lead.reference_code}-${lead.first_name}-${lead.last_name}.pdf`);
  }, [order, lead]);

  const handleDownload = async (file: LeadFileEntry) => {
    if (!lead) return;
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

  const getFileType = (name: string): "image" | "pdf" | "other" => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "other";
  };

  const getFileIcon = (name: string) => {
    const type = getFileType(name);
    if (type === "image") return FileImage;
    if (type === "pdf") return FileType;
    return FileText;
  };

  const handlePreview = async (file: LeadFileEntry) => {
    if (!lead) return;
    setDownloading(file.path);
    const { data, error } = await supabase.storage
      .from("lead-documents")
      .download(file.path);
    setDownloading(null);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    setPreviewUrl(url);
    setPreviewName(file.name);
    setPreviewType(getFileType(file.name));
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName("");
    setPreviewType("other");
  };

  if (!order || !lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-1">
            <span className="font-mono text-sm text-muted-foreground">{lead.reference_code}</span>
            <span>{lead.first_name} {lead.last_name}</span>
            {lead.quality_grade && (
              <Badge className={cn("text-[10px] px-1.5 py-0 border", gradeBadge[lead.quality_grade] ?? "bg-muted text-muted-foreground border-border")}>
                {lead.quality_grade}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={handleDownloadPdf} title="Download as PDF">
              <FileDown className="h-4 w-4 text-primary" />
            </Button>
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
            {lead.trade_in && (
              <Row icon={ArrowRightLeft} label="Trade-In" value="Yes" iconColor="text-secondary" />
            )}
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
            {lead.appointment_time && (
              <Row icon={Calendar} label="Appointment" value={new Date(lead.appointment_time).toLocaleString()} iconColor="text-primary" />
            )}
          </Section>

          {/* Notes */}
          {lead.notes && (
            <Section title="Notes">
              <div className="flex items-start gap-2 text-sm">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                <span className="text-foreground whitespace-pre-wrap">{lead.notes}</span>
              </div>
            </Section>
          )}

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
