-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'ARS',
  default_tax_rate NUMERIC DEFAULT 0,
  card_surcharge_rate NUMERIC DEFAULT 0,
  receipt_printer_name TEXT,
  receipt_format TEXT DEFAULT 'thermal',
  receipt_footer TEXT,
  whatsapp_number TEXT,
  whatsapp_enabled BOOLEAN DEFAULT false,
  low_stock_alert BOOLEAN DEFAULT true,
  backup_enabled BOOLEAN DEFAULT false,
  last_backup_date TIMESTAMP WITH TIME ZONE,
  loyalty_enabled BOOLEAN DEFAULT false,
  loyalty_points_per_currency NUMERIC DEFAULT 1,
  loyalty_currency_per_point NUMERIC DEFAULT 0.01,
  loyalty_bronze_threshold NUMERIC DEFAULT 0,
  loyalty_silver_threshold NUMERIC DEFAULT 10000,
  loyalty_gold_threshold NUMERIC DEFAULT 50000,
  loyalty_bronze_discount NUMERIC DEFAULT 0,
  loyalty_silver_discount NUMERIC DEFAULT 5,
  loyalty_gold_discount NUMERIC DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create company_users junction table (replaces user_roles with company context)
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, user_id, role)
);

-- Enable RLS on company_users
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Add company_id to all business tables
ALTER TABLE public.products ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.purchases ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.quotations ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.delivery_notes ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.returns ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.promotions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.warehouses ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.warehouse_stock ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.warehouse_transfers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.technical_services ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cash_registers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.cash_movements ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customer_account_movements ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.customer_payments ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_payment_applications ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_transactions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.bulk_operations ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.credit_notes ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.expense_categories ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.exchange_rates ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create indexes for company_id on all tables for performance
CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_suppliers_company ON public.suppliers(company_id);
CREATE INDEX idx_sales_company ON public.sales(company_id);
CREATE INDEX idx_purchases_company ON public.purchases(company_id);
CREATE INDEX idx_expenses_company ON public.expenses(company_id);
CREATE INDEX idx_quotations_company ON public.quotations(company_id);
CREATE INDEX idx_delivery_notes_company ON public.delivery_notes(company_id);
CREATE INDEX idx_returns_company ON public.returns(company_id);
CREATE INDEX idx_reservations_company ON public.reservations(company_id);
CREATE INDEX idx_promotions_company ON public.promotions(company_id);
CREATE INDEX idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX idx_warehouse_stock_company ON public.warehouse_stock(company_id);
CREATE INDEX idx_warehouse_transfers_company ON public.warehouse_transfers(company_id);
CREATE INDEX idx_technical_services_company ON public.technical_services(company_id);
CREATE INDEX idx_cash_registers_company ON public.cash_registers(company_id);
CREATE INDEX idx_cash_movements_company ON public.cash_movements(company_id);
CREATE INDEX idx_customer_account_movements_company ON public.customer_account_movements(company_id);
CREATE INDEX idx_customer_payments_company ON public.customer_payments(company_id);
CREATE INDEX idx_invoice_payment_applications_company ON public.invoice_payment_applications(company_id);
CREATE INDEX idx_loyalty_transactions_company ON public.loyalty_transactions(company_id);
CREATE INDEX idx_notifications_company ON public.notifications(company_id);
CREATE INDEX idx_bulk_operations_company ON public.bulk_operations(company_id);
CREATE INDEX idx_credit_notes_company ON public.credit_notes(company_id);
CREATE INDEX idx_expense_categories_company ON public.expense_categories(company_id);
CREATE INDEX idx_exchange_rates_company ON public.exchange_rates(company_id);

-- Update has_role function to check company_users instead of user_roles
CREATE OR REPLACE FUNCTION public.has_role_in_company(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = _role
      AND active = true
  )
$$;

-- Function to get user's current company (first active company)
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.company_users
  WHERE user_id = _user_id
    AND active = true
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- Function to check if user belongs to company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND active = true
  )
$$;

-- RLS Policies for companies
CREATE POLICY "Users can view their companies"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = companies.id
        AND company_users.user_id = auth.uid()
        AND company_users.active = true
    )
  );

CREATE POLICY "Admins can update their company"
  ON public.companies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users
      WHERE company_users.company_id = companies.id
        AND company_users.user_id = auth.uid()
        AND company_users.role = 'admin'
        AND company_users.active = true
    )
  );

-- RLS Policies for company_users
CREATE POLICY "Users can view their company memberships"
  ON public.company_users FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Company admins can manage company users"
  ON public.company_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
        AND cu.active = true
    )
  );

-- Update trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();