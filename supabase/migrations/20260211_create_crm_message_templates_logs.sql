-- CRM message templates
CREATE TABLE IF NOT EXISTS crm_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject TEXT,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_message_templates_company_id_idx ON crm_message_templates (company_id);
CREATE INDEX IF NOT EXISTS crm_message_templates_channel_idx ON crm_message_templates (channel);

-- CRM message logs
CREATE TABLE IF NOT EXISTS crm_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  template_id UUID REFERENCES crm_message_templates(id) ON DELETE SET NULL,
  subject TEXT,
  body TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  provider_message_id TEXT,
  error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_message_logs_company_id_idx ON crm_message_logs (company_id);
CREATE INDEX IF NOT EXISTS crm_message_logs_opportunity_id_idx ON crm_message_logs (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_message_logs_customer_id_idx ON crm_message_logs (customer_id);
CREATE INDEX IF NOT EXISTS crm_message_logs_status_idx ON crm_message_logs (status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_message_templates_updated_at ON crm_message_templates;
CREATE TRIGGER update_crm_message_templates_updated_at
  BEFORE UPDATE ON crm_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_message_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Users can view CRM message templates from their company"
  ON crm_message_templates
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM message templates for their company"
  ON crm_message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM message templates for their company"
  ON crm_message_templates
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

CREATE POLICY "Users can delete CRM message templates for their company"
  ON crm_message_templates
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for logs
CREATE POLICY "Users can view CRM message logs from their company"
  ON crm_message_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM message logs for their company"
  ON crm_message_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM message logs for their company"
  ON crm_message_logs
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
