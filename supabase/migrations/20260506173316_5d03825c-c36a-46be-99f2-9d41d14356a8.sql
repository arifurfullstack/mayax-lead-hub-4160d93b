ALTER TABLE public.leads DROP CONSTRAINT leads_sold_to_dealer_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_sold_to_dealer_id_fkey
  FOREIGN KEY (sold_to_dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;