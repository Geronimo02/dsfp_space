-- Módulo Integraciones
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('mercadolibre', 'tiendanube', 'woocommerce', 'google_forms')),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  credentials JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'realtime')),
  auto_invoice BOOLEAN DEFAULT false,
  auto_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  external_order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  order_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'invoiced', 'error')),
  sale_id UUID REFERENCES public.sales(id),
  quotation_id UUID REFERENCES public.quotations(id),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(integration_id, external_order_id)
);

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  message TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Módulo Sueldos & RRHH
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  document_type TEXT DEFAULT 'DNI',
  document_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  position TEXT,
  department TEXT,
  hire_date DATE NOT NULL,
  termination_date DATE,
  salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('hourly', 'daily', 'monthly')),
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  concept_type TEXT NOT NULL CHECK (concept_type IN ('remunerative', 'non_remunerative', 'deduction')),
  calculation_type TEXT DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'hours', 'units')),
  default_value DECIMAL(12,2),
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS public.payroll_liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_remunerative DECIMAL(12,2) DEFAULT 0,
  total_non_remunerative DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'paid')),
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, employee_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS public.payroll_liquidation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID REFERENCES public.payroll_liquidations(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES public.payroll_concepts(id),
  concept_code TEXT NOT NULL,
  concept_name TEXT NOT NULL,
  concept_type TEXT NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 1,
  unit_value DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_integrations_company ON public.integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_orders_company ON public.integration_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_orders_integration ON public.integration_orders(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_orders_status ON public.integration_orders(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_company ON public.integration_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(company_id, active);
CREATE INDEX IF NOT EXISTS idx_payroll_concepts_company ON public.payroll_concepts(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_liquidations_company ON public.payroll_liquidations(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_liquidations_employee ON public.payroll_liquidations(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_liquidations_period ON public.payroll_liquidations(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_liquidation_items_liquidation ON public.payroll_liquidation_items(liquidation_id);

-- RLS Policies para Integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view integrations from their company"
  ON public.integrations FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins can manage integrations"
  ON public.integrations FOR ALL
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Users can view integration orders from their company"
  ON public.integration_orders FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert integration orders"
  ON public.integration_orders FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can update integration orders"
  ON public.integration_orders FOR UPDATE
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can view integration logs from their company"
  ON public.integration_logs FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "System can insert integration logs"
  ON public.integration_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies para Employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_liquidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_liquidation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees from their company"
  ON public.employees FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and managers can manage employees"
  ON public.employees FOR ALL
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Users can view payroll concepts from their company"
  ON public.payroll_concepts FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins can manage payroll concepts"
  ON public.payroll_concepts FOR ALL
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) 
    AND has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can view payroll liquidations from their company"
  ON public.payroll_liquidations FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Admins and managers can manage payroll liquidations"
  ON public.payroll_liquidations FOR ALL
  USING (
    company_id IN (SELECT get_user_companies(auth.uid())) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Users can view payroll liquidation items"
  ON public.payroll_liquidation_items FOR SELECT
  USING (
    liquidation_id IN (
      SELECT id FROM public.payroll_liquidations 
      WHERE company_id IN (SELECT get_user_companies(auth.uid()))
    )
  );

CREATE POLICY "Users can manage payroll liquidation items"
  ON public.payroll_liquidation_items FOR ALL
  USING (
    liquidation_id IN (
      SELECT id FROM public.payroll_liquidations 
      WHERE company_id IN (SELECT get_user_companies(auth.uid()))
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
    )
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_concepts_updated_at BEFORE UPDATE ON public.payroll_concepts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_liquidations_updated_at BEFORE UPDATE ON public.payroll_liquidations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();