-- Ensure leads table is part of realtime publication for instant marketplace updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.leads';
  END IF;
END$$;

-- Ensure full row data is available on changes
ALTER TABLE public.leads REPLICA IDENTITY FULL;