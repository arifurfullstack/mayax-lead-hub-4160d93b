-- Update all available leads that have a price below the current base price ($20)
UPDATE public.leads 
SET price = 20 
WHERE sold_status = 'available' AND price < 20;
