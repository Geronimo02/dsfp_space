-- Create checks table
CREATE TABLE IF NOT EXISTS public.checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  check_number VARCHAR(50) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'rejected', 'cashed', 'cancelled')),
  type VARCHAR(20) NOT NULL CHECK (type IN ('received', 'issued')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_checks_company_id ON public.checks(company_id);
CREATE INDEX idx_checks_due_date ON public.checks(due_date);
CREATE INDEX idx_checks_status ON public.checks(status);
CREATE INDEX idx_checks_customer_id ON public.checks(customer_id);
CREATE INDEX idx_checks_supplier_id ON public.checks(supplier_id);

-- Enable RLS
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view checks from their company"
  ON public.checks FOR SELECT
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert checks in their company"
  ON public.checks FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can update checks in their company"
  ON public.checks FOR UPDATE
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can delete checks in their company"
  ON public.checks FOR DELETE
  USING (company_id IN (SELECT get_user_companies(auth.uid())));

-- Create trigger for updated_at
CREATE TRIGGER update_checks_updated_at
  BEFORE UPDATE ON public.checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit trigger
CREATE TRIGGER checks_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.checks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event();

-- Function to check expiring checks
CREATE OR REPLACE FUNCTION public.check_expiring_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expiring_check RECORD;
  days_threshold INTEGER := 7;
BEGIN
  -- Buscar cheques que vencen en los próximos 7 días
  FOR expiring_check IN
    SELECT 
      c.id,
      c.check_number,
      c.bank_name,
      c.amount,
      c.due_date,
      c.type,
      c.company_id,
      COALESCE(cust.name, supp.name) as entity_name,
      EXTRACT(DAY FROM (c.due_date - CURRENT_DATE))::INTEGER as days_until_due
    FROM checks c
    LEFT JOIN customers cust ON cust.id = c.customer_id
    LEFT JOIN suppliers supp ON supp.id = c.supplier_id
    WHERE c.status = 'pending'
      AND c.due_date <= (CURRENT_DATE + INTERVAL '7 days')
      AND c.due_date >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.type = 'expiring_check'
          AND (n.data->>'check_id')::uuid = c.id
          AND n.created_at > now() - INTERVAL '2 days'
      )
  LOOP
    -- Crear notificación para administradores y contadores de la empresa
    INSERT INTO notifications (
      company_id,
      type,
      title,
      message,
      data
    )
    SELECT 
      expiring_check.company_id,
      'expiring_check',
      'Cheque por Vencer: ' || expiring_check.check_number,
      'El cheque N° ' || expiring_check.check_number || ' (' || expiring_check.bank_name || ') de ' || 
      COALESCE(expiring_check.entity_name, 'N/A') || ' vence en ' || expiring_check.days_until_due || 
      ' días. Monto: $' || expiring_check.amount,
      jsonb_build_object(
        'check_id', expiring_check.id,
        'check_number', expiring_check.check_number,
        'bank_name', expiring_check.bank_name,
        'amount', expiring_check.amount,
        'due_date', expiring_check.due_date,
        'type', expiring_check.type,
        'entity_name', expiring_check.entity_name,
        'days_until_due', expiring_check.days_until_due
      )
    FROM company_users cu
    WHERE cu.company_id = expiring_check.company_id
      AND cu.role IN ('admin', 'manager', 'accountant')
      AND cu.active = true;
  END LOOP;
END;
$$;