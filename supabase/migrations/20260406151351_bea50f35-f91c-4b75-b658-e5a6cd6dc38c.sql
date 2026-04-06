
-- Allow dealers to insert their own subscriptions
CREATE POLICY "Dealers can insert own subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

-- Allow dealers to update their own subscriptions
CREATE POLICY "Dealers can update own subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));
