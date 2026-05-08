import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const CallingScript = () => {
  const [content, setContent] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key,value")
        .in("key", ["kb_calling_script_content", "kb_calling_script_updated_at"]);
      const map: Record<string, string> = {};
      data?.forEach((r: any) => (map[r.key] = r.value ?? ""));
      setContent(map.kb_calling_script_content ?? "");
      setUpdatedAt(map.kb_calling_script_updated_at ?? "");
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-cyan/15 flex items-center justify-center">
          <PhoneCall className="h-5 w-5 text-cyan" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calling Script</h1>
          <p className="text-sm text-muted-foreground">How to call and convert your purchased leads</p>
        </div>
      </div>

      <div className="glass-card p-6">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        ) : content ? (
          <>
            <div
              className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: content }}
            />
            {updatedAt && (
              <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
                Last updated {format(new Date(updatedAt), "PPp")}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            Content coming soon — your admin hasn't published this yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default CallingScript;