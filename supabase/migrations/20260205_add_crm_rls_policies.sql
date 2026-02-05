-- Enable RLS for CRM tables
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_pipelines
-- Allow users to view pipelines from their company
CREATE POLICY "Users can view pipelines from their company"
  ON crm_pipelines
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

-- Allow users to insert pipelines for their company
CREATE POLICY "Users can insert pipelines for their company"
  ON crm_pipelines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

-- Allow users to update pipelines from their company
CREATE POLICY "Users can update pipelines from their company"
  ON crm_pipelines
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

-- Allow users to delete pipelines from their company
CREATE POLICY "Users can delete pipelines from their company"
  ON crm_pipelines
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for crm_opportunities
-- Allow users to view opportunities from their company
CREATE POLICY "Users can view opportunities from their company"
  ON crm_opportunities
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

-- Allow users to insert opportunities for their company
CREATE POLICY "Users can insert opportunities for their company"
  ON crm_opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );

-- Allow users to update opportunities from their company
CREATE POLICY "Users can update opportunities from their company"
  ON crm_opportunities
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

-- Allow users to delete opportunities from their company
CREATE POLICY "Users can delete opportunities from their company"
  ON crm_opportunities
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM company_users 
      WHERE user_id = auth.uid()
    )
  );
