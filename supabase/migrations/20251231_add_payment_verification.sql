-- Add payment verification columns to signup_payment_methods
ALTER TABLE signup_payment_methods
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_error TEXT;

-- Create index on payment_verified for quick lookups during finalize-signup
CREATE INDEX IF NOT EXISTS idx_signup_payment_methods_verified 
ON signup_payment_methods(email, payment_verified);
