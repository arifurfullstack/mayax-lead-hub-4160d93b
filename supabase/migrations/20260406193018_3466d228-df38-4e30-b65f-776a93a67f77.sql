
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own notifications"
ON public.notifications FOR SELECT
USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Dealers can update own notifications"
ON public.notifications FOR UPDATE
USING (dealer_id IN (SELECT d.id FROM dealers d WHERE d.user_id = auth.uid()));

CREATE POLICY "Admins can manage all notifications"
ON public.notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_notifications_dealer_id ON public.notifications (dealer_id);
CREATE INDEX idx_notifications_read ON public.notifications (dealer_id, read);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
