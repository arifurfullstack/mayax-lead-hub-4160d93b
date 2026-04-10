import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WelcomeDialogProps {
  dealerName: string;
  dealerId: string;
  onAccepted: () => void;
}

const WelcomeDialog = ({ dealerName, dealerId, onAccepted }: WelcomeDialogProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("dealers")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", dealerId);

    if (error) {
      toast.error("Failed to accept terms. Please try again.");
      setLoading(false);
      return;
    }
    onAccepted();
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            Welcome, {dealerName}! 🎉
          </DialogTitle>
          <DialogDescription>
            Please review and accept our Terms & Conditions and Privacy Policy to continue.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] rounded-md border p-4">
          <div className="space-y-6 text-sm text-muted-foreground">
            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">Terms and Conditions</h3>

              <h4 className="font-medium text-foreground mt-3 mb-1">1. Platform Usage</h4>
              <p>By accessing and using MayaX Lead Hub, you agree to comply with these terms. The platform provides automotive lead generation and distribution services exclusively for registered and approved dealerships.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">2. Lead Purchasing</h4>
              <p>All leads purchased through the marketplace are non-exclusive unless otherwise specified. Lead prices are determined by data quality, completeness, and market factors. Once a lead is purchased, the transaction is final and the lead data is delivered to your account.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">3. Wallet & Payments</h4>
              <p>Funds added to your wallet are used to purchase leads. Wallet balances are non-refundable except at the sole discretion of MayaX. All payment transactions are recorded and visible in your account history.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">4. Subscription Plans</h4>
              <p>Subscription plans provide access tiers with different lead access delays and monthly limits. Plan changes take effect at the next billing cycle. Auto-renewal is enabled by default and can be managed in your settings.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">5. Acceptable Use</h4>
              <p>You agree not to: share lead data with unauthorized parties, use automated tools to scrape the platform, misrepresent your dealership information, or engage in any fraudulent activity. Violations may result in account suspension.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">6. Data Accuracy</h4>
              <p>While we strive to provide accurate lead information, MayaX does not guarantee the accuracy or completeness of any lead data. Leads are provided "as-is" based on information submitted by consumers.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">7. Limitation of Liability</h4>
              <p>MayaX shall not be liable for any indirect, incidental, or consequential damages arising from the use of the platform or any lead data purchased through it.</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground mb-2">Privacy Policy</h3>

              <h4 className="font-medium text-foreground mt-3 mb-1">1. Data Collection</h4>
              <p>We collect dealership information (name, contact details, business type) during registration. Usage data, transaction history, and platform interactions are also recorded to improve our services.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">2. Lead Data Handling</h4>
              <p>Consumer lead data is handled in accordance with applicable privacy laws. Personal information within leads (name, phone, email) is masked until purchase. Purchased lead data must be used solely for legitimate automotive sales purposes.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">3. Data Security</h4>
              <p>We employ industry-standard security measures including encryption, access controls, and secure data transmission to protect your information and lead data on our platform.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">4. Third-Party Sharing</h4>
              <p>We do not sell your dealership information to third parties. Lead data is shared only with the purchasing dealer. We may share anonymized, aggregated data for analytics purposes.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">5. Data Retention</h4>
              <p>Account data is retained for the duration of your active account and for a reasonable period after account closure for legal and compliance purposes. Transaction records are retained as required by applicable regulations.</p>

              <h4 className="font-medium text-foreground mt-3 mb-1">6. Your Rights</h4>
              <p>You may request access to, correction of, or deletion of your personal data by contacting our support team. Account deletion requests will be processed in accordance with our data retention obligations.</p>
            </section>
          </div>
        </ScrollArea>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="terms-agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <label
            htmlFor="terms-agree"
            className="text-sm cursor-pointer select-none"
          >
            I have read and agree to the Terms and Conditions and Privacy Policy
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Please wait..." : "Accept & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
