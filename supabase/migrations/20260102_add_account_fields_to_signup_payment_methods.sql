-- Add account information fields to signup_payment_methods
-- These fields allow finalize-signup to create account when intent doesn't exist (Step4Combined flow)

ALTER TABLE signup_payment_methods 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN signup_payment_methods.full_name IS 'User full name for account creation';
COMMENT ON COLUMN signup_payment_methods.company_name IS 'Company name for company creation';
COMMENT ON COLUMN signup_payment_methods.modules IS 'Selected modules array for subscription';
