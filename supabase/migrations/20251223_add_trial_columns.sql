-- Add trial tracking columns to signup_intents
ALTER TABLE signup_intents ADD COLUMN trial_ends_at TIMESTAMP NULL;
ALTER TABLE signup_intents ADD COLUMN payment_failed_at TIMESTAMP NULL;

-- trial_ends_at: when free trial expires and automatic charge should occur
-- payment_failed_at: timestamp when first automatic charge attempt failed
