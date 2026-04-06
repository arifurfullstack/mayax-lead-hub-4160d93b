import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Save,
  Upload,
  Image as ImageIcon,
  Globe,
  Type,
  FileText,
  Loader2,
  X,
} from "lucide-react";

interface AdminBrandingSettingsProps {
  settingsForm: Record<string, string>;
  setSettingsForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  platformSettings: Record<string, string>;
  onSave: () => Promise<void>;
  saving: boolean;
}

const BRAND_SETTINGS_KEYS = [
  "theme_website_name",
  "theme_tagline",
  "theme_meta_description",
  "theme_logo_url",
  "theme_favicon_url",
  "theme_og_image_url",
];

const AdminBrandingSettings = ({
  settingsForm,
  setSettingsForm,
  platformSettings,
  onSave,
  saving,
}: AdminBrandingSettingsProps) => {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (
    file: File,
    type: "logo" | "favicon"
  ): Promise<string | null> => {
    const maxSize = type === "logo" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Max size is ${type === "logo" ? "5MB" : "2MB"}.`,
        variant: "destructive",
      });
      return null;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const allowedExts = ["png", "jpg", "jpeg", "svg", "ico", "webp"];
    if (!allowedExts.includes(ext)) {
      toast({
        title: "Invalid file type",
        description: "Only PNG, JPG, SVG, ICO, and WEBP files are allowed.",
        variant: "destructive",
      });
      return null;
    }

    const filePath = `${type}.${ext}`;

    // Remove old file first (ignore errors if it doesn't exist)
    await supabase.storage.from("brand-assets").remove([filePath]);

    const { error } = await supabase.storage
      .from("brand-assets")
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (error) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("brand-assets").getPublicUrl(filePath);

    // Append cache-buster
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const url = await uploadFile(file, "logo");
    if (url) {
      setSettingsForm((prev) => ({ ...prev, theme_logo_url: url }));
      toast({ title: "Logo uploaded", description: "Don't forget to save settings." });
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFavicon(true);
    const url = await uploadFile(file, "favicon");
    if (url) {
      setSettingsForm((prev) => ({ ...prev, theme_favicon_url: url }));
      toast({ title: "Favicon uploaded", description: "Don't forget to save settings." });
    }
    setUploadingFavicon(false);
    if (faviconInputRef.current) faviconInputRef.current.value = "";
  };

  const clearImage = (key: string) => {
    setSettingsForm((prev) => ({ ...prev, [key]: "" }));
  };

  return (
    <div className="space-y-6">
      {/* Branding Section */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Branding & Identity
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload your logo, favicon and configure how your platform appears to
          dealers.
        </p>

        {/* Logo & Favicon Upload Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Platform Logo
            </Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                {settingsForm.theme_logo_url ? (
                  <img
                    src={settingsForm.theme_logo_url}
                    alt="Logo"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingLogo ? "Uploading…" : "Upload Logo"}
                </Button>
                {settingsForm.theme_logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive w-full"
                    onClick={() => clearImage("theme_logo_url")}
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  PNG, JPG, SVG, or WEBP. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Favicon Upload */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Favicon
            </Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                {settingsForm.theme_favicon_url ? (
                  <img
                    src={settingsForm.theme_favicon_url}
                    alt="Favicon"
                    className="h-10 w-10 object-contain"
                  />
                ) : (
                  <Globe className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                  className="hidden"
                  onChange={handleFaviconUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full"
                  disabled={uploadingFavicon}
                  onClick={() => faviconInputRef.current?.click()}
                >
                  {uploadingFavicon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingFavicon ? "Uploading…" : "Upload Favicon"}
                </Button>
                {settingsForm.theme_favicon_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive w-full"
                    onClick={() => clearImage("theme_favicon_url")}
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  PNG, ICO, or SVG. Max 2MB.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Text Settings Section */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Website Content
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Website Name</Label>
            <Input
              value={settingsForm.theme_website_name ?? ""}
              onChange={(e) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  theme_website_name: e.target.value,
                }))
              }
              placeholder="MayaX"
              className="bg-card border-border"
              maxLength={60}
            />
            <p className="text-[10px] text-muted-foreground/60">
              Shown in browser tab and header. Max 60 characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tagline</Label>
            <Input
              value={settingsForm.theme_tagline ?? ""}
              onChange={(e) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  theme_tagline: e.target.value,
                }))
              }
              placeholder="Lead Hub"
              className="bg-card border-border"
              maxLength={100}
            />
            <p className="text-[10px] text-muted-foreground/60">
              Short phrase after the website name. Max 100 characters.
            </p>
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Meta Description
            </Label>
            <Textarea
              value={settingsForm.theme_meta_description ?? ""}
              onChange={(e) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  theme_meta_description: e.target.value,
                }))
              }
              placeholder="Your platform description for search engines..."
              className="bg-card border-border resize-none"
              rows={3}
              maxLength={160}
            />
            <p className="text-[10px] text-muted-foreground/60">
              SEO description shown in search results. Max 160 characters.{" "}
              <span className="font-medium">
                {(settingsForm.theme_meta_description ?? "").length}/160
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="glass-card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Live Preview</h2>
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <div className="flex items-center gap-3">
            {settingsForm.theme_favicon_url && (
              <img
                src={settingsForm.theme_favicon_url}
                alt="Favicon preview"
                className="h-4 w-4 object-contain"
              />
            )}
            <span className="text-sm text-muted-foreground font-mono truncate">
              {settingsForm.theme_tagline
                ? `${settingsForm.theme_website_name || "MayaX"} — ${settingsForm.theme_tagline}`
                : settingsForm.theme_website_name || "MayaX"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {settingsForm.theme_logo_url && (
              <img
                src={settingsForm.theme_logo_url}
                alt="Logo preview"
                className="h-8 object-contain"
              />
            )}
            <span className="text-lg font-bold text-foreground">
              {settingsForm.theme_website_name || "MayaX"}
            </span>
          </div>
          {settingsForm.theme_meta_description && (
            <p className="text-xs text-muted-foreground mt-1">
              {settingsForm.theme_meta_description}
            </p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={saving}
          className="gradient-blue-cyan text-foreground gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Branding"}
        </Button>
      </div>
    </div>
  );
};

export default AdminBrandingSettings;
