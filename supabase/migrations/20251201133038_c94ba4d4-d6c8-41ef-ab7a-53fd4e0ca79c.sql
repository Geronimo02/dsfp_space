-- Create company_onboarding table to track setup progress
CREATE TABLE IF NOT EXISTS public.company_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Onboarding steps
  company_info_completed BOOLEAN DEFAULT false,
  first_product_added BOOLEAN DEFAULT false,
  first_customer_added BOOLEAN DEFAULT false,
  first_sale_completed BOOLEAN DEFAULT false,
  payment_method_configured BOOLEAN DEFAULT false,
  team_members_invited BOOLEAN DEFAULT false,
  afip_configured BOOLEAN DEFAULT false,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata
  completion_percentage INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT company_onboarding_company_id_unique UNIQUE(company_id)
);

-- Create index for faster queries
CREATE INDEX idx_company_onboarding_company_id ON public.company_onboarding(company_id);
CREATE INDEX idx_company_onboarding_completion ON public.company_onboarding(completion_percentage);
CREATE INDEX idx_company_onboarding_is_active ON public.company_onboarding(is_active);

-- Function to calculate completion percentage
CREATE OR REPLACE FUNCTION calculate_onboarding_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_steps INTEGER := 7;
  completed_steps INTEGER := 0;
BEGIN
  -- Count completed steps
  IF NEW.company_info_completed THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.first_product_added THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.first_customer_added THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.first_sale_completed THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.payment_method_configured THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.team_members_invited THEN completed_steps := completed_steps + 1; END IF;
  IF NEW.afip_configured THEN completed_steps := completed_steps + 1; END IF;
  
  -- Calculate percentage
  NEW.completion_percentage := (completed_steps * 100) / total_steps;
  
  -- Mark as completed if all steps are done
  IF NEW.completion_percentage = 100 AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  
  -- Update last activity
  NEW.last_activity_at := now();
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate completion percentage
CREATE TRIGGER update_onboarding_completion
  BEFORE INSERT OR UPDATE ON public.company_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION calculate_onboarding_completion();

-- Function to auto-create onboarding record when company is created
CREATE OR REPLACE FUNCTION create_company_onboarding_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_onboarding (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create onboarding record for new companies
CREATE TRIGGER auto_create_onboarding_record
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION create_company_onboarding_record();

-- Enable RLS
ALTER TABLE public.company_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Platform admins can view all onboarding records"
  ON public.company_onboarding
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Platform admins can update onboarding records"
  ON public.company_onboarding
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Company admins can view their own onboarding"
  ON public.company_onboarding
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id = auth.uid() 
      AND company_id = company_onboarding.company_id
      AND active = true
    )
  );

-- Insert onboarding records for existing companies
INSERT INTO public.company_onboarding (company_id, company_info_completed)
SELECT id, true
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_onboarding WHERE company_id = companies.id
);