-- Add company_id column to signup_intents for better auditing and tracking
ALTER TABLE signup_intents
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_signup_intents_company_id ON signup_intents(company_id);

-- Add comment
COMMENT ON COLUMN signup_intents.company_id IS 'Company created from this signup intent (set after finalize-signup)';
