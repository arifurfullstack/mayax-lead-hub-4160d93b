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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WelcomeDialogProps {
  dealerName: string;
  dealerId: string;
  onAccepted: () => void;
}

const WelcomeDialog = ({ dealerName, dealerId, onAccepted }: WelcomeDialogProps) => {
  const [tab, setTab] = useState<"how" | "terms">("how");
  const [readHowTo, setReadHowTo] = useState(false);
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
        className="max-w-2xl h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            Welcome, {dealerName}! 🎉
          </DialogTitle>
          <DialogDescription>
            Get started with a quick overview, then review and accept our terms to continue.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "how" | "terms")}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="how">1. How To Use</TabsTrigger>
            <TabsTrigger value="terms" disabled={!readHowTo}>
              2. Terms & Privacy
            </TabsTrigger>
          </TabsList>

          {/* How To Use */}
          <TabsContent value="how" className="flex-1 flex flex-col min-h-0 mt-2">
            <ScrollArea className="flex-1 rounded-md border p-4">
              <div className="space-y-5 text-sm text-muted-foreground">
                <section>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    Getting Started with MayaX Lead Hub
                  </h3>
                  <p>
                    Welcome aboard! Here's a quick guide to help you make the most of the platform.
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">1. Top Up Your Wallet</h4>
                  <p>
                    Head over to <span className="text-foreground font-medium">Wallet</span> to add
                    funds. Your wallet balance is used to purchase leads instantly from the marketplace.
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">2. Choose a Subscription</h4>
                  <p>
                    Visit <span className="text-foreground font-medium">Subscription</span> to pick a
                    plan. Higher tiers give you earlier access to new leads (VIP = instant, Basic = 24h delay).
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">3. Browse the Marketplace</h4>
                  <p>
                    Open <span className="text-foreground font-medium">Marketplace</span> to view
                    available leads. Use filters (city, province, vehicle type, credit score, price) to
                    narrow down. Lead contact info is hidden until purchase.
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">4. Purchase & Receive Leads</h4>
                  <p>
                    Click a lead to see preview details, then confirm purchase. The full contact info is
                    instantly delivered to your <span className="text-foreground font-medium">Orders</span>{" "}
                    page and pushed to your CRM via webhook (if configured in Settings).
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">5. Set Up AutoPay (Optional)</h4>
                  <p>
                    Use <span className="text-foreground font-medium">AutoPay</span> to automatically
                    purchase leads matching your criteria as soon as they appear — perfect for not missing
                    high-quality opportunities.
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">6. Configure Your CRM Webhook</h4>
                  <p>
                    In <span className="text-foreground font-medium">Settings</span>, add your webhook URL
                    so purchased leads flow directly into your CRM. We sign each request so you can verify
                    authenticity.
                  </p>
                </section>

                <section>
                  <h4 className="font-medium text-foreground mb-1">7. Need Help?</h4>
                  <p>
                    Reach out to our support team anytime — we're here to help you grow your business.
                  </p>
                </section>
              </div>
            </ScrollArea>

            <div className="flex items-center space-x-2 pt-3">
              <Checkbox
                id="how-read"
                checked={readHowTo}
                onCheckedChange={(checked) => setReadHowTo(checked === true)}
              />
              <label htmlFor="how-read" className="text-sm cursor-pointer select-none">
                I have read the How To Use guide
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                onClick={() => setTab("terms")}
                disabled={!readHowTo}
                className="w-full sm:w-auto"
              >
                Next: Terms & Privacy →
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Terms & Privacy */}
          <TabsContent value="terms" className="flex-1 flex flex-col min-h-0 mt-2">
            <ScrollArea className="flex-1 rounded-md border p-4">
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

            <div className="flex items-center space-x-2 pt-3">
              <Checkbox
                id="terms-agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label htmlFor="terms-agree" className="text-sm cursor-pointer select-none">
                I have read and agree to the Terms and Conditions and Privacy Policy
              </label>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setTab("how")}
                className="w-full sm:w-auto"
              >
                ← Back
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!agreed || loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Please wait..." : "Accept & Continue"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
