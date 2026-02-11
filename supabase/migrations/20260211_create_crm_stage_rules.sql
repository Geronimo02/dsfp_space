-- Create CRM stage rules table (SLA / auto-assign / reminders)
CREATE TABLE IF NOT EXISTS crm_stage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  sla_days INTEGER,
  auto_assign_owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reminder_days_before INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique rule per pipeline stage
CREATE UNIQUE INDEX IF NOT EXISTS crm_stage_rules_company_pipeline_stage_idx
  ON crm_stage_rules (company_id, pipeline_id, stage);

CREATE INDEX IF NOT EXISTS crm_stage_rules_company_id_idx ON crm_stage_rules (company_id);
CREATE INDEX IF NOT EXISTS crm_stage_rules_pipeline_id_idx ON crm_stage_rules (pipeline_id);
CREATE INDEX IF NOT EXISTS crm_stage_rules_stage_idx ON crm_stage_rules (stage);

-- Add SLA due date to opportunities
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS crm_opportunities_sla_due_at_idx ON crm_opportunities (sla_due_at);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_stage_rules_updated_at ON crm_stage_rules;
CREATE TRIGGER update_crm_stage_rules_updated_at
  BEFORE UPDATE ON crm_stage_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_stage_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_stage_rules
CREATE POLICY "Users can view CRM stage rules from their company"
  ON crm_stage_rules
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM stage rules for their company"
  ON crm_stage_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM stage rules for their company"
  ON crm_stage_rules
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

CREATE POLICY "Users can delete CRM stage rules for their company"
  ON crm_stage_rules
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
