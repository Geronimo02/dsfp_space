-- Platform Support Improvements Migration
-- 1. Add new columns to platform_support_tickets for enhanced features

-- Add SLA tracking fields
ALTER TABLE public.platform_support_tickets 
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sla_response_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS sla_resolution_hours INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS sla_response_breached BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sla_resolution_breached BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalated_to TEXT,
ADD COLUMN IF NOT EXISTS waiting_for_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_priority_reason TEXT,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

-- Add attachments column to platform_support_messages if not exists
-- (Already has attachments JSONB column based on schema)

-- 2. Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-support-attachments',
  'platform-support-attachments',
  false,
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv', 'application/zip', 'application/x-rar-compressed', 'video/mp4', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage policies for ticket attachments
CREATE POLICY "Users can upload attachments to their tickets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'platform-support-attachments' AND
  EXISTS (
    SELECT 1 FROM public.platform_support_tickets t
    JOIN public.company_users cu ON cu.company_id = t.company_id
    WHERE cu.user_id = auth.uid()
    AND t.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can view attachments from their tickets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'platform-support-attachments' AND
  (
    EXISTS (
      SELECT 1 FROM public.platform_support_tickets t
      JOIN public.company_users cu ON cu.company_id = t.company_id
      WHERE cu.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[1]
    )
    OR
    public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Platform admins can manage all attachments"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'platform-support-attachments' AND
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'platform-support-attachments' AND
  public.has_role(auth.uid(), 'admin')
);

-- 4. Create function to auto-assign priority based on subscription plan
CREATE OR REPLACE FUNCTION public.auto_assign_ticket_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_plan TEXT;
  new_priority TEXT;
  new_sla_response INTEGER;
  new_sla_resolution INTEGER;
BEGIN
  -- Get company subscription plan
  SELECT cs.billing_cycle INTO company_plan
  FROM company_subscriptions cs
  WHERE cs.company_id = NEW.company_id
  AND cs.status = 'active'
  ORDER BY cs.created_at DESC
  LIMIT 1;

  -- Set priority and SLA based on plan
  CASE company_plan
    WHEN 'annual' THEN
      new_priority := COALESCE(NULLIF(NEW.priority, 'medium'), 'high');
      new_sla_response := 4;
      new_sla_resolution := 24;
      NEW.auto_priority_reason := 'Plan Anual - Prioridad Premium';
    WHEN 'monthly' THEN
      new_priority := COALESCE(NEW.priority, 'medium');
      new_sla_response := 12;
      new_sla_resolution := 48;
      NEW.auto_priority_reason := 'Plan Mensual - Prioridad Estándar';
    ELSE
      new_priority := COALESCE(NEW.priority, 'low');
      new_sla_response := 24;
      new_sla_resolution := 72;
      NEW.auto_priority_reason := 'Sin plan activo';
  END CASE;

  -- Only upgrade priority, never downgrade
  IF NEW.priority = 'low' OR (NEW.priority = 'medium' AND new_priority = 'high') THEN
    NEW.priority := new_priority;
  END IF;

  NEW.sla_response_hours := new_sla_response;
  NEW.sla_resolution_hours := new_sla_resolution;
  NEW.subscription_plan := company_plan;

  RETURN NEW;
END;
$$;

-- Create trigger for auto priority
DROP TRIGGER IF EXISTS auto_assign_priority_trigger ON public.platform_support_tickets;
CREATE TRIGGER auto_assign_priority_trigger
BEFORE INSERT ON public.platform_support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_ticket_priority();

-- 5. Create function to track first response and SLA breaches
CREATE OR REPLACE FUNCTION public.track_ticket_first_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is a response from admin (not company)
  IF NEW.sender_type = 'admin' THEN
    -- Update first_response_at if not set
    UPDATE platform_support_tickets
    SET first_response_at = COALESCE(first_response_at, NOW()),
        waiting_for_customer = TRUE,
        waiting_since = NOW()
    WHERE id = NEW.ticket_id
    AND first_response_at IS NULL;
  ELSIF NEW.sender_type = 'company' THEN
    -- Customer responded, clear waiting status
    UPDATE platform_support_tickets
    SET waiting_for_customer = FALSE,
        waiting_since = NULL
    WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_first_response_trigger ON public.platform_support_messages;
CREATE TRIGGER track_first_response_trigger
AFTER INSERT ON public.platform_support_messages
FOR EACH ROW
EXECUTE FUNCTION public.track_ticket_first_response();

-- 6. Create view for ticket metrics
CREATE OR REPLACE VIEW public.platform_support_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
  COUNT(*) FILTER (WHERE waiting_for_customer = TRUE) as waiting_for_customer,
  COUNT(*) FILTER (WHERE sla_response_breached = TRUE) as sla_response_breached,
  COUNT(*) FILTER (WHERE sla_resolution_breached = TRUE) as sla_resolution_breached,
  AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) FILTER (WHERE first_response_at IS NOT NULL) as avg_response_hours,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours,
  category,
  priority
FROM platform_support_tickets
GROUP BY DATE_TRUNC('day', created_at), category, priority;

-- 7. Enable realtime for platform support tickets and messages
ALTER PUBLICATION supabase_realtime ADD TABLE platform_support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE platform_support_messages;