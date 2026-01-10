-- 1. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP,
  amount DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_country VARCHAR(2),
  subtotal DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'draft', -- draft, issued, paid, failed
  pdf_url TEXT,
  payment_method VARCHAR(50),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_subscription_id ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_created_at ON public.invoices(created_at DESC);

-- 2. Create tax_rates table
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) UNIQUE NOT NULL, -- ISO 3166-1 alpha-2
  country_name VARCHAR(100),
  tax_rate DECIMAL(5, 2) NOT NULL,
  tax_name VARCHAR(50) DEFAULT 'VAT',
  active BOOLEAN DEFAULT true,
  effective_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tax_rates_country_code ON public.tax_rates(country_code);

-- 3. Add columns to subscriptions for invoice tracking
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_invoice_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS next_invoice_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invoice_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 4. Insert common tax rates
INSERT INTO public.tax_rates (country_code, country_name, tax_rate, tax_name) VALUES
  ('AR', 'Argentina', 21, 'IVA'),
  ('CL', 'Chile', 19, 'IVA'),
  ('CO', 'Colombia', 19, 'IVA'),
  ('MX', 'Mexico', 16, 'IVA'),
  ('PE', 'Peru', 18, 'IGV'),
  ('UY', 'Uruguay', 22, 'IVA'),
  ('US', 'United States', 0, 'Sales Tax'),
  ('GB', 'United Kingdom', 20, 'VAT'),
  ('DE', 'Germany', 19, 'VAT'),
  ('ES', 'Spain', 21, 'VAT')
ON CONFLICT (country_code) DO UPDATE SET
  tax_rate = EXCLUDED.tax_rate,
  updated_at = NOW();
