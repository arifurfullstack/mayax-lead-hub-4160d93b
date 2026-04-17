import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "done" };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing unsubscribe token." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } },
        );
        const data = await res.json();
        if (data.valid === true) setState({ kind: "valid" });
        else if (data.valid === false && data.reason === "already_unsubscribed")
          setState({ kind: "already" });
        else setState({ kind: "invalid", message: data.error ?? "Invalid token." });
      } catch (e) {
        setState({ kind: "invalid", message: (e as Error).message });
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState({ kind: "invalid", message: error.message });
      return;
    }
    if ((data as any)?.success || (data as any)?.reason === "already_unsubscribed") {
      setState({ kind: "done" });
    } else {
      setState({ kind: "invalid", message: "Could not process unsubscribe." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-card max-w-md w-full p-8 space-y-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Email Preferences</h1>

        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validating…
          </div>
        )}

        {state.kind === "valid" && (
          <>
            <p className="text-sm text-muted-foreground">
              Click below to unsubscribe from MayaX emails. You will stop receiving lead
              notifications and updates.
            </p>
            <Button onClick={confirm} className="gradient-blue-cyan text-foreground w-full">
              Confirm Unsubscribe
            </Button>
          </>
        )}

        {state.kind === "submitting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </div>
        )}

        {state.kind === "done" && (
          <div className="space-y-2">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm text-foreground">You've been unsubscribed.</p>
          </div>
        )}

        {state.kind === "already" && (
          <div className="space-y-2">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-sm text-foreground">You're already unsubscribed.</p>
          </div>
        )}

        {state.kind === "invalid" && (
          <div className="space-y-2">
            <XCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
