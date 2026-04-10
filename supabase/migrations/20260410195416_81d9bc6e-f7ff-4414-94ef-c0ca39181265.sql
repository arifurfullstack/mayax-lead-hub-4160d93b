CREATE POLICY "Admins can delete dealers"
ON public.dealers
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));