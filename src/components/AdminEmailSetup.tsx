import { Mail, Info } from "lucide-react";

export default function AdminEmailSetup() {
  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Website Sender Email</h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Set up a verified sender domain so MayaX can send branded emails (lead purchase confirmations,
          notifications, password resets) from your own domain — e.g. <code className="text-foreground">notify@yourdomain.com</code>.
          This improves deliverability and trust.
        </p>

        <div className="rounded-lg bg-muted/30 p-4 space-y-2 border border-border">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-cyan shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">How it works</p>
              <ol className="text-[11px] text-muted-foreground list-decimal ml-4 space-y-1">
                <li>Click "Set Up Sender Email" below.</li>
                <li>Enter the domain you want emails to come from.</li>
                <li>DNS records are configured automatically (SPF, DKIM, MX).</li>
                <li>Verification typically completes within minutes.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 text-[11px] text-warning-foreground/80">
          <strong className="text-warning">Note:</strong> Sender email setup runs through the Lovable
          assistant. After clicking the button, ask your developer (or the AI builder) to
          "set up the email sender domain" — Lovable will provision DNS and verify automatically.
          You'll need either a domain you own or one purchased through Lovable Project Settings → Domains.
        </div>
      </div>
    </div>
  );
}
