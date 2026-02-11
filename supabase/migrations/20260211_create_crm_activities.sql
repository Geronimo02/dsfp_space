-- Create CRM activities table
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  subject TEXT,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create CRM activity log table
CREATE TABLE IF NOT EXISTS crm_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS crm_activities_company_id_idx ON crm_activities (company_id);
CREATE INDEX IF NOT EXISTS crm_activities_opportunity_id_idx ON crm_activities (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_activities_type_idx ON crm_activities (type);
CREATE INDEX IF NOT EXISTS crm_activities_due_at_idx ON crm_activities (due_at);
CREATE INDEX IF NOT EXISTS crm_activities_created_at_idx ON crm_activities (created_at);

CREATE INDEX IF NOT EXISTS crm_activity_log_company_id_idx ON crm_activity_log (company_id);
CREATE INDEX IF NOT EXISTS crm_activity_log_opportunity_id_idx ON crm_activity_log (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_activity_log_activity_id_idx ON crm_activity_log (activity_id);
CREATE INDEX IF NOT EXISTS crm_activity_log_created_at_idx ON crm_activity_log (created_at);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_activities_updated_at ON crm_activities;
CREATE TRIGGER update_crm_activities_updated_at
  BEFORE UPDATE ON crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_activities
CREATE POLICY "Users can view CRM activities from their company"
  ON crm_activities
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM activities for their company"
  ON crm_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM activities for their company"
  ON crm_activities
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

CREATE POLICY "Users can delete CRM activities for their company"
  ON crm_activities
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for crm_activity_log
CREATE POLICY "Users can view CRM activity logs from their company"
  ON crm_activity_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM activity logs for their company"
  ON crm_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM activity logs for their company"
  ON crm_activity_log
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

CREATE POLICY "Users can delete CRM activity logs for their company"
  ON crm_activity_log
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
