-- Fix: Convert SECURITY DEFINER view to SECURITY INVOKER
DROP VIEW IF EXISTS public.platform_support_metrics;

CREATE OR REPLACE VIEW public.platform_support_metrics 
WITH (security_invoker = true) AS
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