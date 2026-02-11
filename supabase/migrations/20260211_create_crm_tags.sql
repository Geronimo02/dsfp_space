-- Create CRM tags table
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'rgb(59, 130, 246)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure unique tag names per company (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_company_name_idx
  ON crm_tags (company_id, lower(name));

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_crm_tags_updated_at ON crm_tags;
CREATE TRIGGER update_crm_tags_updated_at
  BEFORE UPDATE ON crm_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_tags
CREATE POLICY "Users can view CRM tags from their company"
  ON crm_tags
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert CRM tags for their company"
  ON crm_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update CRM tags for their company"
  ON crm_tags
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

CREATE POLICY "Users can delete CRM tags for their company"
  ON crm_tags
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );
