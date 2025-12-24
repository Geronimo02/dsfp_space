-- Fix security definer views by recreating them with security_invoker = true

-- 1. Fix customer_pos_view - drop and recreate with security_invoker
DROP VIEW IF EXISTS public.customer_pos_view;

CREATE VIEW public.customer_pos_view 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  credit_limit,
  current_balance,
  price_list_id,
  loyalty_points,
  loyalty_tier,
  condicion_iva
FROM customers;

GRANT SELECT ON public.customer_pos_view TO authenticated;

-- 2. Fix platform_support_metrics - drop and recreate with security_invoker
DROP VIEW IF EXISTS public.platform_support_metrics;

CREATE VIEW public.platform_support_metrics
WITH (security_invoker = true)
AS
SELECT 
  date_trunc('day', created_at) AS date,
  count(*) AS total_tickets,
  count(*) FILTER (WHERE status = 'open') AS open_tickets,
  count(*) FILTER (WHERE status = 'in_progress') AS in_progress_tickets,
  count(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
  count(*) FILTER (WHERE status = 'closed') AS closed_tickets,
  count(*) FILTER (WHERE waiting_for_customer = true) AS waiting_for_customer,
  count(*) FILTER (WHERE sla_response_breached = true) AS sla_response_breached,
  count(*) FILTER (WHERE sla_resolution_breached = true) AS sla_resolution_breached,
  avg(EXTRACT(epoch FROM (first_response_at - created_at)) / 3600) FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_hours,
  avg(EXTRACT(epoch FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
  category,
  priority
FROM platform_support_tickets
GROUP BY date_trunc('day', created_at), category, priority;

GRANT SELECT ON public.platform_support_metrics TO authenticated;