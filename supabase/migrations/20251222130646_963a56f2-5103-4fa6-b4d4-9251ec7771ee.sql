-- Add missing columns to payroll_liquidations
ALTER TABLE public.payroll_liquidations 
  ADD COLUMN IF NOT EXISTS employer_contributions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_employer_contributions NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worked_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Table for employer contribution rates (cargas sociales) - if not exists
CREATE TABLE IF NOT EXISTS public.payroll_contribution_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  employee_rate NUMERIC(6,4) DEFAULT 0,
  employer_rate NUMERIC(6,4) DEFAULT 0,
  calculation_base VARCHAR(50) DEFAULT 'gross_salary',
  min_base NUMERIC(12,2),
  max_base NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (company_id, code, valid_from)
);

-- Add missing columns to payroll_concepts
ALTER TABLE public.payroll_concepts 
  ADD COLUMN IF NOT EXISTS percentage_base VARCHAR(50),
  ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS afip_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN DEFAULT true;

-- Enable RLS on contribution rates
ALTER TABLE public.payroll_contribution_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payroll_contribution_rates
DROP POLICY IF EXISTS "Users can view contribution rates from their company" ON public.payroll_contribution_rates;
CREATE POLICY "Users can view contribution rates from their company"
  ON public.payroll_contribution_rates FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage contribution rates" ON public.payroll_contribution_rates;
CREATE POLICY "Admins can manage contribution rates"
  ON public.payroll_contribution_rates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.company_id = payroll_contribution_rates.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'accountant')
      AND cu.active = true
    )
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_payroll_contribution_rates_company ON public.payroll_contribution_rates(company_id);

-- Add updated_at trigger for contribution rates
DROP TRIGGER IF EXISTS update_payroll_contribution_rates_updated_at ON public.payroll_contribution_rates;
CREATE TRIGGER update_payroll_contribution_rates_updated_at
  BEFORE UPDATE ON public.payroll_contribution_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();