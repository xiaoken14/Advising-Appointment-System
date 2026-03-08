
-- Fix overly permissive notification insert policy
DROP POLICY "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications for others" ON public.notifications FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'advisor') OR auth.uid() = user_id
);
