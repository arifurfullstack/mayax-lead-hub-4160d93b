import { useState, useRef } from "react";
import { Upload, Trash2, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface FileEntry {
  name: string;
  path: string;
}

interface Props {
  leadId: string;
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

const LeadFileUploader = ({ leadId, files, onFilesChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setUploading(true);
    const newFiles: FileEntry[] = [...files];

    for (const file of Array.from(selected)) {
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

    // Save metadata to leads table
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
    if (inputRef.current) inputRef.current.value = "";
  };

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
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Attached Files
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No files attached yet.</p>
      ) : (
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
