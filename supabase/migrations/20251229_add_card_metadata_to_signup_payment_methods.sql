-- Add card metadata columns to signup_payment_methods table
-- This allows storing card brand, last4, and expiry during signup
-- before the company is created

ALTER TABLE signup_payment_methods 
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS last4 TEXT,
ADD COLUMN IF NOT EXISTS exp_month INTEGER,
ADD COLUMN IF NOT EXISTS exp_year INTEGER;

-- Add index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_email 
ON signup_payment_methods(email);

-- Add index for linked company lookups
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_linked_company 
ON signup_payment_methods(linked_to_company_id) 
WHERE linked_to_company_id IS NOT NULL;

COMMENT ON COLUMN signup_payment_methods.brand IS 'Card brand (visa, mastercard, etc) from payment processor';
COMMENT ON COLUMN signup_payment_methods.last4 IS 'Last 4 digits of card for display';
COMMENT ON COLUMN signup_payment_methods.exp_month IS 'Card expiration month (1-12)';
COMMENT ON COLUMN signup_payment_methods.exp_year IS 'Card expiration year (YYYY)';
