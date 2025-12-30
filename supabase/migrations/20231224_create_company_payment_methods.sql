-- Table for storing payment methods per company
CREATE TABLE IF NOT EXISTS company_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('card', 'mercadopago')),
  
  -- Stripe card details
  stripe_payment_method_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  holder_name TEXT,
  
  -- MercadoPago details
  mp_preapproval_id TEXT,
  mp_payer_id TEXT,
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_stripe_pm UNIQUE (stripe_payment_method_id),
  CONSTRAINT unique_mp_preapproval UNIQUE (mp_preapproval_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_payment_methods_company ON company_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_company_payment_methods_default ON company_payment_methods(company_id, is_default) WHERE is_default = true;

-- RLS Policies
ALTER TABLE company_payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can only see payment methods for companies they belong to
CREATE POLICY "Users can view their company payment methods"
  ON company_payment_methods
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Users can insert payment methods for their companies (admin/manager)
CREATE POLICY "Admins can insert payment methods"
  ON company_payment_methods
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager', 'platform_admin')
    )
  );

-- Users can update payment methods for their companies (admin/manager)
CREATE POLICY "Admins can update payment methods"
  ON company_payment_methods
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager', 'platform_admin')
    )
  );

-- Users can delete payment methods for their companies (admin/manager)
CREATE POLICY "Admins can delete payment methods"
  ON company_payment_methods
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager', 'platform_admin')
    )
  );

-- Trigger to ensure only one default payment method per company
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE company_payment_methods
    SET is_default = false
    WHERE company_id = NEW.company_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_payment_method
  BEFORE INSERT OR UPDATE ON company_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_payment_methods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_payment_methods_timestamp
  BEFORE UPDATE ON company_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_company_payment_methods_timestamp();

COMMENT ON TABLE company_payment_methods IS 'Stores payment methods (credit cards, MercadoPago) for companies';
COMMENT ON COLUMN company_payment_methods.type IS 'Type of payment method: card (Stripe) or mercadopago';
COMMENT ON COLUMN company_payment_methods.is_default IS 'Whether this is the default payment method for the company';
