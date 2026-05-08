import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, BookOpen } from "lucide-react";

type Section = {
  key: "lead_grades" | "calling_script";
  title: string;
  description: string;
};

const SECTIONS: Section[] = [
  {
    key: "lead_grades",
    title: "Lead Grades",
    description: "Explain what each grade means (A+, A, B, C…) and how dealers should interpret them.",
  },
  {
    key: "calling_script",
    title: "Calling Script",
    description: "Step-by-step script and tips for dealers to use when calling purchased leads.",
  },
];

const AdminKnowledgeBase = () => {
  const [content, setContent] = useState<Record<string, string>>({
    lead_grades: "",
    calling_script: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", ["kb_lead_grades_content", "kb_calling_script_content"]);
      const next = { lead_grades: "", calling_script: "" };
      data?.forEach((r: any) => {
        if (r.key === "kb_lead_grades_content") next.lead_grades = r.value ?? "";
        if (r.key === "kb_calling_script_content") next.calling_script = r.value ?? "";
      });
      setContent(next);
      setLoading(false);
    })();
  }, []);

  const save = async (key: Section["key"]) => {
    setSaving(key);
    const contentKey = `kb_${key}_content`;
    const updatedKey = `kb_${key}_updated_at`;
    const updatedAt = new Date().toISOString();

    const upsert = async (k: string, v: string) => {
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("key")
        .eq("key", k)
        .maybeSingle();
      if (existing) {
        await supabase.from("platform_settings").update({ value: v }).eq("key", k);
      } else {
        await supabase.from("platform_settings").insert({ key: k, value: v });
      }
    };

    await upsert(contentKey, content[key]);
    await upsert(updatedKey, updatedAt);
    setSaving(null);
    toast({ title: "Saved", description: `${SECTIONS.find((s) => s.key === key)?.title} updated.` });
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-32 bg-card rounded-xl" />
        <div className="h-32 bg-card rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Knowledge Base</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Write content shown to dealers on the <strong>Lead Grades</strong> and <strong>Calling Script</strong> pages.
        HTML is supported (e.g. <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;ul&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;a&gt;</code>).
      </p>

      {SECTIONS.map((s) => (
        <div key={s.key} className="glass-card p-5 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
            <p className="text-xs text-muted-foreground">{s.description}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Content (HTML)</Label>
              <Textarea
                value={content[s.key]}
                onChange={(e) => setContent((c) => ({ ...c, [s.key]: e.target.value }))}
                rows={14}
                className="font-mono text-xs bg-background border-border"
                placeholder={`<h2>Section title</h2>\n<p>Write your content here…</p>\n<ul><li>Tip 1</li><li>Tip 2</li></ul>`}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</Label>
              <div className="min-h-[14rem] rounded-md border border-border bg-background p-4 overflow-auto">
                {content[s.key] ? (
                  <div
                    className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-a:text-primary text-sm"
                    dangerouslySetInnerHTML={{ __html: content[s.key] }}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">Preview will appear here.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => save(s.key)} disabled={saving === s.key} className="gap-2">
              <Save className="h-4 w-4" />
              {saving === s.key ? "Saving..." : `Save ${s.title}`}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminKnowledgeBase;