CREATE POLICY "Dealers can insert own transactions"
ON public.wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (dealer_id IN (
  SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()
));