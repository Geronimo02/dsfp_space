-- Fix ticket_config RLS policies - replace overly permissive policies with company-scoped ones

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view ticket config" ON public.ticket_config;
DROP POLICY IF EXISTS "Users can manage ticket config" ON public.ticket_config;

-- Create company-scoped SELECT policy for all company users
CREATE POLICY "Users can view their company ticket config"
  ON public.ticket_config 
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Create company-scoped INSERT policy for admins/managers
CREATE POLICY "Admins can create ticket config"
  ON public.ticket_config 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager')
    )
  );

-- Create company-scoped UPDATE policy for admins/managers
CREATE POLICY "Admins can update their company ticket config"
  ON public.ticket_config 
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role IN ('admin', 'manager')
    )
  );

-- Create company-scoped DELETE policy for admins only
CREATE POLICY "Admins can delete their company ticket config"
  ON public.ticket_config 
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
        AND active = true 
        AND role = 'admin'
    )
  );