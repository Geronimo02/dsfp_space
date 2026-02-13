-- ============================================================
-- Bot Implementation Requests Pipeline
-- Pipeline: Solicitud → Diagnóstico → Presupuesto Enviado → Aprobado → En Desarrollo → Implementado
-- ============================================================

-- Create ENUM type for pipeline stages
DO $$ BEGIN
  CREATE TYPE public.bot_request_status AS ENUM (
    'solicitud',
    'diagnostico',
    'presupuesto_enviado',
    'aprobado',
    'en_desarrollo',
    'implementado',
    'no_aprobado',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main table: bot_implementation_requests
CREATE TABLE IF NOT EXISTS public.bot_implementation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Contact info (may or may not be a registered user/company)
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  company_name text,
  
  -- Request details
  subject text NOT NULL,
  description text NOT NULL,
  bot_objectives text,
  preferred_schedule text,  -- preferred schedule for diagnosis call
  
  -- Pipeline tracking
  status public.bot_request_status NOT NULL DEFAULT 'solicitud',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Diagnosis
  diagnosis_notes text,
  diagnosis_date timestamptz,
  
  -- Budget/Presupuesto
  budget_scope text,
  budget_estimated_time text,
  budget_price numeric(12,2),
  budget_conditions text,
  budget_sent_at timestamptz,
  budget_document_url text,
  
  -- Approval & Payment
  approved_at timestamptz,
  payment_confirmed_at timestamptz,
  payment_method text,
  payment_reference text,
  rejection_reason text,
  
  -- Development
  development_started_at timestamptz,
  n8n_workflow_id text,
  development_notes text,
  
  -- QA
  qa_completed_at timestamptz,
  qa_notes text,
  
  -- Activation
  activated_at timestamptz,
  activation_notes text,
  documentation_url text,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Activity log for pipeline events
CREATE TABLE IF NOT EXISTS public.bot_request_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.bot_implementation_requests(id) ON DELETE CASCADE,
  action text NOT NULL,  -- e.g. 'status_change', 'note_added', 'budget_sent', etc.
  from_status text,
  to_status text,
  notes text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_implementation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_request_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bot_implementation_requests

-- Anyone authenticated can INSERT (submit a request)
CREATE POLICY "Authenticated users can submit bot requests"
ON public.bot_implementation_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own requests (by created_by or by company_id)
CREATE POLICY "Users can view own bot requests"
ON public.bot_implementation_requests FOR SELECT
USING (
  created_by = auth.uid()
  OR company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true
  )
  -- Platform admins can see all (checked via platform_admins table)
  OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Only platform admins can update requests (manage pipeline)
CREATE POLICY "Platform admins can update bot requests"
ON public.bot_implementation_requests FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  OR created_by = auth.uid()
);

-- RLS for activity log
CREATE POLICY "Users can view activity for their requests"
ON public.bot_request_activity_log FOR SELECT
USING (
  request_id IN (
    SELECT id FROM public.bot_implementation_requests
    WHERE created_by = auth.uid()
    OR company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND active = true
    )
  )
  OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can insert activity log"
ON public.bot_request_activity_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_bot_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_request_timestamp
  BEFORE UPDATE ON public.bot_implementation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bot_request_updated_at();

-- Auto-log status changes
CREATE OR REPLACE FUNCTION public.log_bot_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.bot_request_activity_log (request_id, action, from_status, to_status, performed_by)
    VALUES (NEW.id, 'status_change', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_bot_request_status
  AFTER UPDATE ON public.bot_implementation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_bot_request_status_change();

-- Allow public (unauthenticated) to insert requests for landing page contact form
CREATE POLICY "Public can submit bot requests"
ON public.bot_implementation_requests FOR INSERT
WITH CHECK (true);
