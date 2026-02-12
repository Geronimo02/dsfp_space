-- CRM scoring rules
CREATE TABLE IF NOT EXISTS crm_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_scoring_rules_company_id_idx ON crm_scoring_rules (company_id);
CREATE INDEX IF NOT EXISTS crm_scoring_rules_active_idx ON crm_scoring_rules (active);

-- Add score fields to opportunities
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS score_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS crm_opportunities_score_total_idx ON crm_opportunities (score_total);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_scoring_rules_updated_at ON crm_scoring_rules;
CREATE TRIGGER update_crm_scoring_rules_updated_at
  BEFORE UPDATE ON crm_scoring_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_scoring_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scoring rules
CREATE POLICY "Users can view CRM scoring rules from their company"
  ON crm_scoring_rules
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM scoring rules for their company"
  ON crm_scoring_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM scoring rules for their company"
  ON crm_scoring_rules
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete CRM scoring rules for their company"
  ON crm_scoring_rules
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
