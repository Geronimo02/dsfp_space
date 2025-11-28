-- Create support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('technical', 'billing', 'feature_request', 'bug', 'general')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ticket responses/comments table
CREATE TABLE IF NOT EXISTS public.support_ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create function to generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.support_tickets;
  new_number := 'TICKET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON public.support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_ticket_responses_ticket_id ON public.support_ticket_responses(ticket_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_support_ticket_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_ticket_updated_at();

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
-- Platform admins can see all tickets
CREATE POLICY "Platform admins can view all tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Platform admins can insert tickets
CREATE POLICY "Platform admins can create tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Platform admins can update tickets
CREATE POLICY "Platform admins can update tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Company users can see their own company tickets
CREATE POLICY "Company users can view their tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Company users can create tickets for their company
CREATE POLICY "Company users can create tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- RLS Policies for support_ticket_responses
-- Platform admins can see all responses
CREATE POLICY "Platform admins can view all responses"
  ON public.support_ticket_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Platform admins can create responses
CREATE POLICY "Platform admins can create responses"
  ON public.support_ticket_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Company users can see responses to their tickets
CREATE POLICY "Company users can view their ticket responses"
  ON public.support_ticket_responses
  FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE company_id IN (
        SELECT company_id FROM public.company_users
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- Company users can create responses to their tickets
CREATE POLICY "Company users can create responses"
  ON public.support_ticket_responses
  FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE company_id IN (
        SELECT company_id FROM public.company_users
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );