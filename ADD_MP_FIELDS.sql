-- Add MP-specific fields to signup_payment_methods
ALTER TABLE signup_payment_methods 
ADD COLUMN IF NOT EXISTS payment_method_id TEXT, -- MP payment_method_id (e.g. "master", "visa")
ADD COLUMN IF NOT EXISTS issuer_id TEXT; -- MP issuer_id (e.g. "3")

COMMENT ON COLUMN signup_payment_methods.payment_method_id IS 'MercadoPago payment method ID (card brand)';
COMMENT ON COLUMN signup_payment_methods.issuer_id IS 'MercadoPago issuer ID (bank)';
