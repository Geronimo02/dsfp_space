-- Fix: Enable RLS on webhook_events table
-- Issue: SUPA_rls_disabled_in_public - RLS Disabled in Public

-- Enable Row Level Security
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role (edge functions) to insert webhook events
-- Note: Service role bypasses RLS, so this policy is for documentation
-- and covers cases where anon/authenticated might need to check events

-- Platform admins can view all webhook events for debugging
CREATE POLICY "Platform admins can view webhook events"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct insert/update/delete from client - webhooks come through edge functions
-- Service role automatically bypasses RLS

-- For completeness, allow platform admins to delete old events for cleanup
CREATE POLICY "Platform admins can delete webhook events"
  ON public.webhook_events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));