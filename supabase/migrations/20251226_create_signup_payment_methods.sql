-- Table for temporarily storing payment method references during signup
-- This gets linked to company_payment_methods after account creation
CREATE TABLE IF NOT EXISTS signup_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  billing_country TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  payment_method_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  linked_to_company_id UUID,
  
  CONSTRAINT fk_company FOREIGN KEY (linked_to_company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Index for cleanup and lookups
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_email ON signup_payment_methods(email);
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_expires_at ON signup_payment_methods(expires_at);
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_company ON signup_payment_methods(linked_to_company_id);

COMMENT ON TABLE signup_payment_methods IS 'Temporary storage for payment methods during signup flow before company is created';
COMMENT ON COLUMN signup_payment_methods.payment_method_ref IS 'Stripe payment_method_id or MP token';
COMMENT ON COLUMN signup_payment_methods.expires_at IS 'Auto-delete after 24 hours if not linked to company';
