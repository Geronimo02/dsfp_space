-- Add plan_id and amount to signup_payment_methods to know what to charge
ALTER TABLE signup_payment_methods 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS payment_id TEXT; -- Stripe payment_intent_id or MP payment_id

-- Comment
COMMENT ON COLUMN signup_payment_methods.plan_id IS 'Selected subscription plan to charge';
COMMENT ON COLUMN signup_payment_methods.amount IS 'Amount charged for the subscription';
COMMENT ON COLUMN signup_payment_methods.payment_id IS 'Stripe PaymentIntent ID or MercadoPago payment ID';
