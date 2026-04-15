import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, FileText, Loader2, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FileEntry {
  name: string;
  path: string;
}

interface Props {
  leadId: string;
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const LeadFileUploader = ({ leadId, files, onFilesChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (selected: File[]) => {
    if (selected.length === 0) return;
    setUploading(true);
    const newFiles: FileEntry[] = [...files];

    for (const file of selected) {
      const storagePath = `${leadId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("lead-documents")
        .upload(storagePath, file);

      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        continue;
      }
      newFiles.push({ name: file.name, path: storagePath });
    }

    const { error: updateErr } = await supabase
      .from("leads")
      .update({ document_files: JSON.parse(JSON.stringify(newFiles)) })
      .eq("id", leadId);

    if (updateErr) {
      toast({ title: "Failed to save file info", description: updateErr.message, variant: "destructive" });
    } else {
      onFilesChange(newFiles);
      toast({ title: "Files uploaded successfully" });
    }

    setUploading(false);
  }, [files, leadId, onFilesChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    uploadFiles(Array.from(selected));
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    if (dropped.length === 0) {
      toast({ title: "Unsupported file type", description: "Please drop PDF, image, or Word files.", variant: "destructive" });
      return;
    }
    uploadFiles(dropped);
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleRemove = async (index: number) => {
    const file = files[index];
    await supabase.storage.from("lead-documents").remove([file.path]);

    const updated = files.filter((_, i) => i !== index);
    await supabase
      .from("leads")
      .update({ document_files: JSON.parse(JSON.stringify(updated)) })
      .eq("id", leadId);

    onFilesChange(updated);
    toast({ title: "File removed" });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Attached Files
      </h4>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground text-center">
          {dragging ? "Drop files here" : "Drag & drop files or click to browse"}
        </p>
        <p className="text-[10px] text-muted-foreground/60">PDF, JPG, PNG, WEBP, DOC, DOCX</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        className="hidden"
        onChange={handleInputChange}
      />

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded px-2.5 py-1.5">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-foreground truncate flex-1">{f.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => handleRemove(i)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeadFileUploader;
