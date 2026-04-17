import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Phone, MapPin, Car, Send, CheckCircle2, Shield, Loader2,
  Sparkles, Upload, X, File, CreditCard, Banknote, Image as ImageIcon, FileCheck, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApplyTheme } from "@/hooks/useApplyTheme";

const provinces = [
  "Ontario", "British Columbia", "Alberta", "Quebec",
  "Manitoba", "Saskatchewan", "Nova Scotia", "Newfoundland",
];

const DOCUMENT_TYPES = [
  { id: "license", label: "Driver's License", icon: CreditCard, color: "from-primary/20 to-primary/5" },
  { id: "paystub", label: "Paystubs", icon: Banknote, color: "from-secondary/20 to-secondary/5" },
  { id: "trade_in_pics", label: "Trade-In Pics", icon: ImageIcon, color: "from-accent/20 to-accent/5" },
  { id: "bank_statement", label: "Bank Statements", icon: FileCheck, color: "from-primary/20 to-cyan-500/5" },
];

const ALLOWED_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_CATEGORY = 3;

const formatPhone = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  // Handle leading country code 1
  let core = digits;
  let prefix = "";
  if (digits.length === 11 && digits.startsWith("1")) {
    prefix = "1 ";
    core = digits.slice(1);
  } else if (digits.length > 10) {
    core = digits.slice(-10);
    prefix = digits.slice(0, digits.length - 10) + " ";
  }
  if (core.length <= 3) return prefix + `(${core}`;
  if (core.length <= 6) return prefix + `(${core.slice(0, 3)}) ${core.slice(3)}`;
  return prefix + `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6, 10)}`;
};

const ApplyNow = () => {
  useApplyTheme();
  const [searchParams] = useSearchParams();

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [matchInfo, setMatchInfo] = useState<{ matched: boolean; reference?: string } | null>(null);

  const [form, setForm] = useState({
    phone: "",
    vehicle_preference: "",
    city: "",
    province: "",
    notes: "",
  });

  const [categoryFiles, setCategoryFiles] = useState<Record<string, File[]>>({});
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Autofill phone from ?phone= query string on mount
  useEffect(() => {
    const incoming = searchParams.get("phone");
    if (incoming) {
      setForm((prev) => ({ ...prev, phone: formatPhone(incoming) }));
    }
  }, [searchParams]);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addFilesToCategory = (categoryId: string, newFiles: File[]) => {
    const validFiles = newFiles.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    if (validFiles.length > 0) {
      setCategoryFiles(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), ...validFiles].slice(0, MAX_FILES_PER_CATEGORY),
      }));
    }
  };

  const handleCategoryFileSelect = (categoryId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToCategory(categoryId, Array.from(e.target.files || []));
    const ref = fileInputRefs.current[categoryId];
    if (ref) ref.value = "";
  };

  const handleCategoryDrop = (categoryId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingCategory(null);
    addFilesToCategory(categoryId, Array.from(e.dataTransfer.files));
  };

  const removeCategoryFile = (categoryId: string, index: number) => {
    setCategoryFiles(prev => {
      const updated = (prev[categoryId] || []).filter((_, i) => i !== index);
      if (updated.length === 0) {
        const { [categoryId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: updated };
    });
  };

  const allUploadedFiles = Object.values(categoryFiles).flat();
  const selectedDocs = Object.keys(categoryFiles).filter(k => (categoryFiles[k] || []).length > 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setMatchInfo(null);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const payload = {
      phone: form.phone.trim(),
      vehicle_preference: form.vehicle_preference.trim(),
      city: form.city.trim(),
      province: form.province,
      notes: form.notes.trim(),
      documents: selectedDocs.length > 0 ? selectedDocs : null,
    };

    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      allUploadedFiles.forEach((file, i) => {
        formData.append(`file_${i}`, file);
      });

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/update-lead-by-phone`,
        { method: "POST", body: formData }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setMatchInfo({ matched: !!data.matched, reference: data.reference_code });
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(var(--background))" }}>
        <div className="glass-card p-10 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Thanks — we got it!</h2>
          <p className="text-muted-foreground text-sm">
            {matchInfo?.matched
              ? `Your application has been updated${matchInfo.reference ? ` (Ref: ${matchInfo.reference})` : ""}. A dealer will be in touch shortly.`
              : "We've received your information and will be in touch shortly."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Complete Your
            <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Application
            </span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Add a few quick details and any supporting documents — we'll match you with the right dealer.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Your Details
              </h3>
              <p className="text-xs text-muted-foreground mt-1">All fields are optional. Phone helps us find your application.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-xs text-muted-foreground flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Vehicle Preference</Label>
                <Input
                  value={form.vehicle_preference}
                  onChange={(e) => update("vehicle_preference", e.target.value)}
                  placeholder="e.g. Honda Civic, SUV, Truck"
                  className="h-12 sm:h-10 text-base sm:text-sm bg-background/50 border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", formatPhone(e.target.value))}
                  placeholder="(416) 555-1234"
                  className="h-12 sm:h-10 text-base sm:text-sm bg-background/50 border-border focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm sm:text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Toronto"
                  className="h-12 sm:h-10 text-base sm:text-sm bg-background/50 border-border focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm sm:text-xs text-muted-foreground">Province</Label>
                <Select value={form.province} onValueChange={(v) => update("province", v)}>
                  <SelectTrigger className="h-12 sm:h-10 text-base sm:text-sm bg-background/50 border-border focus:border-primary">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p) => (
                      <SelectItem key={p} value={p} className="py-3 sm:py-2 text-base sm:text-sm">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Documents */}
            <div className="border-t border-border/50 pt-5">
              <div className="text-center mb-5">
                <h4 className="text-base font-semibold text-foreground">Upload Your Documents</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Please upload any required documents to complete your application.
                </p>
                <p className="text-[10px] text-muted-foreground/60">Accepted file types: JPG, PNG, PDF, DOCX</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DOCUMENT_TYPES.map((doc) => {
                  const Icon = doc.icon;
                  const files = categoryFiles[doc.id] || [];
                  const isDragging = draggingCategory === doc.id;
                  const isFull = files.length >= MAX_FILES_PER_CATEGORY;

                  return (
                    <div key={doc.id} className="flex flex-col">
                      <div className={cn(
                        "rounded-xl border p-4 text-center transition-all bg-gradient-to-b",
                        doc.color,
                        files.length > 0
                          ? "border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                          : "border-border/40 hover:border-primary/30"
                      )}>
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-xs font-medium text-foreground mb-3">{doc.label}</p>

                        <input
                          ref={el => { fileInputRefs.current[doc.id] = el; }}
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                          onChange={handleCategoryFileSelect(doc.id)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                          onDrop={handleCategoryDrop(doc.id)}
                          onDragOver={(e) => { e.preventDefault(); setDraggingCategory(doc.id); }}
                          onDragLeave={(e) => { e.preventDefault(); setDraggingCategory(null); }}
                          disabled={isFull}
                          className={cn(
                            "w-full border border-dashed rounded-lg p-3 transition-all",
                            isFull
                              ? "border-border/20 opacity-40 cursor-not-allowed"
                              : isDragging
                                ? "border-primary bg-primary/15 scale-[1.02]"
                                : "border-border/40 hover:border-primary/50 cursor-pointer"
                          )}
                        >
                          <Upload className={cn("h-4 w-4 mx-auto mb-1 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {isFull ? "Max reached" : isDragging ? "Drop here" : "Click or drag & drop"}
                          </p>
                          <p className="text-[9px] text-muted-foreground/40 mt-0.5">.JPG, .PNG, .PDF</p>
                        </button>

                        {files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {files.map((file, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] bg-background/30 rounded px-1.5 py-1">
                                <File className="h-2.5 w-2.5 text-primary shrink-0" />
                                <span className="truncate flex-1 text-foreground">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeCategoryFile(doc.id, i)}
                                  className="p-0.5 hover:text-destructive text-muted-foreground shrink-0"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-[11px] text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                <Shield className="h-3 w-3" />
                All uploaded documents are secure and <strong>encrypted</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-xs text-muted-foreground">Notes / Additional Information</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={4}
                placeholder="Any additional details about your vehicle needs, timeline, or special requirements..."
                className="text-base sm:text-sm bg-background/50 border-border focus:border-primary resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="gradient-blue-cyan text-foreground gap-2 w-full sm:w-auto sm:px-8 h-12 sm:h-11 text-base"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4" /> Submit</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-muted-foreground/60">
          <div className="flex items-center gap-2 text-xs">
            <Shield className="h-4 w-4" />
            <span>Secure & Encrypted</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-4 w-4" />
            <span>AI-Powered Matching</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className="h-4 w-4" />
            <span>Certified Dealers Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplyNow;
