import { useState, useCallback, useRef, useMemo } from "react";
import {
  User, Mail, Phone, MapPin, Car, DollarSign, FileText, Send,
  CheckCircle2, ChevronRight, Shield, ArrowRightLeft, Calendar,
  Loader2, Sparkles, Upload, X, File, CreditCard, Banknote, Image, FileCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  { id: "trade_in_pics", label: "Trade-In Pics", icon: Image, color: "from-accent/20 to-accent/5" },
  { id: "bank_statement", label: "Bank Statements", icon: FileCheck, color: "from-primary/20 to-cyan-500/5" },
];

const formatAmount = (v: string) => {
  const digits = v.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
};

const parseNum = (v: string) => Number(v.replace(/,/g, ""));

const SubmitLead = () => {
  useApplyTheme();

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    city: "",
    province: "",
    buyer_type: "online",
    vehicle_preference: "",
    vehicle_price: "",
    vehicle_mileage: "",
    income: "",
    credit_range_min: "",
    credit_range_max: "",
    notes: "",
    appointment_time: "",
    trade_in: false,
  });

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [categoryFiles, setCategoryFiles] = useState<Record<string, File[]>>({});
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES_PER_CATEGORY = 3;

  const addFilesToCategory = (categoryId: string, newFiles: File[]) => {
    const validFiles = newFiles.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    if (validFiles.length > 0) {
      setCategoryFiles(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), ...validFiles].slice(0, MAX_FILES_PER_CATEGORY),
      }));
      if (!selectedDocs.includes(categoryId)) {
        setSelectedDocs(prev => [...prev, categoryId]);
      }
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

  const handleCategoryDragOver = (categoryId: string) => (e: React.DragEvent) => { e.preventDefault(); setDraggingCategory(categoryId); };
  const handleCategoryDragLeave = (_categoryId: string) => (e: React.DragEvent) => { e.preventDefault(); setDraggingCategory(null); };

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

  // Flatten all category files for submission
  const allUploadedFiles = Object.values(categoryFiles).flat();


  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));


  const steps = [
    { title: "Personal Info", icon: User },
    { title: "Vehicle & Financial", icon: Car },
    { title: "Details & Submit", icon: Send },
  ];

  const canProceed = useMemo(() => {
    if (step === 0) return form.first_name.trim() && form.last_name.trim();
    return true;
  }, [step, form.first_name, form.last_name]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      province: form.province,
      buyer_type: form.buyer_type,
      vehicle_preference: form.vehicle_preference.trim(),
      vehicle_price: form.vehicle_price ? parseNum(form.vehicle_price) : null,
      vehicle_mileage: form.vehicle_mileage ? parseNum(form.vehicle_mileage) : null,
      income: form.income ? parseNum(form.income) : null,
      credit_range_min: form.credit_range_min ? Number(form.credit_range_min) : null,
      credit_range_max: form.credit_range_max ? Number(form.credit_range_max) : null,
      trade_in: form.trade_in,
      notes: form.notes.trim(),
      appointment_time: form.appointment_time || null,
      documents: selectedDocs.length > 0 ? selectedDocs : null,
    };

    try {
      let res: Response;
      if (allUploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append("data", JSON.stringify(payload));
        allUploadedFiles.forEach((file, i) => {
          formData.append(`file_${i}`, file);
        });
        res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/submit-lead`,
          { method: "POST", body: formData }
        );
      } else {
        res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/submit-lead`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
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
          <h2 className="text-2xl font-bold text-foreground">Lead Submitted!</h2>
          <p className="text-muted-foreground text-sm">
            Thank you for your submission. Our team will review your information and match you with the right dealer.
          </p>
          <Button onClick={() => { setSubmitted(false); setStep(0); setForm({ first_name: "", last_name: "", email: "", phone: "", city: "", province: "", buyer_type: "online", vehicle_preference: "", vehicle_price: "", vehicle_mileage: "", income: "", credit_range_min: "", credit_range_max: "", notes: "", appointment_time: "", trade_in: false }); setSelectedDocs([]); setCategoryFiles({}); }} className="gradient-blue-cyan text-foreground">
            Submit Another Lead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Powered by MayaX Lead Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Get Matched with the
            <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Perfect Dealer
            </span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Submit your information and let our AI match you with certified dealers who can get you the best deal on your next vehicle.
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="max-w-2xl mx-auto px-4 mb-6">
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={i}
                onClick={() => { if (i < step) setStep(i); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all",
                  isActive && "bg-primary/20 text-primary border border-primary/30",
                  isDone && "bg-primary/10 text-primary/70 cursor-pointer",
                  !isActive && !isDone && "text-muted-foreground"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          {/* Step 1: Personal Info */}
          {step === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Tell us about yourself so we can find the best match.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">First Name <span className="text-destructive">*</span></Label>
                  <Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} placeholder="John" className="bg-background/50 border-border focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Last Name <span className="text-destructive">*</span></Label>
                  <Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} placeholder="Doe" className="bg-background/50 border-border focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="john@example.com" className="bg-background/50 border-border focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone</Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(416) 555-1234" className="bg-background/50 border-border focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> City</Label>
                  <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Toronto" className="bg-background/50 border-border focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Province</Label>
                  <Select value={form.province} onValueChange={(v) => update("province", v)}>
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle & Financial */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Vehicle & Financial Details
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Help us understand what you're looking for.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Vehicle Preference</Label>
                  <Input value={form.vehicle_preference} onChange={(e) => update("vehicle_preference", e.target.value)} placeholder="e.g. Honda Civic, SUV, Truck" className="bg-background/50 border-border focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Vehicle Budget ($)</Label>
                  <Input type="text" inputMode="numeric" value={form.vehicle_price} onChange={(e) => update("vehicle_price", formatAmount(e.target.value))} placeholder="e.g. 25,000" className="bg-background/50 border-border focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max Mileage (km)</Label>
                  <Input type="text" inputMode="numeric" value={form.vehicle_mileage} onChange={(e) => update("vehicle_mileage", formatAmount(e.target.value))} placeholder="e.g. 50,000" className="bg-background/50 border-border focus:border-primary" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground flex-1">Do you have a trade-in vehicle?</span>
                <Switch checked={form.trade_in} onCheckedChange={(v) => update("trade_in", v)} />
              </div>

              <div className="border-t border-border/50 pt-5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Financial Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Monthly Income ($)</Label>
                    <Input type="text" inputMode="numeric" value={form.income} onChange={(e) => update("income", formatAmount(e.target.value))} placeholder="e.g. 5,000" className="bg-background/50 border-border focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Credit Score Min</Label>
                    <Input type="number" min={300} max={900} value={form.credit_range_min} onChange={(e) => update("credit_range_min", e.target.value)} placeholder="300" className="bg-background/50 border-border focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Credit Score Max</Label>
                    <Input type="number" min={300} max={900} value={form.credit_range_max} onChange={(e) => update("credit_range_max", e.target.value)} placeholder="900" className="bg-background/50 border-border focus:border-primary" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Details & Submit */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Additional Details
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Almost done! Add any extra info to help dealers serve you better.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buyer Type</Label>
                <Select value={form.buyer_type} onValueChange={(v) => update("buyer_type", v)}>
                  <SelectTrigger className="bg-background/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online Buyer</SelectItem>
                    <SelectItem value="walk-in">Walk-in</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="phone">Phone Inquiry</SelectItem>
                    <SelectItem value="refinance">Refinance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Preferred Appointment Time</Label>
                <Input type="datetime-local" value={form.appointment_time} onChange={(e) => update("appointment_time", e.target.value)} className="bg-background/50 border-border focus:border-primary" />
              </div>

              {/* Upload Your Documents - Card Layout */}
              <div>
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
                            onDragOver={handleCategoryDragOver(doc.id)}
                            onDragLeave={handleCategoryDragLeave(doc.id)}
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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes / Additional Information</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={3}
                  placeholder="Any additional details about your vehicle needs, timeline, or special requirements..."
                  className="bg-background/50 border-border focus:border-primary resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-muted-foreground">
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
                className="gradient-blue-cyan text-foreground gap-2"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !form.first_name.trim() || !form.last_name.trim()}
                className="gradient-blue-cyan text-foreground gap-2 px-8"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="h-4 w-4" /> Submit Lead</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Trust badges */}
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

export default SubmitLead;
